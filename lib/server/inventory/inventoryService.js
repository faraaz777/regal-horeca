import 'server-only';

import mongoose from 'mongoose';
import Product from '@/lib/models/Product';
import Location from '@/lib/models/Location';
import Stock from '@/lib/models/Stock';
import StockLedger from '@/lib/models/StockLedger';
import InventoryRule from '@/lib/models/InventoryRule';
import InventoryStockRule from '@/lib/models/InventoryStockRule';
import {
  appendLedgerEntry,
  runInTransaction,
  getStockTotalsForProduct,
  recomputeStockProjection,
} from '@/lib/server/inventory/stockLedgerService';
import { buildInventoryLedgerProductQuery, getInventoryTrackedProductIds, inventoryProductBaseFilter } from '@/lib/server/inventory/inventoryProductQuery';
import {
  STATUS_BUCKETS,
  MAX_MOVEMENT_LINES,
} from '@/lib/shared/inventoryConstants';
import { listAllLocations } from '@/lib/server/inventory/locationCrudService';
import {
  formatBranchFloorRackPath,
  formatBranchFloorRackPathCodes,
  formatBranchFloorRackPathCodesWithRackName,
  resolveLocationToCascade,
} from '@/lib/shared/locationDisplay';
import {
  validateNewStockLocation,
  validateMinusStockLocation,
} from '@/lib/server/inventory/locationSelectService';
import { logAudit } from '@/lib/server/audit/logAudit';
import { logDeadStockTagChange } from '@/lib/server/inventory/deadStockAudit';

/**
 * Merge duplicate location lines and drop empty/invalid qty.
 * Shared by batch add and batch minus so both enforce the same payload shape.
 */
