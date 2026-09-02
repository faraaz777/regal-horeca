/**
 * Remove brand products from the admin inventory list only.
 * Catalog / sales-floor product rows are NOT deleted or hidden.
 *
 * Inventory list membership comes from stockledgers, stocks, or inventoryrules.
 * This script backs up those rows, then deletes them so the products no longer
 * appear under Admin › Inventory while remaining in the product catalog.
 *
 * Usage:
 *   node scripts/removeOceanFromInventory.mjs --dry-run
 *   node scripts/removeOceanFromInventory.mjs
 *
 * Options:
 *   --dry-run       Preview targets and write a backup plan JSON (no deletes)
 *   --brand=Ocean   Brand filter (default: Ocean, case-insensitive exact match)
 *   --uri=...       Override MONGODB_URI
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INVENTORY_COLLECTIONS = ['stockledgers', 'stocks', 'inventoryrules', 'inventorystocks', 'inventorytransactions'];

function loadEnvLocal() {
  const envPath = resolve(__dirname, '../.env.local');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function parseArgs(argv) {
  const opts = { dryRun: false, brand: 'Ocean', uri: null };
  for (const arg of argv) {
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg.startsWith('--brand=')) opts.brand = arg.slice(8);
    else if (arg.startsWith('--uri=')) opts.uri = arg.slice(6);
  }
  return opts;
}

async function getInventoryTrackedIds(db) {
  const [ledgerIds, stockIds, ruleIds] = await Promise.all([
    db.collection('stockledgers').distinct('productId'),
    db.collection('stocks').distinct('productId'),
    db.collection('inventoryrules').distinct('productId'),
  ]);
  const seen = new Set();
  for (const id of [...ledgerIds, ...stockIds, ...ruleIds]) {
    if (id) seen.add(String(id));
  }
  return [...seen];
}

async function collectInventoryBackup(db, productIds) {
  const backup = { products: [], collections: {} };
  const oidList = productIds.map((id) => new mongoose.Types.ObjectId(id));

  backup.products = await db
    .collection('products')
    .find({ _id: { $in: oidList } })
    .project({ title: 1, sku: 1, barcode: 1, brand: 1, slug: 1, showInCatalog: 1, deletedAt: 1 })
    .toArray();

  for (const coll of INVENTORY_COLLECTIONS) {
    backup.collections[coll] = await db.collection(coll).find({ productId: { $in: oidList } }).toArray();
  }

  return backup;
}

function summarizePlan(backup) {
  const rows = backup.products.map((p) => {
    const pid = String(p._id);
    const stockRows = backup.collections.stocks?.filter((s) => String(s.productId) === pid) ?? [];
    const onHand = stockRows.reduce((sum, s) => sum + (s.qty || 0), 0);
    return {
      productId: pid,
      sku: p.sku || '',
      title: p.title || '',
      brand: p.brand || '',
      onHandQty: onHand,
      ledgerRows: backup.collections.stockledgers?.filter((r) => String(r.productId) === pid).length ?? 0,
      stockRows: stockRows.length,
      hasRule: backup.collections.inventoryrules?.some((r) => String(r.productId) === pid) ?? false,
    };
  });
  rows.sort((a, b) => a.title.localeCompare(b.title));
  return rows;
}

loadEnvLocal();
const opts = parseArgs(process.argv.slice(2));
const uri = opts.uri || process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is required (set in .env.local or pass --uri=...)');
  process.exit(1);
}

await mongoose.connect(uri);
const db = mongoose.connection.db;

const trackedIds = await getInventoryTrackedIds(db);
if (trackedIds.length === 0) {
  console.log('No inventory-tracked products found.');
  await mongoose.disconnect();
  process.exit(0);
}

const brandRegex = new RegExp(`^${opts.brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
const candidates = await db
  .collection('products')
  .find({
    _id: { $in: trackedIds.map((id) => new mongoose.Types.ObjectId(id)) },
    deletedAt: null,
    productType: { $ne: 'parent' },
    brand: brandRegex,
  })
  .project({ title: 1, sku: 1, brand: 1 })
  .toArray();

const productIds = candidates.map((p) => String(p._id));

console.log(`Brand filter: ${opts.brand}`);
console.log(`Inventory-tracked products matching brand: ${productIds.length}`);

if (productIds.length === 0) {
  console.log('Nothing to remove.');
  await mongoose.disconnect();
  process.exit(0);
}

const backup = await collectInventoryBackup(db, productIds);
const plan = summarizePlan(backup);
const timestamp = Date.now();
const brandSlug = opts.brand.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'brand';
const backupPath = resolve(__dirname, `_backup-${brandSlug}-inventory-${timestamp}.json`);

console.table(
  plan.map((r) => ({
    sku: r.sku,
    title: r.title,
    onHand: r.onHandQty,
    ledger: r.ledgerRows,
    stocks: r.stockRows,
    rule: r.hasRule ? 'yes' : 'no',
  }))
);

if (opts.dryRun) {
  writeFileSync(
    backupPath,
    JSON.stringify({ dryRun: true, brand: opts.brand, plan, backup }, null, 2)
  );
  console.log(`DRY RUN — no deletes. Backup plan written to ${backupPath}`);
  await mongoose.disconnect();
  process.exit(0);
}

writeFileSync(
  backupPath,
  JSON.stringify({ appliedAt: new Date().toISOString(), brand: opts.brand, plan, backup }, null, 2)
);
console.log(`Backup written: ${backupPath}`);

const oidList = productIds.map((id) => new mongoose.Types.ObjectId(id));
const session = await mongoose.startSession();
const deleteCounts = {};

try {
  await session.withTransaction(async () => {
    for (const coll of INVENTORY_COLLECTIONS) {
      const result = await db.collection(coll).deleteMany({ productId: { $in: oidList } }, { session });
      deleteCounts[coll] = result.deletedCount;
    }
  });
} finally {
  await session.endSession();
}

console.log('Deleted inventory rows:', deleteCounts);

const trackedAfter = await getInventoryTrackedIds(db);
const stillTracked = productIds.filter((id) => trackedAfter.includes(id));
const catalogStillThere = await db.collection('products').countDocuments({
  _id: { $in: oidList },
  deletedAt: null,
});

console.log(`Products still in catalog: ${catalogStillThere}/${productIds.length}`);
console.log(`Products still inventory-tracked: ${stillTracked.length}`);

if (stillTracked.length > 0) {
  console.warn('WARNING: some products are still tracked:', stillTracked);
  process.exitCode = 1;
}

await mongoose.disconnect();
