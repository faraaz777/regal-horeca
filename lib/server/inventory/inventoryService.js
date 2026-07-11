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
import { buildInventoryLedgerProductQuery } from '@/lib/server/inventory/inventoryProductQuery';
import { STATUS_BUCKETS, STATUS_BUCKET_LABELS } from '@/lib/shared/inventoryConstants';
import { listAllLocations } from '@/lib/server/inventory/locationCrudService';
import {
  formatBranchFloorRackPath,
  formatBranchFloorRackPathCodesWithRackName,
  resolveLocationToCascade,
} from '@/lib/shared/locationDisplay';
import {
  validateNewStockLocation,
  validateMinusStockLocation,
} from '@/lib/server/inventory/locationSelectService';
import { logAudit } from '@/lib/server/audit/logAudit';

async function auditInventoryMovement({
  productId,
  userId,
  actorRole = '',
  request = null,
  movementAction,
  metadata = {},
  beforeTotals,
  afterTotals,
}) {
  await logAudit({
    actorId: userId,
    actorRole,
    action: 'inventory.stock_movement',
    entityType: 'Product',
    entityId: productId,
    before: {
      sellableQty: beforeTotals.sellableQty,
      holdQty: beforeTotals.holdQty,
      scrapQty: beforeTotals.scrapQty,
      buckets: beforeTotals.buckets,
    },
    after: {
      sellableQty: afterTotals.sellableQty,
      holdQty: afterTotals.holdQty,
      scrapQty: afterTotals.scrapQty,
      buckets: afterTotals.buckets,
    },
    metadata: { movementAction, ...metadata },
    request,
  });
}

function resolveHeroImage(product) {
  if (product.heroImage?.trim()) return product.heroImage.trim();
  const galleryImage = Array.isArray(product.gallery) ? product.gallery.find(Boolean) : '';
  if (galleryImage) return galleryImage;
  const parent = product.parentProductId;
  if (parent?.heroImage?.trim()) return parent.heroImage.trim();
  const parentGalleryImage = Array.isArray(parent?.gallery) ? parent.gallery.find(Boolean) : '';
  return parentGalleryImage || '';
}

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
  actorRole = '',
  request = null,
}) {
  if (!delta || !Number.isFinite(delta)) {
    throw new Error('Invalid adjustment quantity');
  }

  const product = await Product.findById(productId).select('_id title deletedAt').lean();
  if (!product || product.deletedAt) {
    throw new Error('Product not found');
  }

  if (!locationId) {
    throw new Error('Select branch, floor, and rack before adjusting stock');
  }
  const locId = locationId;
  if (delta < 0) {
    await validateMinusStockLocation(locId);
  } else {
    await validateNewStockLocation(locId);
  }

  const absDelta = Math.abs(delta);
  const beforeTotals = await getStockTotalsForProduct(productId);
  if (delta < 0 && beforeTotals.sellableQty < absDelta) {
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
        ref: '',
        ratePaise: null,
        performedBy: userId,
      },
      session
    );
  });

  const afterTotals = await getStockTotalsForProduct(productId);
  await auditInventoryMovement({
    productId,
    userId,
    actorRole,
    request,
    movementAction: delta >= 0 ? 'add' : 'minus',
    metadata: { delta, reason: 'manual_adjustment', remark: note || '' },
    beforeTotals,
    afterTotals,
  });

  return getProductStockSummary(productId);
}

function bucketQtyAtLocation(rows, locationId, bucket) {
  return rows
    .filter(
      (r) =>
        String(r.locationId) === String(locationId) && r.statusBucket === bucket
    )
    .reduce((s, r) => s + r.qty, 0);
}

async function enrichStockRowsWithLocationPaths(rows) {
  if (!rows?.length) return [];
  const all = await listAllLocations();
  const byId = new Map(all.map((l) => [String(l._id), l]));
  return rows.map((r) => {
    const cascade = resolveLocationToCascade(String(r.locationId), byId);
    return {
      ...r,
      locationPath: cascade.displayPath || formatBranchFloorRackPath(String(r.locationId), byId),
      branchId: cascade.branchId,
      floorId: cascade.floorId,
      rackId: cascade.rackId,
    };
  });
}

