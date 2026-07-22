import 'server-only';

import mongoose from 'mongoose';
import StockLedger from '@/lib/models/StockLedger';
import Stock from '@/lib/models/Stock';
import { STATUS_BUCKETS } from '@/lib/shared/inventoryConstants';
import { listAllLocations } from '@/lib/server/inventory/locationCrudService';
import { resolveLocationToCascade } from '@/lib/shared/locationDisplay';

/**
 * Rebuild Stock projection for one product from its ledger entries.
 * Must run inside the same MongoDB session as the ledger write.
 */
export async function recomputeStockProjection(productId, session) {
  const pid = new mongoose.Types.ObjectId(String(productId));

  const entries = await StockLedger.find({ productId: pid })
    .sort({ createdAt: 1 })
    .session(session)
    .lean();

  const totals = new Map();
  let lastLedgerAt = null;

  for (const entry of entries) {
    const locKey = String(entry.locationId);
    /**
     * Retired qty bucket dead_stock folds into sellable.
     * Dead stock is InventoryRule.deadStockMarked only.
     */
    const statusBucket =
      entry.statusBucket === 'dead_stock' ? 'sellable' : entry.statusBucket;
    if (!STATUS_BUCKETS.includes(statusBucket)) continue;

    const bucketKey = `${locKey}|${statusBucket}`;
    totals.set(bucketKey, (totals.get(bucketKey) || 0) + entry.qty);
    if (!lastLedgerAt || entry.createdAt > lastLedgerAt) {
      lastLedgerAt = entry.createdAt;
    }
  }

  await Stock.deleteMany({ productId: pid }).session(session);

  const allLocations = await listAllLocations();
  const locationById = new Map(allLocations.map((l) => [String(l._id), l]));

  const inserts = [];
  for (const [key, rawQty] of totals) {
    const qty = Math.max(0, rawQty);
    if (qty === 0) continue;
    const [locationId, statusBucket] = key.split('|');
    const cascade = resolveLocationToCascade(locationId, locationById);
    inserts.push({
      productId: pid,
      locationId: new mongoose.Types.ObjectId(locationId),
      statusBucket,
      qty,
      lastLedgerAt,
      branchId: cascade.branchId
        ? new mongoose.Types.ObjectId(cascade.branchId)
        : null,
      floorId: cascade.floorId ? new mongoose.Types.ObjectId(cascade.floorId) : null,
      rackId: cascade.rackId ? new mongoose.Types.ObjectId(cascade.rackId) : null,
    });
  }

  if (inserts.length > 0) {
    await Stock.insertMany(inserts, { session });
  }

  return inserts;
}

/**
 * Append a ledger entry and recompute the stock projection atomically.
 */
export async function appendLedgerEntry(entry, session) {
  const [ledgerDoc] = await StockLedger.create([entry], { session });
  await recomputeStockProjection(entry.productId, session);
  return ledgerDoc;
}

export async function runInTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

function bucketQty(rows, bucket) {
  return rows
    .filter((r) => r.statusBucket === bucket)
    .reduce((s, r) => s + r.qty, 0);
}

export async function getStockTotalsForProduct(productId) {
  const rows = await Stock.find({ productId }).lean();
  const buckets = Object.fromEntries(
    STATUS_BUCKETS.map((bucket) => [bucket, bucketQty(rows, bucket)])
  );
  /** sellableQty = physical qty at locations (warehouse pieces available). */
  const sellableQty = buckets.sellable || 0;
  const soldQty = buckets.sold || 0;

  const onHandRows = rows.filter((r) => r.statusBucket === 'sellable');
  const primary =
    onHandRows.length > 0 ? [...onHandRows].sort((a, b) => b.qty - a.qty)[0] : null;

  return {
    sellableQty,
    soldQty,
    holdQty: 0,
    nonSellableQty: 0,
    scrapQty: 0,
    displayQty: 0,
    buckets,
    rows,
    primary,
  };
}

const EMPTY_TOTALS = {
  sellableQty: 0,
  soldQty: 0,
  totalQty: 0,
};

/**
 * Batch stock totals for search / list enrichment.
 * totalQty = sellable only (sold excluded).
 */
export async function getStockTotalsMapForProducts(productIds) {
  const map = new Map();
  if (!productIds?.length) return map;

  const ids = productIds.map((id) => new mongoose.Types.ObjectId(String(id)));
  const rows = await Stock.find({ productId: { $in: ids } })
    .select('productId statusBucket qty')
    .lean();

  for (const row of rows) {
    const pid = String(row.productId);
    if (!map.has(pid)) {
      map.set(pid, { ...EMPTY_TOTALS });
    }
    const agg = map.get(pid);
    const qty = row.qty || 0;
    if (row.statusBucket === 'sellable') {
      agg.sellableQty += qty;
      agg.totalQty += qty;
    } else if (row.statusBucket === 'sold') {
      agg.soldQty += qty;
    }
  }

  return map;
}

export async function productHasLedgerEntries(productId) {
  const count = await StockLedger.countDocuments({ productId });
  return count > 0;
}
