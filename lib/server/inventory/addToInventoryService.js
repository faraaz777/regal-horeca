import 'server-only';

import mongoose from 'mongoose';
import Product from '@/lib/models/Product';
import Location from '@/lib/models/Location';
import InventoryRule from '@/lib/models/InventoryRule';
import Vendor from '@/lib/models/Vendor';
import { generateUniqueSlug } from '@/lib/utils/slug';
import { assertUniqueSkuBarcode } from '@/lib/server/inventory/productIdentityValidation';
import {
  appendLedgerEntry,
  runInTransaction,
  productHasLedgerEntries,
} from '@/lib/server/inventory/stockLedgerService';
import { writeAuditLog } from '@/lib/server/audit/writeAuditLog';
import { buildInventoryProductQuery } from '@/lib/server/inventory/inventoryProductQuery';
import { validateNewStockLocation } from '@/lib/server/inventory/locationSelectService';

export async function searchInventoryProducts(query, limit = 50) {
  const match = await buildInventoryProductQuery({ search: query });

  return Product.find(match)
    .select(
      'title slug sku barcode hsnCode brand colour stockUnit productStatus costPrice mrp sellingPrice price moneyInPaise heroImage gallery productType parentProductId categoryId departmentId'
    )
    .populate('categoryId', 'name')
    .populate('departmentId', 'name')
    .populate('parentProductId', 'heroImage gallery')
    .limit(limit)
    .lean();
}

export async function listActiveVendors() {
  return Vendor.find({ isActive: true }).sort({ name: 1 }).select('name code').lean();
}

function normalizeOpeningLocationIds(opening) {
  if (opening.locationIds?.length) {
    return [...new Set(opening.locationIds.map(String))];
  }
  if (opening.locationId) {
    return [String(opening.locationId)];
  }
  return [];
}

function normalizeOpeningEntries(opening) {
  if (opening.locationEntries?.length) {
    return opening.locationEntries.map((entry) => ({
      locationId: String(entry.locationId),
      qty: Number(entry.qty),
    }));
  }
  const ids = normalizeOpeningLocationIds(opening);
  const qty = Number(opening.openingQty);
  return ids.map((locationId) => ({ locationId, qty }));
}

/**
 * Opening qty is the master pool; every unit must be allocated to a rack before intake.
 */
function assertOpeningAllocationBalanced(opening) {
  const entries = normalizeOpeningEntries(opening);
  const openingQty = Number(opening.openingQty);

  if (!openingQty || openingQty < 1) {
    throw new Error('Opening quantity is required');
  }

  if (!entries.length) {
    throw new Error('Select at least one branch, floor, and rack');
  }

  const allocated = entries.reduce((sum, entry) => sum + entry.qty, 0);
  if (allocated !== openingQty) {
    throw new Error(
      `Allocation mismatch: ${allocated} allocated, ${openingQty} expected`
    );
  }

  const uniqueIds = new Set(entries.map((e) => e.locationId));
  if (uniqueIds.size !== entries.length) {
    throw new Error('Duplicate rack in allocation');
  }

  return entries;
}

async function validateOpeningLocations(entries) {
  if (!entries.length) {
    throw new Error('Select at least one branch, floor, and rack');
  }
  for (const { locationId, qty } of entries) {
    if (!qty || qty < 1) {
      throw new Error('Each location must have a quantity of at least 1');
    }
    await validateNewStockLocation(locationId);
    const location = await Location.findById(locationId).lean();
    if (!location || !location.isActive) {
      throw new Error('One or more selected racks are invalid or inactive');
    }
  }
}

function buildOpeningLedgerEntry(opening, productId, performedBy, locationId, qty) {
  return {
    productId,
    locationId,
    type: 'opening',
    statusBucket: opening.openingStatusBucket || 'sellable',
    qty,
    reason: opening.openingReason,
    remark: opening.remark || '',
    deadStockMarked: Boolean(opening.markAsDeadStock),
    ratePaise:
      opening.openingReason === 'purchase' ? opening.openingRatePaise : opening.openingRatePaise ?? null,
    performedBy,
  };
}

function buildInventoryRulePayload(opening, productId, createdBy) {
  return {
    productId,
    minStock: opening.minStock,
    maxStock: opening.maxStock,
    reorderQty: opening.reorderQty,
    deadStockPeriod: opening.deadStockPeriod,
    deadStockQty: opening.deadStockQty,
    deadStockMarked: Boolean(opening.markAsDeadStock),
    createdBy,
  };
}

