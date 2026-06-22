import 'server-only';

import mongoose from 'mongoose';
import Product from '@/lib/models/Product';
import Location from '@/lib/models/Location';
import Stock from '@/lib/models/Stock';
import StockLedger from '@/lib/models/StockLedger';
import InventoryRule from '@/lib/models/InventoryRule';
import InventoryStock from '@/lib/models/InventoryStock';
import InventoryTransaction from '@/lib/models/InventoryTransaction';
import InventoryStockRule from '@/lib/models/InventoryStockRule';
import {
  appendLedgerEntry,
  runInTransaction,
  getStockTotalsForProduct,
  recomputeStockProjection,
} from '@/lib/server/inventory/stockLedgerService';

const DEFAULT_LOW_STOCK = 10;

export function deriveStockStatus(sellableQty, lowThreshold = DEFAULT_LOW_STOCK) {
  if (sellableQty <= 0) return 'out';
  if (sellableQty <= lowThreshold) return 'low';
  return 'in_stock';
}

export async function getDefaultLowStockThreshold() {
  const rule = await InventoryStockRule.findOne({ key: 'defaultLowStockThreshold' }).lean();
  const val = rule?.value;
  return typeof val === 'number' && val >= 0 ? val : DEFAULT_LOW_STOCK;
}

/**
 * Aggregate stock rows for a product into a single list view shape.
 */
export async function getProductStockSummary(productId) {
  const totals = await getStockTotalsForProduct(productId);
  const rule = await InventoryRule.findOne({ productId }).lean();
  const threshold = rule?.minStock ?? (await getDefaultLowStockThreshold());

  if (totals.rows.length === 0) {
    const legacy = await getLegacyStockSummary(productId, threshold);
    if (legacy.sellableQty > 0) return legacy;
    return {
      sellableQty: 0,
      holdQty: 0,
      damagedQty: 0,
      condition: 'normal',
      lowStockThreshold: threshold,
      primaryLocation: null,
      locations: [],
      stockStatus: 'out',
    };
  }

  const primary = totals.primary;
  const condition =
    totals.holdQty > 0 ? 'hold' : totals.nonSellableQty > 0 ? 'damaged' : 'normal';

  return {
    sellableQty: totals.sellableQty,
    holdQty: totals.holdQty,
    damagedQty: totals.nonSellableQty,
    condition,
    lowStockThreshold: threshold,
    primaryLocation: primary?.locationId || null,
    locations: totals.rows,
    stockStatus: deriveStockStatus(totals.sellableQty, threshold),
  };
}

async function getLegacyStockSummary(productId, threshold) {
  const rows = await InventoryStock.find({ productId }).lean();
  if (rows.length === 0) {
    return { sellableQty: 0, holdQty: 0, damagedQty: 0, condition: 'normal' };
  }
  const sellableQty = rows.reduce((sum, r) => sum + (r.sellableQty || 0), 0);
  return {
    sellableQty,
    holdQty: rows.reduce((s, r) => s + (r.holdQty || 0), 0),
    damagedQty: rows.reduce((s, r) => s + (r.damagedQty || 0), 0),
    condition: 'normal',
    lowStockThreshold: threshold,
    primaryLocation: null,
    locations: rows,
    stockStatus: deriveStockStatus(sellableQty, threshold),
  };
}

async function ensureStockRow(productId, locationId = null) {
  let row = await InventoryStock.findOne({ productId, locationId: locationId || null });
  if (!row) {
    const defaultThreshold = await getDefaultLowStockThreshold();
    row = await InventoryStock.create({
      productId,
      locationId: locationId || null,
      sellableQty: 0,
      lowStockThreshold: defaultThreshold,
    });
  }
  return row;
}

async function writeTransaction(payload) {
  await InventoryTransaction.create(payload);
}

/**
 * Add or subtract sellable stock via append-only ledger (ledger-first architecture).
 */