function aggregateStockByLocation(rows, locationById) {
  const byLoc = new Map();

  for (const row of rows) {
    const qty = row.qty ?? row.sellableQty ?? 0;
    if (!qty || qty <= 0) continue;

    const locKey = row.locationId ? String(row.locationId) : 'unassigned';
    if (!byLoc.has(locKey)) {
      byLoc.set(locKey, {
        locationId: locKey === 'unassigned' ? null : locKey,
        locationPath:
          locKey === 'unassigned'
            ? '—'
            : formatBranchFloorRackPathCodesWithRackName(locKey, locationById),
        locationPathFull:
          locKey === 'unassigned'
            ? '—'
            : formatBranchFloorRackPath(locKey, locationById),
        sellableQty: 0,
        holdQty: 0,
        scrapQty: 0,
        totalQty: 0,
      });
    }

    const agg = byLoc.get(locKey);
    agg.totalQty += qty;

    const bucket = row.statusBucket || (row.sellableQty != null ? 'sellable' : null);
    if (bucket === 'sellable' || row.sellableQty != null) {
      agg.sellableQty += qty;
    } else if (bucket === 'hold') {
      agg.holdQty += qty;
    } else if (bucket === 'scrap') {
      agg.scrapQty += qty;
    } else {
      agg.sellableQty += qty;
    }
  }

  return [...byLoc.values()]
    .filter((loc) => loc.totalQty > 0)
    .sort((a, b) => b.totalQty - a.totalQty);
}

export async function getProductInventoryRule(productId) {
  const rule = await InventoryRule.findOne({ productId }).lean();
  if (!rule) return null;

  const openingEntry = await StockLedger.findOne({ productId, type: 'opening' })
    .sort({ createdAt: 1 })
    .select('statusBucket deadStockMarked remark createdAt')
    .lean();

  return {
    minStock: rule.minStock,
    maxStock: rule.maxStock,
    reorderQty: rule.reorderQty ?? 0,
    deadStockPeriod: rule.deadStockPeriod,
    deadStockQty: rule.deadStockQty,
    deadStockMarked: Boolean(rule.deadStockMarked),
    openingStatusBucket: openingEntry?.statusBucket || null,
    gateRemark: openingEntry?.remark?.trim() || '',
    setAt: rule.createdAt,
    updatedAt: rule.updatedAt,
    openingLedgerId: openingEntry?._id ? String(openingEntry._id) : null,
  };
}

/**
 * Update per-product inventory gate rules.
 * Restricted to super_admin and inventory_manager at the API layer.
 */
export async function updateProductInventoryRule({
  productId,
  payload,
  userId,
  actorRole = '',
  request = null,
}) {
  const product = await Product.findById(productId).select('_id title deletedAt').lean();
  if (!product || product.deletedAt) {
    throw new Error('Product not found');
  }

  const rule = await InventoryRule.findOne({ productId });
  if (!rule) {
    throw new Error('No inventory rules found for this product');
  }

  const before = {
    minStock: rule.minStock,
    maxStock: rule.maxStock,
    reorderQty: rule.reorderQty ?? 0,
    deadStockPeriod: rule.deadStockPeriod,
    deadStockQty: rule.deadStockQty,
    deadStockMarked: Boolean(rule.deadStockMarked),
  };

  rule.minStock = payload.minStock;
  rule.maxStock = payload.maxStock;
  rule.reorderQty = payload.reorderQty ?? 0;
  rule.deadStockPeriod = payload.deadStockPeriod;
  rule.deadStockQty = payload.deadStockQty;
  rule.deadStockMarked = Boolean(payload.deadStockMarked);
  await rule.save();

  const openingEntry = await StockLedger.findOne({ productId, type: 'opening' })
    .sort({ createdAt: 1 })
    .select('_id remark')
    .lean();

  if (openingEntry && payload.gateRemark !== undefined) {
    await StockLedger.updateOne(
      { _id: openingEntry._id },
      { $set: { remark: payload.gateRemark || '' } }
    );
  }

  const after = {
    minStock: rule.minStock,
    maxStock: rule.maxStock,
    reorderQty: rule.reorderQty ?? 0,
    deadStockPeriod: rule.deadStockPeriod,
    deadStockQty: rule.deadStockQty,
    deadStockMarked: Boolean(rule.deadStockMarked),
    gateRemark: payload.gateRemark ?? '',
  };

  await logAudit({
    actorId: userId,
    actorRole,
    action: 'inventory.rule_update',
    entityType: 'Product',
    entityId: productId,
    before,
    after,
    metadata: { productTitle: product.title },
    request,
  });

  return getProductInventoryRule(productId);
}

