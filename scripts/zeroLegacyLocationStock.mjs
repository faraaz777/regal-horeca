/**
 * Zero ONLY sellable/on-hand qty sitting on legacy location levels
 * (section / zone / shelf). Does not touch Branch › Floor › Rack stock.
 *
 * Writes adjustment_minus ledger entries and rebuilds Stock projection
 * per affected product so audit history stays intact.
 *
 * Usage:
 *   node scripts/zeroLegacyLocationStock.mjs --dry-run
 *   node scripts/zeroLegacyLocationStock.mjs
 */
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes('--dry-run');
const LEGACY_LEVELS = ['section', 'zone', 'shelf'];
const PERFORMED_BY = new mongoose.Types.ObjectId('6a36786e18ac8b516ad2464a'); // admin@regal-horeca.com

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
loadEnvLocal();

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;

const legacyLocs = await db
  .collection('locations')
  .find({ level: { $in: LEGACY_LEVELS } })
  .toArray();
const legacyIds = legacyLocs.map((l) => l._id);
const locById = new Map(legacyLocs.map((l) => [String(l._id), l]));

const legacyStocks = await db
  .collection('stocks')
  .find({ locationId: { $in: legacyIds }, qty: { $gt: 0 } })
  .toArray();

const productIds = [...new Set(legacyStocks.map((s) => String(s.productId)))].map(
  (id) => new mongoose.Types.ObjectId(id)
);
const products = await db
  .collection('products')
  .find({ _id: { $in: productIds } })
  .project({ title: 1, sku: 1, barcode: 1, brand: 1 })
  .toArray();
const productById = new Map(products.map((p) => [String(p._id), p]));

/** Snapshot rack stock for the same products BEFORE — to prove we didn't disturb it */
const rackLocs = await db
  .collection('locations')
  .find({ level: 'rack', isActive: true })
  .project({ _id: 1 })
  .toArray();
const rackIds = rackLocs.map((l) => l._id);
const rackStockBefore = await db
  .collection('stocks')
  .find({ productId: { $in: productIds }, locationId: { $in: rackIds }, qty: { $gt: 0 } })
  .toArray();

const plan = legacyStocks.map((s) => {
  const product = productById.get(String(s.productId));
  const loc = locById.get(String(s.locationId));
  return {
    productId: String(s.productId),
    title: product?.title || '(missing)',
    sku: product?.sku || '',
    barcode: product?.barcode || '',
    brand: product?.brand || '',
    stockId: String(s._id),
    locationId: String(s.locationId),
    locationLevel: loc?.level || '?',
    locationCode: loc?.code || '',
    locationName: loc?.name || '',
    locationPath: loc?.path || '',
    statusBucket: s.statusBucket,
    qtyBefore: s.qty,
    qtyAfter: 0,
    delta: -s.qty,
  };
});

plan.sort((a, b) => a.title.localeCompare(b.title));

console.log(`Found ${plan.length} legacy stock row(s) across ${productIds.length} product(s)`);
console.log(`Rack stock rows for same products (will NOT touch): ${rackStockBefore.length}`);
console.log(DRY_RUN ? 'DRY RUN — no writes' : 'APPLYING writes…');

if (DRY_RUN) {
  console.table(
    plan.map((r) => ({
      title: r.title,
      sku: r.sku,
      level: r.locationLevel,
      location: `${r.locationCode || r.locationName} (${r.locationPath})`,
      bucket: r.statusBucket,
      qtyBefore: r.qtyBefore,
      qtyAfter: 0,
    }))
  );
  writeFileSync(
    resolve(__dirname, `_legacy-zero-plan-${Date.now()}.json`),
    JSON.stringify({ dryRun: true, plan, rackStockBefore }, null, 2)
  );
  await mongoose.disconnect();
  process.exit(0);
}

const session = await mongoose.startSession();
const results = [];

/** Active ledger buckets only — retired buckets (hold, etc.) are dropped from projection. */
const ACTIVE_BUCKETS = new Set(['sellable', 'sold']);

