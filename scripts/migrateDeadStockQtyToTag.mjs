/**
 * migrateDeadStockQtyToTag.mjs
 *
 * Dead stock is a product-wide TAG (InventoryRule.deadStockMarked), not a qty bucket.
 * STATUS_BUCKETS is now only ['sellable', 'sold'] — this script is a safety net
 * for any leftover dead_stock qty rows from older test data.
 *
 * This script:
 * 1. Finds products with ledger/stock in statusBucket "dead_stock"
 * 2. Sets InventoryRule.deadStockMarked = true for those products
 * 3. Rewrites ledger dead_stock → sellable (same location/qty/sign)
 * 4. Rebuilds Stock projections
 *
 * Flags:
 *   --dry-run   Log only
 *   --uri=...   Override MONGODB_URI
 *
 * Usage:
 *   node scripts/migrateDeadStockQtyToTag.mjs --dry-run
 *   node scripts/migrateDeadStockQtyToTag.mjs
 */

import path from 'node:path';
import fs from 'node:fs';
import mongoose from 'mongoose';

function loadEnvFile(name) {
  try {
    const p = path.resolve(process.cwd(), name);
    if (!fs.existsSync(p)) return;
    const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    /* ignore */
  }
}

function parseArgs(argv) {
  const opts = { dryRun: false, uri: null };
  for (const arg of argv) {
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg.startsWith('--uri=')) opts.uri = arg.slice(6);
  }
  return opts;
}

async function recomputeStockProjection(db, productId) {
  const ledger = db.collection('stockledgers');
  const stock = db.collection('stocks');
  const locations = db.collection('locations');

  const entries = await ledger.find({ productId }).sort({ createdAt: 1 }).toArray();
  const totals = new Map();
  let lastLedgerAt = null;

  for (const entry of entries) {
    const locKey = String(entry.locationId);
    const bucketKey = `${locKey}|${entry.statusBucket}`;
    totals.set(bucketKey, (totals.get(bucketKey) || 0) + entry.qty);
    if (!lastLedgerAt || entry.createdAt > lastLedgerAt) lastLedgerAt = entry.createdAt;
  }

  await stock.deleteMany({ productId });

  const allLocs = await locations.find({}).toArray();
  const byId = new Map(allLocs.map((l) => [String(l._id), l]));

  function cascadeIds(locationId) {
    let current = byId.get(String(locationId));
    let branchId = null;
    let floorId = null;
    let rackId = null;
    const seen = new Set();
    while (current && !seen.has(String(current._id))) {
      seen.add(String(current._id));
      if (current.level === 'branch') branchId = current._id;
      if (current.level === 'floor') floorId = current._id;
      if (current.level === 'rack') rackId = current._id;
      if (!current.parentLocationId) break;
      current = byId.get(String(current.parentLocationId));
    }
    return { branchId, floorId, rackId };
  }

  const inserts = [];
  for (const [key, rawQty] of totals) {
    const qty = Math.max(0, rawQty);
    if (qty === 0) continue;
    const [locationId, statusBucket] = key.split('|');
    const cascade = cascadeIds(locationId);
    inserts.push({
      productId,
      locationId: new mongoose.Types.ObjectId(locationId),
      statusBucket,
      qty,
      lastLedgerAt,
      branchId: cascade.branchId || null,
      floorId: cascade.floorId || null,
      rackId: cascade.rackId || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  if (inserts.length > 0) {
    await stock.insertMany(inserts);
  }
}

async function main() {
  loadEnvFile('.env.local');
  loadEnvFile('.env');
  const opts = parseArgs(process.argv.slice(2));
  const uri = opts.uri || process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI required');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const ledger = db.collection('stockledgers');
  const stock = db.collection('stocks');
  const rules = db.collection('inventoryrules');

  const deadLedger = await ledger
    .find({ statusBucket: 'dead_stock' })
    .project({ productId: 1 })
    .toArray();
  const deadStockRows = await stock
    .find({ statusBucket: 'dead_stock', qty: { $gt: 0 } })
    .project({ productId: 1 })
    .toArray();

  const productIds = [
    ...new Set([
      ...deadLedger.map((e) => String(e.productId)),
      ...deadStockRows.map((e) => String(e.productId)),
    ]),
  ].map((id) => new mongoose.Types.ObjectId(id));

  console.log(`Products with dead_stock qty history: ${productIds.length}`);
  console.log(`Ledger dead_stock entries: ${deadLedger.length}`);
  console.log(`Stock dead_stock rows: ${deadStockRows.length}`);
  console.log(opts.dryRun ? 'DRY RUN — no writes' : 'WRITING…');

  if (!opts.dryRun && productIds.length > 0) {
    for (const productId of productIds) {
      await rules.updateOne(
        { productId },
        {
          $set: { deadStockMarked: true, updatedAt: new Date() },
          $setOnInsert: {
            productId,
            minStock: 0,
            maxStock: 0,
            reorderQty: 0,
            deadStockPeriod: 'month',
            deadStockQty: 1,
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );
    }

    const ledgerResult = await ledger.updateMany(
      { statusBucket: 'dead_stock' },
      { $set: { statusBucket: 'sellable' } }
    );
    console.log(`Ledger rewritten: ${ledgerResult.modifiedCount}`);

    for (const productId of productIds) {
      await recomputeStockProjection(db, productId);
    }
    console.log(`Stock projections rebuilt for ${productIds.length} products`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