export async function getProductStockDetail(productId) {
  const product = await Product.findById(productId)
    .select('title sku stockUnit slug')
    .lean();
  if (!product || product.deletedAt) {
    throw new Error('Product not found');
  }

  const [totals, summary, locations, inventoryRule] = await Promise.all([
    getStockTotalsForProduct(productId),
    getProductStockSummary(productId),
    getStockTotalsForProduct(productId).then((t) => enrichStockRowsWithLocationPaths(t.rows)),
    getProductInventoryRule(productId),
  ]);

  return {
    product: {
      _id: product._id,
      title: product.title,
      sku: product.sku || '',
      stockUnit: product.stockUnit || 'Pcs',
      slug: product.slug,
    },
    sellableQty: totals.sellableQty,
    holdQty: totals.holdQty,
    nonSellableQty: totals.nonSellableQty,
    scrapQty: totals.scrapQty,
    displayQty: totals.displayQty,
    deadStockQty: totals.deadStockQty,
    buckets: totals.buckets,
    locations,
    stockStatus: summary.stockStatus,
    condition: summary.condition,
    inventoryRule,
  };
}

export async function recordStockMovement({
  productId,
  action,
  quantity,
  statusBucket = 'sellable',
  fromBucket = 'sellable',
  toBucket = 'sellable',
  reason = 'manual_adjustment',
  remark = '',
  ref = '',
  locationId = null,
  fromLocationId = null,
  toLocationId = null,
  userId,
  actorRole = '',
  request = null,
}) {
  const product = await Product.findById(productId).select('_id deletedAt').lean();
  if (!product || product.deletedAt) {
    throw new Error('Product not found');
  }

  const qty = Number(quantity);
  if (!qty || qty <= 0) {
    throw new Error('Quantity must be positive');
  }

  const beforeTotals = await getStockTotalsForProduct(productId);

  if (action === 'transfer') {
    const fromLoc = fromLocationId || locationId;
    if (!fromLoc) throw new Error('Select source branch, floor, and rack');
    if (!toLocationId) throw new Error('Select destination branch, floor, and rack');
    await validateMinusStockLocation(fromLoc);
    await validateNewStockLocation(toLocationId);
    const result = await transferStock({
      productId,
      quantity: qty,
      fromLocationId: fromLoc,
      toLocationId,
      note: remark,
      ref,
      userId,
      actorRole,
      request,
      beforeTotals,
    });
    return result;
  }

  const locId = locationId || fromLocationId;
  if (!locId) {
    throw new Error('Select branch, floor, and rack before posting this movement');
  }

  if (action === 'minus' || action === 'status_change') {
    await validateMinusStockLocation(locId);
  } else {
    await validateNewStockLocation(locId);
  }

  if (action === 'status_change') {
    if (!STATUS_BUCKETS.includes(fromBucket) || !STATUS_BUCKETS.includes(toBucket)) {
      throw new Error('Invalid status bucket');
    }
    if (fromBucket === toBucket) {
      throw new Error('From and to status must be different');
    }

    const totals = await getStockTotalsForProduct(productId);
    const available = bucketQtyAtLocation(totals.rows, locId, fromBucket);
    if (available < qty) {
      throw new Error(`Insufficient quantity in ${fromBucket.replace('_', ' ')}`);
    }

    await runInTransaction(async (session) => {
      await appendLedgerEntry(
        {
          productId,
          locationId: locId,
          type: 'condition_change',
          statusBucket: fromBucket,
          qty: -qty,
          reason: reason || 'manual_adjustment',
          remark: remark || '',
          ref: ref || '',
          ratePaise: null,
          performedBy: userId,
        },
        session
      );
      await appendLedgerEntry(
        {
          productId,
          locationId: locId,
          type: 'condition_change',
          statusBucket: toBucket,
          qty,
          reason: reason || 'manual_adjustment',
          remark: remark || '',
          ref: ref || '',
          ratePaise: null,
          performedBy: userId,
        },
        session
      );
    });

    const afterTotals = await getStockTotalsForProduct(productId);
    await auditInventoryMovement({
      productId,
      userId,
      actorRole,
      request,
      movementAction: 'status_change',
      metadata: {
        quantity: qty,
        fromBucket,
        toBucket,
        reason,
        remark,
        ref,
        locationId: locId,
      },
      beforeTotals,
      afterTotals,
    });

    return getProductStockDetail(productId);
  }

  if (!STATUS_BUCKETS.includes(statusBucket)) {
    throw new Error('Invalid status bucket');
  }

  if (action === 'minus') {
    if (!locationId) {
      throw new Error('Select the location to remove stock from');
    }
    const totals = await getStockTotalsForProduct(productId);
    const available = bucketQtyAtLocation(totals.rows, locId, statusBucket);
    if (qty > available) {
      const enriched = await enrichStockRowsWithLocationPaths(totals.rows);
      const row = enriched.find(
        (r) => String(r.locationId) === String(locId) && r.statusBucket === statusBucket
      );
      const bucketLabel = STATUS_BUCKET_LABELS[statusBucket] || statusBucket;
      throw new Error(
        `Cannot remove ${qty} — only ${available} ${bucketLabel} available at ${row?.locationPath || 'selected location'}`
      );
    }
  }

  const signedQty = action === 'minus' ? -qty : qty;

  await runInTransaction(async (session) => {
    await appendLedgerEntry(
      {
        productId,
        locationId: locId,
        type: signedQty >= 0 ? 'adjustment_add' : 'adjustment_minus',
        statusBucket,
        qty: signedQty,
        reason: reason || 'manual_adjustment',
        remark: remark || '',
        ref: ref || '',
        ratePaise: null,
        performedBy: userId,
      },
      session
    );
  });

  const afterTotals = await getStockTotalsForProduct(productId);
  await auditInventoryMovement({
    productId,
    userId,
    actorRole,
    request,
    movementAction: action,
    metadata: {
      quantity: qty,
      statusBucket,
      reason,
      remark,
      ref,
      locationId: locId,
    },
    beforeTotals,
    afterTotals,
  });

  return getProductStockDetail(productId);
}

