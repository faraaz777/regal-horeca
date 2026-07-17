import 'server-only';

import mongoose from 'mongoose';
import Stock from '@/lib/models/Stock';
import InventoryStock from '@/lib/models/InventoryStock';
import InventoryRule from '@/lib/models/InventoryRule';
import {
  deriveStockStatus,
  deriveInventoryCondition,
  getDefaultLowStockThreshold,
} from '@/lib/server/inventory/inventoryService';

/**
 * Batch stock lookup — one round-trip per collection instead of N× per product.
 * Used by sales catalog to stay fast on serverless cold starts.
 */
export async function getBatchProductStockSummaries(productIds) {
  const map = new Map();
  if (!productIds?.length) return map;

  const ids = [...new Set(productIds.map((id) => String(id)))];
  const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));

  const [stockRows, legacyRows, rules, defaultThreshold] = await Promise.all([
    Stock.find({ productId: { $in: objectIds } })
      .select('productId locationId statusBucket qty')
      .lean(),
    InventoryStock.find({ productId: { $in: objectIds } })
      .select('productId sellableQty')
      .lean(),
    InventoryRule.find({ productId: { $in: objectIds } })
      .select('productId minStock')
      .lean(),
    getDefaultLowStockThreshold(),
  ]);

  const rulesByProduct = new Map(rules.map((r) => [String(r.productId), r.minStock]));
  const stockByProduct = new Map();
  const legacyByProduct = new Map();

  for (const row of stockRows) {
    const pid = String(row.productId);
    if (!stockByProduct.has(pid)) stockByProduct.set(pid, []);
    stockByProduct.get(pid).push(row);
  }

  for (const row of legacyRows) {
    const pid = String(row.productId);
    if (!legacyByProduct.has(pid)) legacyByProduct.set(pid, []);
    legacyByProduct.get(pid).push(row);
  }

  for (const pid of ids) {
    const rows = stockByProduct.get(pid) || [];
    const threshold = rulesByProduct.get(pid) ?? defaultThreshold;

    if (rows.length === 0) {
      const legacy = legacyByProduct.get(pid) || [];
      const sellableQty = legacy.reduce((s, r) => s + (r.sellableQty || 0), 0);
      map.set(pid, {
        sellableQty,
        deadStockQty: 0,
        holdQty: 0,
        condition: 'NORMAL',
        stockStatus: deriveStockStatus(sellableQty, threshold),
        primaryLocationId: null,
      });
      continue;
    }

    const sellableQty = rows
      .filter((r) => r.statusBucket === 'sellable')
      .reduce((s, r) => s + r.qty, 0);
    const deadStockQty = rows
      .filter((r) => r.statusBucket === 'dead_stock')
      .reduce((s, r) => s + r.qty, 0);
    const onHand = rows.filter((r) => r.statusBucket !== 'sold');
    const primary = onHand.length ? [...onHand].sort((a, b) => b.qty - a.qty)[0] : null;

    map.set(pid, {
      sellableQty,
      deadStockQty,
      holdQty: 0,
      condition: deriveInventoryCondition(deadStockQty),
      stockStatus: deriveStockStatus(sellableQty, threshold),
      primaryLocationId: primary?.locationId ? String(primary.locationId) : null,
    });
  }

  return map;
}