function normalizeMovementLines(lines) {
  if (!Array.isArray(lines) || lines.length === 0) {
    return [];
  }

  if (lines.length > MAX_MOVEMENT_LINES) {
    throw new Error(`At most ${MAX_MOVEMENT_LINES} locations per movement`);
  }

  const byLocation = new Map();
  for (const line of lines) {
    const locationId = line?.locationId;
    const quantity = Number(line?.quantity);
    if (!locationId || !quantity || quantity <= 0) continue;
    const key = String(locationId);
    byLocation.set(key, (byLocation.get(key) || 0) + quantity);
  }

  return [...byLocation.entries()].map(([locationId, quantity]) => ({
    locationId,
    quantity,
  }));
}

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
      soldQty: beforeTotals.soldQty,
      buckets: beforeTotals.buckets,
    },
    after: {
      sellableQty: afterTotals.sellableQty,
      soldQty: afterTotals.soldQty,
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

/**
 * Availability from sellableQty (physical warehouse pieces).
 * Dead-stock TAG does not change availability.
 */
export function deriveStockStatus(sellableQty, lowThreshold = DEFAULT_LOW_STOCK) {
  if (sellableQty <= 0) return 'out';
  if (sellableQty <= lowThreshold) return 'low';
  return 'in_stock';
}

/**
 * Condition = product-wide dead-stock TAG (InventoryRule.deadStockMarked).
 * Does not block sales — label only.
 */
export function deriveInventoryCondition(deadStockMarked) {
  return deadStockMarked ? 'HAS_DEAD_STOCK' : 'NORMAL';
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
    return {
      sellableQty: 0,
      soldQty: 0,
      holdQty: 0,
      damagedQty: 0,
      condition: 'NORMAL',
      isDeadStock: false,
      deadStockMarked: false,
      lowStockThreshold: threshold,
      primaryLocation: null,
      locations: [],
      stockStatus: 'out',
    };
  }

  const primary = totals.primary;

  return {
    sellableQty: totals.sellableQty,
    soldQty: totals.soldQty,
    holdQty: 0,
    damagedQty: 0,
    condition: deriveInventoryCondition(Boolean(rule?.deadStockMarked)),
    isDeadStock: Boolean(rule?.deadStockMarked),
    deadStockMarked: Boolean(rule?.deadStockMarked),
    lowStockThreshold: threshold,
    primaryLocation: primary?.locationId || null,
    locations: totals.rows.filter((r) => r.statusBucket === 'sellable'),
    stockStatus: deriveStockStatus(totals.sellableQty, threshold),
  };
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

/** On-hand at a location (excludes sold history). */
function onHandQtyAtLocation(rows, locationId) {
  return rows
    .filter(
      (r) =>
        String(r.locationId) === String(locationId) && r.statusBucket !== 'sold'
    )
    .reduce((s, r) => s + r.qty, 0);
}

async function enrichStockRowsWithLocationPaths(rows) {
  if (!rows?.length) return [];
  const all = await listAllLocations();
  const byId = new Map(all.map((l) => [String(l._id), l]));
  return rows.map((r) => {
    const cascade = resolveLocationToCascade(String(r.locationId), byId);
    const rack = cascade.rackId ? byId.get(String(cascade.rackId)) : null;
    const loc = byId.get(String(r.locationId));
    const leaf = rack || loc;
    return {
      ...r,
      locationPath: cascade.displayPath || formatBranchFloorRackPath(String(r.locationId), byId),
      locationCodePath: formatBranchFloorRackPathCodes(String(r.locationId), byId),
      locationCode: leaf?.code?.trim() || '',
      locationName: leaf?.name?.trim() || '',
      branchId: cascade.branchId,
      floorId: cascade.floorId,
      rackId: cascade.rackId,
    };
  });
}

function aggregateStockByLocation(rows, locationById) {
  const byLoc = new Map();

  for (const row of rows) {
    // Sold is history — never show as on-hand at a location.
    if (row.statusBucket === 'sold') continue;

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
    // All physical qty is on-hand; dead stock is a product tag, not a location split
    agg.sellableQty += qty;
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

  /**
   * Dedicated dead-stock history entry when the TAG flips.
   * Stock movements ledger stays qty-only.
   */
  if (before.deadStockMarked !== after.deadStockMarked) {
    await logDeadStockTagChange({
      productId,
      productTitle: product.title,
      previousMarked: before.deadStockMarked,
      nextMarked: after.deadStockMarked,
      source: 'manual',
      reason: after.deadStockMarked
        ? 'Manually marked as dead stock'
        : 'Manually cleared dead stock tag',
      userId,
      actorRole,
      request,
      metadata: {
        deadStockPeriod: after.deadStockPeriod,
        deadStockQty: after.deadStockQty,
      },
    });
  }
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
    isDeadStock: Boolean(summary.isDeadStock),
    deadStockMarked: Boolean(summary.isDeadStock),
    soldQty: totals.soldQty,
    holdQty: 0,
    nonSellableQty: 0,
    scrapQty: 0,
    displayQty: 0,
    buckets: totals.buckets,
    // Sellable locations only (exclude sold history projection rows)
    locations: locations.filter((r) => r.statusBucket === 'sellable'),
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

  if (action === 'minus') {
    await validateMinusStockLocation(locId);
  } else {
    await validateNewStockLocation(locId);
  }

  /**
   * Physical stock movements always write the on-hand (sellable) bucket.
   * Dead stock is a product-wide tag on InventoryRule — not a qty destination.
   */
  let effectiveBucket = 'sellable';
  if (action === 'add' || action === 'minus') {
    effectiveBucket = 'sellable';
  } else if (statusBucket && !STATUS_BUCKETS.includes(statusBucket)) {
    throw new Error('Invalid status bucket');
  }

  if (action === 'minus') {
    if (!locationId) {
      throw new Error('Select the location to remove stock from');
    }
    const totals = await getStockTotalsForProduct(productId);
    const available = onHandQtyAtLocation(totals.rows, locId);
    if (qty > available) {
      const enriched = await enrichStockRowsWithLocationPaths(totals.rows);
      const row = enriched.find(
        (r) => String(r.locationId) === String(locId) && r.statusBucket !== 'sold'
      );
      throw new Error(
        `Cannot remove ${qty} — only ${available} available at ${row?.locationPath || 'selected location'}`
      );
    }
  }

  const signedQty = action === 'minus' ? -qty : qty;
  const isSale =
    action === 'minus' && (reason === 'sold' || reason === 'sale_fulfill');

  await runInTransaction(async (session) => {
    await appendLedgerEntry(
      {
        productId,
        locationId: locId,
        type: signedQty >= 0 ? 'adjustment_add' : 'adjustment_minus',
        statusBucket: effectiveBucket,
        qty: signedQty,
        reason: reason || 'manual_adjustment',
        remark: remark || '',
        ref: ref || '',
        ratePaise: null,
        performedBy: userId,
      },
      session
    );

    // Sold history: companion positive sold entry for reports (does not affect on-hand).
    if (isSale) {
      await appendLedgerEntry(
        {
          productId,
          locationId: locId,
          type: 'sale_fulfill',
          statusBucket: 'sold',
          qty,
          reason: 'sold',
          remark: remark || '',
          ref: ref || '',
          ratePaise: null,
          performedBy: userId,
        },
        session
      );
    }
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
      statusBucket: effectiveBucket,
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

/**
 * Remove stock from one or more locations in a single transaction.
 *
 * Used when operators split a minus across multiple racks in one action.
 * All lines share the same reason; each line gets its own ledger entry.
 */
export async function recordBatchStockMinus({
  productId,
  lines,
  reason = 'sold',
  remark = '',
  ref = '',
  userId,
  actorRole = '',
  request = null,
}) {
  const product = await Product.findById(productId).select('_id deletedAt').lean();
  if (!product || product.deletedAt) {
    throw new Error('Product not found');
  }

  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error('Enter quantity to remove from at least one location');
  }

  const normalized = normalizeMovementLines(lines);

  if (normalized.length === 0) {
    throw new Error('Enter quantity to remove from at least one location');
  }

  const beforeTotals = await getStockTotalsForProduct(productId);
  const enriched = await enrichStockRowsWithLocationPaths(beforeTotals.rows);

  for (const line of normalized) {
    await validateMinusStockLocation(line.locationId);
    const available = onHandQtyAtLocation(beforeTotals.rows, line.locationId);
    if (line.quantity > available) {
      const row = enriched.find(
        (r) => String(r.locationId) === String(line.locationId) && r.statusBucket !== 'sold'
      );
      throw new Error(
        `Cannot remove ${line.quantity} — only ${available} available at ${row?.locationPath || 'selected location'}`
      );
    }
  }

  const isSale = reason === 'sold' || reason === 'sale_fulfill';
  const totalQty = normalized.reduce((sum, line) => sum + line.quantity, 0);

  await runInTransaction(async (session) => {
    for (const line of normalized) {
      await appendLedgerEntry(
        {
          productId,
          locationId: line.locationId,
          type: 'adjustment_minus',
          statusBucket: 'sellable',
          qty: -line.quantity,
          reason: reason || 'manual_adjustment',
          remark: remark || '',
          ref: ref || '',
          ratePaise: null,
          performedBy: userId,
        },
        session
      );

      if (isSale) {
        await appendLedgerEntry(
          {
            productId,
            locationId: line.locationId,
            type: 'sale_fulfill',
            statusBucket: 'sold',
            qty: line.quantity,
            reason: 'sold',
            remark: remark || '',
            ref: ref || '',
            ratePaise: null,
            performedBy: userId,
          },
          session
        );
      }
    }
  });

  const afterTotals = await getStockTotalsForProduct(productId);
  await auditInventoryMovement({
    productId,
    userId,
    actorRole,
    request,
    movementAction: 'minus',
    metadata: {
      quantity: totalQty,
      statusBucket: 'sellable',
      reason,
      remark,
      ref,
      lines: normalized,
    },
    beforeTotals,
    afterTotals,
  });

  return getProductStockDetail(productId);
}

/**
 * Add stock to one or more locations in a single transaction.
 *
 * Supports topping up existing racks and first placement on new racks.
 */
export async function recordBatchStockAdd({
  productId,
  lines,
  reason = 'purchase',
  remark = '',
  ref = '',
  userId,
  actorRole = '',
  request = null,
}) {
  const product = await Product.findById(productId).select('_id deletedAt').lean();
  if (!product || product.deletedAt) {
    throw new Error('Product not found');
  }

  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error('Enter quantity to add at least one location');
  }

  const normalized = normalizeMovementLines(lines);

  if (normalized.length === 0) {
    throw new Error('Enter quantity to add at least one location');
  }

  const beforeTotals = await getStockTotalsForProduct(productId);

  for (const line of normalized) {
    await validateNewStockLocation(line.locationId);
  }

  const totalQty = normalized.reduce((sum, line) => sum + line.quantity, 0);

  await runInTransaction(async (session) => {
    for (const line of normalized) {
      await appendLedgerEntry(
        {
          productId,
          locationId: line.locationId,
          type: 'adjustment_add',
          statusBucket: 'sellable',
          qty: line.quantity,
          reason: reason || 'manual_adjustment',
          remark: remark || '',
          ref: ref || '',
          ratePaise: null,
          performedBy: userId,
        },
        session
      );
    }
  });

  const afterTotals = await getStockTotalsForProduct(productId);
  await auditInventoryMovement({
    productId,
    userId,
    actorRole,
    request,
    movementAction: 'add',
    metadata: {
      quantity: totalQty,
      statusBucket: 'sellable',
      reason,
      remark,
      ref,
      lines: normalized,
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
  const available = onHandQtyAtLocation(totalsBefore.rows, fromLocId);
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
  const count = await Stock.countDocuments({
    locationId,
    statusBucket: 'sellable',
    qty: { $gt: 0 },
  });
  return count > 0;
}

export async function listInventoryBrands() {
  const trackedIds = await getInventoryTrackedProductIds();
  if (trackedIds.length === 0) return [];

  const brands = await Product.distinct('brand', {
    ...inventoryProductBaseFilter(),
    _id: { $in: trackedIds },
    brand: { $exists: true, $nin: [null, ''] },
  });

  return brands
    .map((b) => String(b).trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

function mapProductsToInventoryItems(products, stockByProduct, ruleByProduct, locationById, defaultThreshold) {
  return products.map((product) => {
    const pid = String(product._id);
    const rows = stockByProduct.get(pid) || [];
    const onHandQty = rows
      .filter((r) => r.statusBucket === 'sellable')
      .reduce((s, r) => s + (r.qty ?? r.sellableQty ?? 0), 0);
    const soldQty = rows
      .filter((r) => r.statusBucket === 'sold')
      .reduce((s, r) => s + (r.qty || 0), 0);
    const rule = ruleByProduct.get(pid);
    const threshold = rule?.minStock ?? defaultThreshold;
    const isDeadStock = Boolean(rule?.deadStockMarked);
    const condition = deriveInventoryCondition(isDeadStock);
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
      sellableQty: onHandQty,
      isDeadStock,
      deadStockMarked: isDeadStock,
      soldQty,
      holdQty: 0,
      scrapQty: 0,
      stockStatus: deriveStockStatus(onHandQty, threshold),
      condition,
      lowStockThreshold: threshold,
      stockLocations,
    };
  });
}

async function loadStockContextForProducts(productIds) {
  const stockRows = await Stock.find({ productId: { $in: productIds } }).lean();
  const rules = await InventoryRule.find({ productId: { $in: productIds } }).lean();
  const ruleByProduct = new Map(rules.map((r) => [String(r.productId), r]));
  const defaultThreshold = await getDefaultLowStockThreshold();
  const allLocations = await listAllLocations();
  const locationById = new Map(allLocations.map((l) => [String(l._id), l]));
  const stockByProduct = new Map();

  for (const row of stockRows) {
    const pid = String(row.productId);
    if (!stockByProduct.has(pid)) stockByProduct.set(pid, []);
    stockByProduct.get(pid).push(row);
  }

  return { stockByProduct, ruleByProduct, locationById, defaultThreshold };
}

const PRODUCT_LIST_SELECT =
  'title slug sku barcode brand costPrice sellingPrice price stockUnit categoryId categoryIds status productType heroImage gallery parentProductId';

export async function listInventoryItems({
  search = '',
  categoryId = '',
  brand = '',
  stockStatus = '',
  condition = '',
  page = 1,
  limit = 50,
}) {
  const match = await buildInventoryLedgerProductQuery({ search, categoryId, brand });
  const statusFilter = String(stockStatus || '').trim();
  const conditionFilter = String(condition || '').trim();
  const needsPostFilter = Boolean(statusFilter || conditionFilter);
  const skip = (page - 1) * limit;

  const productQuery = Product.find(match)
    .select(PRODUCT_LIST_SELECT)
    .populate('categoryId', 'name')
    .populate('parentProductId', 'heroImage gallery')
    .sort({ title: 1 });

  let products;
  if (needsPostFilter) {
    products = await productQuery.lean();
  } else {
    products = await productQuery.skip(skip).limit(limit).lean();
  }

  const productIds = products.map((p) => p._id);
  const { stockByProduct, ruleByProduct, locationById, defaultThreshold } =
    await loadStockContextForProducts(productIds);

  let items = mapProductsToInventoryItems(
    products,
    stockByProduct,
    ruleByProduct,
    locationById,
    defaultThreshold
  );

  if (statusFilter) {
    items = items.filter((item) => item.stockStatus === statusFilter);
  }
  if (conditionFilter) {
    items = items.filter((item) => item.condition === conditionFilter);
  }

  let total;
  if (needsPostFilter) {
    total = items.length;
    items = items.slice(skip, skip + limit);
  } else {
    total = await Product.countDocuments(match);
  }

  return {
    items,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  };
}