async function getDefaultLocationIdForProduct(productId) {
  const row = await Stock.findOne({ productId, statusBucket: 'sellable' })
    .sort({ qty: -1 })
    .lean();
  return row?.locationId || null;
}

/**
 * Move sellable qty between two locations via append-only ledger entries.
 */
export async function transferStock({
  productId,
  quantity,
  fromLocationId = null,
  toLocationId,
  note = '',
  ref = '',
  userId,
  actorRole = '',
  request = null,
  beforeTotals = null,
}) {
  const qty = Number(quantity);
  if (!qty || qty <= 0) throw new Error('Transfer quantity must be positive');
  if (!toLocationId) throw new Error('Destination location is required');

  const fromLocId = fromLocationId;
  if (!fromLocId) throw new Error('Source branch, floor, and rack are required');

  const totalsBefore = beforeTotals || (await getStockTotalsForProduct(productId));
  const available = bucketQtyAtLocation(totalsBefore.rows, fromLocId, 'sellable');
  if (available < qty) {
    throw new Error('Insufficient stock at source location');
  }

  await runInTransaction(async (session) => {
    await appendLedgerEntry(
      {
        productId,
        locationId: fromLocId,
        type: 'transfer_out',
        statusBucket: 'sellable',
        qty: -qty,
        reason: 'transfer',
        remark: note || '',
        ref: ref || '',
        ratePaise: null,
        performedBy: userId,
      },
      session
    );
    await appendLedgerEntry(
      {
        productId,
        locationId: toLocationId,
        type: 'transfer_in',
        statusBucket: 'sellable',
        qty,
        reason: 'transfer',
        remark: note || '',
        ref: ref || '',
        ratePaise: null,
        performedBy: userId,
      },
      session
    );
  });

  const afterTotals = await getStockTotalsForProduct(productId);
  await auditInventoryMovement({
    productId,
    userId,
    actorRole,
    request,
    movementAction: 'transfer',
    metadata: {
      quantity: qty,
      fromLocationId: fromLocId,
      toLocationId,
      remark: note || '',
      ref: ref || '',
    },
    beforeTotals: totalsBefore,
    afterTotals,
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
  const match = await buildInventoryLedgerProductQuery({ search, categoryId });

  const skip = (page - 1) * limit;
  const [products, total] = await Promise.all([
    Product.find(match)
      .select(
        'title slug sku barcode brand costPrice sellingPrice price stockUnit categoryId categoryIds status productType heroImage gallery parentProductId'
      )
      .populate('categoryId', 'name')
      .populate('parentProductId', 'heroImage gallery')
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
  const allLocations = await listAllLocations();
  const locationById = new Map(allLocations.map((l) => [String(l._id), l]));

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
    const scrapQty = rows
      .filter((r) => r.statusBucket === 'scrap')
      .reduce((s, r) => s + (r.qty || 0), 0);
    const rule = ruleByProduct.get(pid);
    const threshold = rule?.minStock ?? defaultThreshold;
    const condition = holdQty > 0 ? 'hold' : 'normal';
    const stockLocations = aggregateStockByLocation(rows, locationById);
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
      heroImage: resolveHeroImage(product),
      costPrice: displayCost,
      sellingPrice: displaySelling,
      moneyInPaise: Boolean(product.moneyInPaise),
      stockUnit: product.stockUnit || 'Pcs',
      catalogStatus: product.status,
      sellableQty,
      holdQty,
      scrapQty,
      stockStatus: deriveStockStatus(sellableQty, threshold),
      condition,
      lowStockThreshold: threshold,
      stockLocations,
    };
  });

  return {
    items,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  };
}
