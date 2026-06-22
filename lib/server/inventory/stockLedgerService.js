import 'server-only';

import mongoose from 'mongoose';
import StockLedger from '@/lib/models/StockLedger';
import Stock from '@/lib/models/Stock';

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
    const bucketKey = `${locKey}|${entry.statusBucket}`;
    totals.set(bucketKey, (totals.get(bucketKey) || 0) + entry.qty);
    if (!lastLedgerAt || entry.createdAt > lastLedgerAt) {
      lastLedgerAt = entry.createdAt;
    }
  }

  await Stock.deleteMany({ productId: pid }).session(session);

  const inserts = [];
  for (const [key, rawQty] of totals) {
    const qty = Math.max(0, rawQty);
    if (qty === 0) continue;
    const [locationId, statusBucket] = key.split('|');
    inserts.push({
      productId: pid,
      locationId: new mongoose.Types.ObjectId(locationId),
      statusBucket,
      qty,
      lastLedgerAt,
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

export async function getStockTotalsForProduct(productId) {
  const rows = await Stock.find({ productId }).lean();
  const sellableQty = rows
    .filter((r) => r.statusBucket === 'sellable')
    .reduce((s, r) => s + r.qty, 0);
  const holdQty = rows
    .filter((r) => r.statusBucket === 'hold')
    .reduce((s, r) => s + r.qty, 0);
  const nonSellableQty = rows
    .filter((r) => r.statusBucket === 'non_sellable')
    .reduce((s, r) => s + r.qty, 0);

  const primary =
    rows.length > 0 ? [...rows].sort((a, b) => b.qty - a.qty)[0] : null;

  return { sellableQty, holdQty, nonSellableQty, rows, primary };
}

export async function productHasLedgerEntries(productId) {
  const count = await StockLedger.countDocuments({ productId });
  return count > 0;
}