export async function adjustStock({
  productId,
  delta,
  locationId = null,
  note = '',
  userId,
}) {
  if (!delta || !Number.isFinite(delta)) {
    throw new Error('Invalid adjustment quantity');
  }

  const product = await Product.findById(productId).select('_id title deletedAt').lean();
  if (!product || product.deletedAt) {
    throw new Error('Product not found');
  }

  const locId = locationId || (await getDefaultLocationIdForProduct(productId));
  if (!locId) {
    throw new Error('No stock location found for this product. Add opening stock first.');
  }

  const absDelta = Math.abs(delta);
  const totals = await getStockTotalsForProduct(productId);
  if (delta < 0 && totals.sellableQty < absDelta) {
    throw new Error('Insufficient sellable quantity');
  }

  await runInTransaction(async (session) => {
    await appendLedgerEntry(
      {
        productId,
        locationId: locId,
        type: delta >= 0 ? 'adjustment_add' : 'adjustment_minus',
        statusBucket: 'sellable',
        qty: delta,
        reason: 'manual_adjustment',
        remark: note || '',
        ratePaise: null,
        performedBy: userId,
      },
      session
    );
  });

  return getProductStockSummary(productId);
}

async function getDefaultLocationIdForProduct(productId) {
  const row = await Stock.findOne({ productId, statusBucket: 'sellable' })
    .sort({ qty: -1 })
    .lean();
  return row?.locationId || null;
}

/**
 * Move sellable qty between two locations.
 */
export async function transferStock({
  productId,
  quantity,
  fromLocationId = null,
  toLocationId,
  note = '',
  userId,
}) {
  const qty = Number(quantity);
  if (!qty || qty <= 0) throw new Error('Transfer quantity must be positive');
  if (!toLocationId) throw new Error('Destination location is required');

  const fromRow = await ensureStockRow(productId, fromLocationId);
  if (fromRow.sellableQty < qty) {
    throw new Error('Insufficient stock at source location');
  }

  const toRow = await ensureStockRow(productId, toLocationId);

  const fromPrev = fromRow.sellableQty;
  const toPrev = toRow.sellableQty;

  fromRow.sellableQty = fromPrev - qty;
  toRow.sellableQty = toPrev + qty;
  await fromRow.save();
  await toRow.save();

  await writeTransaction({
    productId,
    type: 'transfer_out',
    quantity: qty,
    fromLocationId: fromLocationId || null,
    toLocationId,
    previousSellableQty: fromPrev,
    newSellableQty: fromRow.sellableQty,
    note,
    performedBy: userId,
  });

  await writeTransaction({
    productId,
    type: 'transfer_in',
    quantity: qty,
    fromLocationId: fromLocationId || null,
    toLocationId,
    previousSellableQty: toPrev,
    newSellableQty: toRow.sellableQty,
    note,
    performedBy: userId,
  });

  return getProductStockSummary(productId);
}

/**
 * Change stock condition (normal / hold / damaged / dead) without changing sellable qty.
 */
export async function changeStockCondition({
  productId,
  condition,
  locationId = null,
  userId,
  note = '',
}) {
  const row = await ensureStockRow(productId, locationId);
  const previousCondition = row.condition;
  row.condition = condition;
  await row.save();

  await writeTransaction({
    productId,
    type: 'condition_change',
    quantity: 0,
    fromLocationId: locationId || null,
    toLocationId: locationId || null,
    previousCondition,
    newCondition: condition,
    note,
    performedBy: userId,
  });

  return getProductStockSummary(productId);
}

export async function setStockRule({ key, value, userId }) {
  const rule = await InventoryStockRule.findOneAndUpdate(
    { key },
    { value, updatedBy: userId },
    { upsert: true, new: true }
  );
  return rule;
}

export async function buildLocationPath(code, name, parentLocationId) {
  if (!parentLocationId) {
    return name ? `${code} > ${name}` : code;
  }
  const parent = await Location.findById(parentLocationId).lean();
  if (!parent) throw new Error('Parent location not found');
  const segment = name || code;
  return `${parent.path} > ${segment}`;
}

