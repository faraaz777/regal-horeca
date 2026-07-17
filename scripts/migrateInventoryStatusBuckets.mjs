/**
 * migrateInventoryStatusBuckets.mjs
 *
 * Converts legacy StockLedger statusBucket values into the simplified model:
 *   sellable | dead_stock | sold
 *
 * Mapping:
 *   display, scrap, hold, non_sellable, damage, sample, return_vendor → dead_stock
 *   sellable → sellable (unchanged)
 *   dead_stock → dead_stock (unchanged)
 *   sold → sold (unchanged)
 *
 * Then rebuilds the Stock projection for every affected product.
 *
 * Flags:
 *   --dry-run   Log planned updates; no writes.
 *   --uri=...   Override MONGODB_URI.
 *
 * Usage:
 *   node scripts/migrateInventoryStatusBuckets.mjs --dry-run
 *   node scripts/migrateInventoryStatusBuckets.mjs
 */

import path from 'node:path';
import fs from 'node:fs';
import mongoose from 'mongoose';

const LEGACY_TO_DEAD = [
  'display',
  'scrap',
  'hold',
  'non_sellable',
  'damage',
  'sample',
  'return_vendor',
];

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

  const entries = await ledger
    .find({ productId })
    .sort({ createdAt: 1 })
    .toArray();

  const totals = new Map();
  let lastLedgerAt = null;

  for (const entry of entries) {
    const locKey = String(entry.locationId);
    const bucketKey = `${locKey}|${entry.statusBucket}`;
    totals.set(bucketKey, (totals.get(bucketKey) || 0) + Number(entry.qty || 0));
    if (!lastLedgerAt || entry.createdAt > lastLedgerAt) {
      lastLedgerAt = entry.createdAt;
    }
  }

  await stock.deleteMany({ productId });

  const inserts = [];
  for (const [key, rawQty] of totals) {
    const qty = Math.max(0, rawQty);
    if (qty === 0) continue;
    const [locationId, statusBucket] = key.split('|');
    inserts.push({
      productId,
      locationId: new mongoose.Types.ObjectId(locationId),
      statusBucket,
      qty,
      lastLedgerAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  if (inserts.length > 0) {
    await stock.insertMany(inserts);
  }

  return inserts.length;
}

async function main() {
  loadEnvFile('.env.local');
  loadEnvFile('.env');

  const opts = parseArgs(process.argv.slice(2));
  const uri = opts.uri || process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const ledger = db.collection('stockledgers');

  const legacyFilter = { statusBucket: { $in: LEGACY_TO_DEAD } };
  const legacyCount = await ledger.countDocuments(legacyFilter);
  console.log(`Legacy ledger rows to remap: ${legacyCount}`);

  if (opts.dryRun) {
    const samples = await ledger.find(legacyFilter).limit(20).toArray();
    for (const row of samples) {
      console.log(
        `  ${row._id} product=${row.productId} ${row.statusBucket} qty=${row.qty} → dead_stock`
      );
    }
    console.log('Dry run complete — no writes.');
    await mongoose.disconnect();
    return;
  }

  if (legacyCount > 0) {
    const result = await ledger.updateMany(legacyFilter, {
      $set: { statusBucket: 'dead_stock' },
    });
    console.log(`Updated ledger rows: ${result.modifiedCount}`);
  }

  const productIds = await ledger.distinct('productId');
  console.log(`Rebuilding Stock projection for ${productIds.length} products…`);

  let rebuilt = 0;
  for (const productId of productIds) {
    await recomputeStockProjection(db, productId);
    rebuilt += 1;
    if (rebuilt % 50 === 0) console.log(`  …${rebuilt}/${productIds.length}`);
  }

  console.log(`Done. Rebuilt ${rebuilt} products.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
