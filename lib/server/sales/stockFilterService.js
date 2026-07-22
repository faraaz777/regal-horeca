import 'server-only';

import mongoose from 'mongoose';
import Stock from '@/lib/models/Stock';

let inStockCache = { ids: null, at: 0 };
const CACHE_MS = 30_000;

/**
 * Product IDs with sellableQty > 0 from ledger Stock projection.
 * Dead-stock TAG does not exclude a product from "in stock".
 */
export async function getInStockProductIds() {
  const now = Date.now();
  if (inStockCache.ids && now - inStockCache.at < CACHE_MS) {
    return inStockCache.ids;
  }

  const stockAgg = await Stock.aggregate([
    { $match: { statusBucket: 'sellable' } },
    { $group: { _id: '$productId', qty: { $sum: '$qty' } } },
    { $match: { qty: { $gt: 0 } } },
    { $project: { _id: 1 } },
  ]);

  const ids = stockAgg.map((r) => String(r._id));
  inStockCache = { ids, at: now };
  return inStockCache.ids;
}

export function stockFilterToQuery(stockFilter, inStockIds) {
  const mode = String(stockFilter || 'all').toLowerCase();
  if (mode === 'all' || !inStockIds) return null;

  const objectIds = inStockIds.map((id) => new mongoose.Types.ObjectId(id));

  if (mode === 'in_stock') {
    return { _id: { $in: objectIds } };
  }
  if (mode === 'out') {
    return { _id: { $nin: objectIds } };
  }
  return null;
}