try {
  await session.withTransaction(async () => {
    for (const row of plan) {
      const productId = new mongoose.Types.ObjectId(row.productId);
      const locationId = new mongoose.Types.ObjectId(row.locationId);
      const bucket = row.statusBucket === 'dead_stock' ? 'sellable' : row.statusBucket;

      /**
       * Only write ledger for active buckets. Retired buckets (e.g. hold) are
       * removed when we rebuild the Stock projection below.
       */
      if (ACTIVE_BUCKETS.has(bucket)) {
        await db.collection('stockledgers').insertOne(
          {
            productId,
            locationId,
            type: 'adjustment_minus',
            statusBucket: bucket,
            qty: row.delta,
            reason: 'manual_adjustment',
            remark: `Zeroed legacy ${row.locationLevel} stock (standardize to Branch › Floor › Rack only)`,
            ref: 'legacy-location-cleanup',
            ratePaise: null,
            deadStockMarked: false,
            performedBy: PERFORMED_BY,
            createdAt: new Date(),
          },
          { session }
        );
      }

      results.push(row);
    }

    /**
     * Rebuild Stock projection per affected product from full ledger.
     * Legacy location leftovers are never re-inserted. Rack stock is preserved.
     */
    const allLocs = await db
      .collection('locations')
      .find({ isActive: true }, { session })
      .toArray();
    const byId = new Map(allLocs.map((l) => [String(l._id), l]));

    function cascadeIds(locationId) {
      const chain = [];
      let current = byId.get(String(locationId));
      const seen = new Set();
      while (current && !seen.has(String(current._id))) {
        seen.add(String(current._id));
        chain.unshift(current);
        if (!current.parentLocationId) break;
        current = byId.get(String(current.parentLocationId));
      }
      const branch = chain.find((l) => l.level === 'branch');
      const floor = chain.find((l) => l.level === 'floor');
      const rack = chain.find((l) => l.level === 'rack') || null;
      return {
        branchId: branch?._id || null,
        floorId: floor?._id || null,
        rackId: rack?._id || null,
      };
    }

    for (const pid of productIds) {
      const entries = await db
        .collection('stockledgers')
        .find({ productId: pid }, { session })
        .sort({ createdAt: 1 })
        .toArray();

      const totals = new Map();
      let lastLedgerAt = null;
      for (const entry of entries) {
        const statusBucket =
          entry.statusBucket === 'dead_stock' ? 'sellable' : entry.statusBucket;
        if (!ACTIVE_BUCKETS.has(statusBucket)) continue;
        const key = `${String(entry.locationId)}|${statusBucket}`;
        totals.set(key, (totals.get(key) || 0) + entry.qty);
        if (!lastLedgerAt || entry.createdAt > lastLedgerAt) lastLedgerAt = entry.createdAt;
      }

      await db.collection('stocks').deleteMany({ productId: pid }, { session });

      const inserts = [];
      for (const [key, rawQty] of totals) {
        const qty = Math.max(0, rawQty);
        if (qty === 0) continue;
        const [locationId, statusBucket] = key.split('|');
        const loc = byId.get(locationId);
        // Never keep stock rows on legacy section/zone/shelf
        if (loc && LEGACY_LEVELS.includes(loc.level)) continue;

        const cascade = cascadeIds(locationId);
        inserts.push({
          productId: pid,
          locationId: new mongoose.Types.ObjectId(locationId),
          statusBucket,
          qty,
          lastLedgerAt,
          branchId: cascade.branchId,
          floorId: cascade.floorId,
          rackId: cascade.rackId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      if (inserts.length > 0) {
        await db.collection('stocks').insertMany(inserts, { session });
      }
    }
  });
} catch (err) {
  console.error('Transaction failed:', err);
  await mongoose.disconnect();
  process.exit(1);
} finally {
  session.endSession();
}

/** Verify */
const leftover = await db
  .collection('stocks')
  .find({ locationId: { $in: legacyIds }, qty: { $gt: 0 } })
  .toArray();
const rackStockAfter = await db
  .collection('stocks')
  .find({ productId: { $in: productIds }, locationId: { $in: rackIds }, qty: { $gt: 0 } })
  .toArray();

console.log('\n=== CHANGED (legacy zeroed) ===');
console.table(
  results.map((r) => ({
    title: r.title,
    sku: r.sku,
    level: r.locationLevel,
    location: r.locationCode || r.locationName,
    path: r.locationPath,
    bucket: r.statusBucket,
    qtyBefore: r.qtyBefore,
    qtyAfter: 0,
  }))
);

console.log('Leftover legacy qty>0 rows:', leftover.length);
console.log('Rack stock rows before:', rackStockBefore.length, 'after:', rackStockAfter.length);
console.log(
  'Rack qty total before:',
  rackStockBefore.reduce((s, r) => s + r.qty, 0),
  'after:',
  rackStockAfter.reduce((s, r) => s + r.qty, 0)
);

const reportPath = resolve(__dirname, `_legacy-zero-report-${Date.now()}.json`);
writeFileSync(
  reportPath,
  JSON.stringify(
    {
      appliedAt: new Date().toISOString(),
      results,
      leftoverLegacyCount: leftover.length,
      rackStockBefore,
      rackStockAfter,
    },
    null,
    2
  )
);
console.log('Report:', reportPath);

await mongoose.disconnect();
