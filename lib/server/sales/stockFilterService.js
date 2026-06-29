import 'server-only';

import mongoose from 'mongoose';
import Stock from '@/lib/models/Stock';
import InventoryStock from '@/lib/models/InventoryStock';

let inStockCache = { ids: null, at: 0 };
const CACHE_MS = 30_000;

/**
 * Product IDs with sellable qty > 0 (ledger Stock + legacy InventoryStock).
 */
export async function getInStockProductIds() {
  const now = Date.now();
  if (inStockCache.ids && now - inStockCache.at < CACHE_MS) {
    return inStockCache.ids;
  }

  const [stockAgg, legacyIds] = await Promise.all([
    Stock.aggregate([
      { $match: { statusBucket: 'sellable' } },
      { $group: { _id: '$productId', qty: { $sum: '$qty' } } },
      { $match: { qty: { $gt: 0 } } },
      { $project: { _id: 1 } },
    ]),
    InventoryStock.distinct('productId', { sellableQty: { $gt: 0 } }),
  ]);

  const ids = new Set(stockAgg.map((r) => String(r._id)));
  for (const id of legacyIds) ids.add(String(id));

  inStockCache = { ids: [...ids], at: now };
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
