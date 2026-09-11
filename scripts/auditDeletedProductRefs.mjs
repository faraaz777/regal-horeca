/**
 * Read-only audit: soft-deleted products and what still references their _id.
 *
 * Does not write to the database. Prints a report and saves JSON next to this script.
 *
 * Usage:
 *   node scripts/auditDeletedProductRefs.mjs
 *   npm run audit:deleted-products
 */

import mongoose from 'mongoose';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const envPath = resolve(__dirname, '../.env.local');
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const ACTIVE_BUCKET_STATUSES = ['draft', 'submitted'];
const NEEDS_ACTION_STATUSES = ['submitted', 'approved', 'partially_approved'];

async function auditOne(db, product, childIds) {
  const scopeIds = [product._id, ...childIds];
  const oidList = scopeIds;

  const [stockRows, ledgerCount, ruleCount, openBuckets, openRequests, collections, enquiryItems] =
    await Promise.all([
      db
        .collection('stocks')
        .find({ productId: { $in: oidList }, qty: { $gt: 0 } })
        .project({ locationId: 1, qty: 1, statusBucket: 1, productId: 1 })
        .toArray(),
      db.collection('stockledgers').countDocuments({ productId: { $in: oidList } }),
      db.collection('inventoryrules').countDocuments({ productId: { $in: oidList } }),
      db.collection('salesbuckets').countDocuments({
        status: { $in: ACTIVE_BUCKET_STATUSES },
        'lines.productId': { $in: oidList },
      }),
      db.collection('inventoryrequests').countDocuments({
        status: { $in: NEEDS_ACTION_STATUSES },
        'lines.productId': { $in: oidList },
      }),
      db.collection('salescollections').countDocuments({
        $or: [
          { 'items.productId': { $in: oidList } },
          { 'presentationSet.pins.productId': { $in: oidList } },
          { 'presentationSet.scenes.pins.productId': { $in: oidList } },
        ],
      }),
      db.collection('enquiryitems').countDocuments({ productId: { $in: oidList } }),
    ]);

  const locIds = [...new Set(stockRows.map((r) => String(r.locationId)))];
  const locMap = new Map();
  if (locIds.length) {
    const locs = await db
      .collection('locations')
      .find({
        _id: {
          $in: locIds.map((id) => new mongoose.Types.ObjectId(id)),
        },
      })
      .project({ path: 1, name: 1, code: 1 })
      .toArray();
    for (const loc of locs) {
      locMap.set(String(loc._id), loc.path || loc.name || loc.code || String(loc._id));
    }
  }

  const stockLocations = stockRows.map((row) => ({
    path: locMap.get(String(row.locationId)) || String(row.locationId),
    qty: row.qty,
    statusBucket: row.statusBucket,
  }));
  const totalQty = stockLocations.reduce((s, r) => s + (Number(r.qty) || 0), 0);

  const blockers = [];
  if (totalQty > 0) blockers.push(`Physical stock: ${totalQty} pcs`);
  if (ledgerCount > 0) blockers.push(`Inventory history: ${ledgerCount} ledger entries`);
  if (openBuckets > 0) blockers.push(`Open sales quotes: ${openBuckets}`);
  if (openRequests > 0) blockers.push(`Open stock requests: ${openRequests}`);
  if (collections > 0) blockers.push(`Sales collections: ${collections}`);
  if (enquiryItems > 0) blockers.push(`Enquiry line items: ${enquiryItems}`);

  return {
    productId: String(product._id),
    title: product.title || '',
    sku: product.sku || '',
    productType: product.productType || 'standalone',
    deletedAt: product.deletedAt,
    childrenCount: childIds.length,
    stock: { totalQty, locations: stockLocations },
    ledgerCount,
    inventoryRuleCount: ruleCount,
    openBuckets,
    openRequests,
    collections,
    enquiryItems,
    blockers,
    canHardDelete: blockers.length === 0,
    status: blockers.length === 0 ? 'Safe to delete forever' : 'Cannot delete forever',
  };
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const deleted = await db
    .collection('products')
    .find({ deletedAt: { $ne: null } })
    .project({
      title: 1,
      sku: 1,
      productType: 1,
      deletedAt: 1,
      parentProductId: 1,
    })
    .sort({ deletedAt: -1 })
    .toArray();

  console.log('\nDeleted Products Audit');
  console.log('======================');
  console.log(`Soft-deleted rows in products: ${deleted.length}\n`);

  // Audit parents/standalones as roots; skip children that will be rolled into parent scope.
  const childOfDeletedParent = new Set();
  const deletedIds = new Set(deleted.map((p) => String(p._id)));
  for (const p of deleted) {
    if (p.parentProductId && deletedIds.has(String(p.parentProductId))) {
      childOfDeletedParent.add(String(p._id));
    }
  }

  const roots = deleted.filter((p) => !childOfDeletedParent.has(String(p._id)));
  const reports = [];

  for (let i = 0; i < roots.length; i++) {
    const product = roots[i];
    const children = await db
      .collection('products')
      .find({ parentProductId: product._id })
      .project({ _id: 1 })
      .toArray();
    const childIds = children.map((c) => c._id);
    const report = await auditOne(db, product, childIds);
    reports.push(report);

    console.log('--------------------------------');
    console.log(`${i + 1}. ${report.title || '(untitled)'}`);
    if (report.sku) console.log(`SKU: ${report.sku}`);
    console.log(`Type: ${report.productType} · Children in scope: ${report.childrenCount}`);
    console.log(`Deleted at: ${report.deletedAt ? new Date(report.deletedAt).toISOString() : '—'}`);
    console.log('');
    console.log('Stock:');
    if (report.stock.locations.length === 0) {
      console.log('  0');
    } else {
      for (const loc of report.stock.locations) {
        console.log(`  ${loc.path}: ${loc.qty} pcs (${loc.statusBucket})`);
      }
    }
    console.log(`Ledger: ${report.ledgerCount} entries`);
    console.log(`Inventory rules: ${report.inventoryRuleCount}`);
    console.log(`Open sales quotes: ${report.openBuckets}`);
    console.log(`Open stock requests: ${report.openRequests}`);
    console.log(`Collections: ${report.collections}`);
    console.log(`Enquiry items: ${report.enquiryItems}`);
    console.log('');
    console.log(`Status: ${report.status}`);
    if (report.blockers.length) {
      console.log(`Blockers: ${report.blockers.join(' · ')}`);
    }
    console.log('');
  }

  const safe = reports.filter((r) => r.canHardDelete).length;
  const blocked = reports.length - safe;

  console.log('================================');
  console.log(`Roots audited: ${reports.length}`);
  console.log(`Safe to delete forever: ${safe}`);
  console.log(`Blocked by dependencies: ${blocked}`);
  console.log(`Skipped (child of deleted parent): ${childOfDeletedParent.size}`);

  const outPath = resolve(__dirname, `audit-deleted-products-${Date.now()}.json`);
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totalSoftDeleted: deleted.length,
        rootsAudited: reports.length,
        safeToHardDelete: safe,
        blocked: blocked,
        reports,
      },
      null,
      2
    ),
    'utf8'
  );
  console.log(`\nJSON report: ${outPath}\n`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
