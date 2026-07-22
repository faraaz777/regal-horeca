import 'server-only';

import Stock from '@/lib/models/Stock';
import StockLedger from '@/lib/models/StockLedger';
import Product from '@/lib/models/Product';
import InventoryRule from '@/lib/models/InventoryRule';
import { listAllLocations } from '@/lib/server/inventory/locationCrudService';
import {
  formatBranchFloorRackPath,
  resolveLocationToCascade,
} from '@/lib/shared/locationDisplay';

/**
 * Inventory reports — sellableQty at locations, dead-stock TAG (product-wide), sold history.
 * Dead stock is NOT a qty bucket; tagged products show current sellableQty.
 */

async function enrichWithProductsAndPaths(rows) {
  if (!rows.length) return [];
  const productIds = [...new Set(rows.map((r) => String(r.productId)))];
  const products = await Product.find({ _id: { $in: productIds }, deletedAt: null })
    .select('title sku stockUnit costPrice moneyInPaise')
    .lean();
  const productById = new Map(products.map((p) => [String(p._id), p]));

  const allLocs = await listAllLocations();
  const byId = new Map(allLocs.map((l) => [String(l._id), l]));

  return rows
    .map((row) => {
      const product = productById.get(String(row.productId));
      if (!product) return null;
      const cost = product.costPrice || 0;
      const unitCost = product.moneyInPaise ? cost / 100 : cost;
      const cascade = resolveLocationToCascade(String(row.locationId), byId);
      return {
        productId: String(row.productId),
        title: product.title,
        sku: product.sku || '',
        stockUnit: product.stockUnit || 'Pcs',
        locationId: String(row.locationId),
        locationPath: cascade.displayPath || formatBranchFloorRackPath(String(row.locationId), byId),
        qty: row.qty,
        unitCost,
        value: unitCost * row.qty,
        lastLedgerAt: row.lastLedgerAt || null,
        statusBucket: row.statusBucket,
      };
    })
    .filter(Boolean);
}

/**
 * Physical sellable stock at racks.
 */
export async function getSellableStockReport({ search = '', page = 1, limit = 50 } = {}) {
  const filter = {
    statusBucket: 'sellable',
    qty: { $gt: 0 },
  };
  const rows = await Stock.find(filter).lean();
  let items = await enrichWithProductsAndPaths(rows);

  if (search.trim()) {
    const q = search.trim().toLowerCase();
    items = items.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.sku.toLowerCase().includes(q) ||
        i.locationPath.toLowerCase().includes(q)
    );
  }

  items.sort((a, b) => a.title.localeCompare(b.title) || b.qty - a.qty);
  const total = items.length;
  const start = (page - 1) * limit;
  return {
    items: items.slice(start, start + limit),
    pagination: { page, limit, total },
    totals: {
      qty: items.reduce((s, i) => s + i.qty, 0),
      value: items.reduce((s, i) => s + i.value, 0),
    },
  };
}

/**
 * Products with deadStockMarked = true, showing current on-hand qty (all locations).
 */
export async function getDeadStockReport({ search = '', page = 1, limit = 50 } = {}) {
  const taggedRules = await InventoryRule.find({ deadStockMarked: true })
    .select('productId deadStockPeriod deadStockQty updatedAt')
    .lean();

  if (!taggedRules.length) {
    return {
      items: [],
      pagination: { page, limit, total: 0 },
      totals: { qty: 0, value: 0 },
    };
  }

  const productIds = taggedRules.map((r) => r.productId);
  const ruleByProduct = new Map(taggedRules.map((r) => [String(r.productId), r]));

  const products = await Product.find({ _id: { $in: productIds }, deletedAt: null })
    .select('title sku stockUnit costPrice moneyInPaise')
    .lean();

  const stocks = await Stock.find({
    productId: { $in: productIds },
    statusBucket: 'sellable',
    qty: { $gt: 0 },
  }).lean();

  const onHandByProduct = new Map();
  const lastLedgerByProduct = new Map();
  for (const row of stocks) {
    const pid = String(row.productId);
    onHandByProduct.set(pid, (onHandByProduct.get(pid) || 0) + (row.qty || 0));
    const prev = lastLedgerByProduct.get(pid);
    if (!prev || (row.lastLedgerAt && row.lastLedgerAt > prev)) {
      lastLedgerByProduct.set(pid, row.lastLedgerAt);
    }
  }

  const now = Date.now();
  let items = products.map((product) => {
    const pid = String(product._id);
    const rule = ruleByProduct.get(pid);
    const qty = onHandByProduct.get(pid) || 0;
    const cost = product.costPrice || 0;
    const unitCost = product.moneyInPaise ? cost / 100 : cost;
    const lastLedgerAt = lastLedgerByProduct.get(pid) || rule?.updatedAt || null;
    return {
      productId: pid,
      title: product.title,
      sku: product.sku || '',
      stockUnit: product.stockUnit || 'Pcs',
      locationId: null,
      locationPath: 'All locations (product tag)',
      qty,
      unitCost,
      value: unitCost * qty,
      lastLedgerAt,
      isDeadStock: true,
      ageingDays: lastLedgerAt
        ? Math.max(0, Math.floor((now - new Date(lastLedgerAt).getTime()) / 86400000))
        : null,
      statusBucket: 'tagged',
    };
  });

  if (search.trim()) {
    const q = search.trim().toLowerCase();
    items = items.filter(
      (i) => i.title.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q)
    );
  }

  items.sort((a, b) => (b.qty || 0) - (a.qty || 0) || a.title.localeCompare(b.title));
  const total = items.length;
  const start = (page - 1) * limit;
  return {
    items: items.slice(start, start + limit),
    pagination: { page, limit, total },
    totals: {
      qty: items.reduce((s, i) => s + i.qty, 0),
      value: items.reduce((s, i) => s + i.value, 0),
    },
  };
}

export async function getSoldMovementReport({
  search = '',
  from = '',
  to = '',
  page = 1,
  limit = 50,
} = {}) {
  const filter = {
    statusBucket: 'sold',
    $or: [{ type: 'sale_fulfill' }, { reason: 'sold' }],
  };

  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  const total = await StockLedger.countDocuments(filter);
  const entries = await StockLedger.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('productId', 'title sku stockUnit')
    .populate('performedBy', 'name email')
    .lean();

  const allLocs = await listAllLocations();
  const byId = new Map(allLocs.map((l) => [String(l._id), l]));

  let items = entries.map((e) => {
    const product = e.productId;
    return {
      _id: String(e._id),
      productId: product?._id ? String(product._id) : '',
      title: product?.title || '—',
      sku: product?.sku || '',
      stockUnit: product?.stockUnit || 'Pcs',
      qty: Math.abs(e.qty || 0),
      date: e.createdAt,
      userName: e.performedBy?.name || e.performedBy?.email || '—',
      customerRef: e.ref || e.remark || '',
      locationPath: formatBranchFloorRackPath(String(e.locationId), byId),
    };
  });

  if (search.trim()) {
    const q = search.trim().toLowerCase();
    items = items.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.sku.toLowerCase().includes(q) ||
        i.customerRef.toLowerCase().includes(q) ||
        i.userName.toLowerCase().includes(q)
    );
  }

  return {
    items,
    pagination: { page, limit, total },
  };
}
