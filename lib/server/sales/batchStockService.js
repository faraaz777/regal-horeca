import 'server-only';

import mongoose from 'mongoose';
import Stock from '@/lib/models/Stock';
import InventoryRule from '@/lib/models/InventoryRule';
import {
  deriveStockStatus,
  deriveInventoryCondition,
  getDefaultLowStockThreshold,
} from '@/lib/server/inventory/inventoryService';

/**
 * Batch stock lookup from ledger Stock projection only.
 * sellableQty = physical warehouse qty. Dead stock is InventoryRule.deadStockMarked.
 */
export async function getBatchProductStockSummaries(productIds) {
  const map = new Map();
  if (!productIds?.length) return map;

  const ids = [...new Set(productIds.map((id) => String(id)))];
  const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));

  const [stockRows, rules, defaultThreshold] = await Promise.all([
    Stock.find({ productId: { $in: objectIds } })
      .select('productId locationId statusBucket qty')
      .lean(),
    InventoryRule.find({ productId: { $in: objectIds } })
      .select('productId minStock deadStockMarked')
      .lean(),
    getDefaultLowStockThreshold(),
  ]);

  const rulesByProduct = new Map(
    rules.map((r) => [
      String(r.productId),
      { minStock: r.minStock, deadStockMarked: Boolean(r.deadStockMarked) },
    ])
  );
  const stockByProduct = new Map();

  for (const row of stockRows) {
    const pid = String(row.productId);
    if (!stockByProduct.has(pid)) stockByProduct.set(pid, []);
    stockByProduct.get(pid).push(row);
  }

  for (const pid of ids) {
    const rows = stockByProduct.get(pid) || [];
    const rule = rulesByProduct.get(pid);
    const threshold = rule?.minStock ?? defaultThreshold;
    const isDeadStock = Boolean(rule?.deadStockMarked);
    const condition = deriveInventoryCondition(isDeadStock);

    const sellableQty = rows
      .filter((r) => r.statusBucket === 'sellable')
      .reduce((s, r) => s + r.qty, 0);
    const sellableRows = rows.filter((r) => r.statusBucket === 'sellable');
    const primary = sellableRows.length
      ? [...sellableRows].sort((a, b) => b.qty - a.qty)[0]
      : null;

    map.set(pid, {
      sellableQty,
      isDeadStock,
      deadStockMarked: isDeadStock,
      condition,
      stockStatus: deriveStockStatus(sellableQty, threshold),
      primaryLocationId: primary?.locationId ? String(primary.locationId) : null,
    });
  }

  return map;
}