function buildProductDocFromMaster(master) {
  return {
    title: master.name,
    sku: master.sku.trim(),
    barcode: master.barcode.trim(),
    colour: master.colour || '',
    brand: master.brand,
    departmentId: master.departmentId,
    categoryId: master.categoryId,
    categoryIds: [master.categoryId],
    stockUnit: master.unit,
    hsnCode: master.hsnCode,
    gstPercent: master.gstPercent,
    costPrice: master.costPaise,
    mrp: master.mrpPaise,
    sellingPrice: master.sellingPricePaise,
    price: master.sellingPricePaise,
    maxDiscountPercent: master.maxDiscountPercent ?? 0,
    vendorId: master.vendorId || null,
    productStatus: master.productStatus,
    heroImage: master.heroImage || 'https://placehold.co/400x400?text=Product',
    moneyInPaise: true,
    productType: 'standalone',
    status: 'In Stock',
    visibleOnClient: master.productStatus === 'active',
    showInCatalog: master.productStatus === 'active',
  };
}

/**
 * Create product master + inventory rule + opening ledger entry in one transaction.
 * Requires caller to have already verified products:write AND inventory:write.
 */
export async function createProductWithOpeningStock({
  master,
  opening,
  session: authSession,
  request,
}) {
  await assertUniqueSkuBarcode({ sku: master.sku, barcode: master.barcode });
  const locationEntries = assertOpeningAllocationBalanced(opening);
  await validateOpeningLocations(locationEntries);

  return runInTransaction(async (mongoSession) => {
    const slug = await generateUniqueSlug(master.name);

    const productPayload = {
      ...buildProductDocFromMaster(master),
      slug,
    };

    const [product] = await Product.create([productPayload], { session: mongoSession });

    await InventoryRule.create(
      [buildInventoryRulePayload(opening, product._id, authSession.userId)],
      { session: mongoSession }
    );

    const ledgerEntries = locationEntries.map(({ locationId, qty }) =>
      buildOpeningLedgerEntry(opening, product._id, authSession.userId, locationId, qty)
    );

    for (const ledgerEntry of ledgerEntries) {
      await appendLedgerEntry(ledgerEntry, mongoSession);
    }

    await writeAuditLog({
      userId: authSession.userId,
      action: 'inventory.product_created',
      entityType: 'Product',
      entityId: product._id,
      after: { title: product.title, sku: product.sku },
      request,
    });

    await writeAuditLog({
      userId: authSession.userId,
      action: 'inventory.opening_stock',
      entityType: 'StockLedger',
      entityId: product._id,
      after: { openingQty: opening.openingQty, entries: ledgerEntries, locationEntries },
      request,
    });

    return product.toObject();
  });
}

/**
 * Add opening stock to an existing product (new location or additional intake).
 */
export async function addOpeningStockToExisting({
  productId,
  opening,
  session: authSession,
  request,
}) {
  const product = await Product.findById(productId);
  if (!product || product.deletedAt) {
    throw new Error('Product not found');
  }

  const locationEntries = assertOpeningAllocationBalanced(opening);
  await validateOpeningLocations(locationEntries);

  const hasLedger = await productHasLedgerEntries(productId);

  return runInTransaction(async (mongoSession) => {
    if (!hasLedger) {
      await InventoryRule.create(
        [buildInventoryRulePayload(opening, product._id, authSession.userId)],
        { session: mongoSession }
      );
    } else {
      const existingRule = await InventoryRule.findOne({ productId }).session(mongoSession);
      if (!existingRule) {
        throw new Error(
          'Inventory rules missing for this product. Contact admin to set min stock / reorder levels.'
        );
      }
      existingRule.deadStockMarked = Boolean(opening.markAsDeadStock);
      await existingRule.save({ session: mongoSession });
    }

    const ledgerEntries = locationEntries.map(({ locationId, qty }) =>
      buildOpeningLedgerEntry(opening, product._id, authSession.userId, locationId, qty)
    );

    for (const ledgerEntry of ledgerEntries) {
      await appendLedgerEntry(ledgerEntry, mongoSession);
    }

    await writeAuditLog({
      userId: authSession.userId,
      action: 'inventory.opening_stock',
      entityType: 'StockLedger',
      entityId: product._id,
      after: { openingQty: opening.openingQty, entries: ledgerEntries, locationEntries },
      request,
    });

    return product.toObject();
  });
}

export function paiseToRupees(paise) {
  return (Number(paise) || 0) / 100;
}

export function formatRupeesFromPaise(paise) {
  return `₹${paiseToRupees(paise).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