export async function locationHasStock(locationId) {
  const count = await InventoryStock.countDocuments({
    locationId,
    $or: [{ sellableQty: { $gt: 0 } }, { holdQty: { $gt: 0 } }, { damagedQty: { $gt: 0 } }],
  });
  return count > 0;
}

export async function listInventoryItems({
  search = '',
  categoryId = '',
  page = 1,
  limit = 50,
}) {
  const match = {
    deletedAt: null,
    productType: { $in: ['standalone', 'child'] },
  };

  if (categoryId) {
    match.$or = [{ categoryId }, { categoryIds: categoryId }];
  }

  if (search?.trim()) {
    const term = search.trim();
    match.$and = match.$and || [];
    match.$and.push({
      $or: [
        { title: { $regex: term, $options: 'i' } },
        { sku: { $regex: term, $options: 'i' } },
        { barcode: { $regex: term, $options: 'i' } },
        { brand: { $regex: term, $options: 'i' } },
      ],
    });
  }

  const skip = (page - 1) * limit;
  const [products, total] = await Promise.all([
    Product.find(match)
      .select(
        'title slug sku barcode brand costPrice sellingPrice price stockUnit categoryId categoryIds status productType'
      )
      .populate('categoryId', 'name')
      .sort({ title: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Product.countDocuments(match),
  ]);

  const productIds = products.map((p) => p._id);
  const stockRows = await Stock.find({ productId: { $in: productIds } }).lean();
  const rules = await InventoryRule.find({ productId: { $in: productIds } }).lean();
  const ruleByProduct = new Map(rules.map((r) => [String(r.productId), r]));

  const defaultThreshold = await getDefaultLowStockThreshold();
  const stockByProduct = new Map();

  for (const row of stockRows) {
    const pid = String(row.productId);
    if (!stockByProduct.has(pid)) stockByProduct.set(pid, []);
    stockByProduct.get(pid).push(row);
  }

  // Fallback to legacy InventoryStock rows when no ledger projection exists yet.
  const missingIds = productIds.filter((id) => !stockByProduct.has(String(id)));
  if (missingIds.length > 0) {
    const legacyRows = await InventoryStock.find({ productId: { $in: missingIds } }).lean();
    for (const row of legacyRows) {
      const pid = String(row.productId);
      if (!stockByProduct.has(pid)) stockByProduct.set(pid, []);
      stockByProduct.get(pid).push({
        statusBucket: 'sellable',
        qty: row.sellableQty,
        locationId: row.locationId,
      });
    }
  }

  const items = products.map((product) => {
    const pid = String(product._id);
    const rows = stockByProduct.get(pid) || [];
    const sellableQty = rows
      .filter((r) => r.statusBucket === 'sellable' || r.sellableQty != null)
      .reduce((s, r) => s + (r.qty ?? r.sellableQty ?? 0), 0);
    const holdQty = rows
      .filter((r) => r.statusBucket === 'hold')
      .reduce((s, r) => s + (r.qty || 0), 0);
    const rule = ruleByProduct.get(pid);
    const threshold = rule?.minStock ?? defaultThreshold;
    const condition = holdQty > 0 ? 'hold' : 'normal';
    const selling = product.sellingPrice || product.price || 0;
    const cost = product.costPrice || 0;
    const displayCost = product.moneyInPaise ? cost / 100 : cost;
    const displaySelling = product.moneyInPaise ? selling / 100 : selling;

    return {
      _id: product._id,
      title: product.title,
      slug: product.slug,
      sku: product.sku || '',
      barcode: product.barcode || '',
      brand: product.brand || '',
      categoryName: product.categoryId?.name || '',
      costPrice: displayCost,
      sellingPrice: displaySelling,
      moneyInPaise: Boolean(product.moneyInPaise),
      stockUnit: product.stockUnit || 'Pcs',
      catalogStatus: product.status,
      sellableQty,
      stockStatus: deriveStockStatus(sellableQty, threshold),
      condition,
      lowStockThreshold: threshold,
    };
  });

  return {
    items,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  };
}
