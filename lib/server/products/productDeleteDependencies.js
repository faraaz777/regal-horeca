/**
 * Product delete dependency checks.
 *
 * Soft-delete (trash) only hides the product from future ops.
 * Hard-delete (forever) is blocked when anything still depends on the _id.
 *
 * Used by:
 * - DELETE /api/products/:id/permanent
 * - GET /api/products/:id/delete-dependencies (UI warnings)
 * - scripts/auditDeletedProductRefs.mjs (via duplicated raw queries — keep in sync)
 */

import mongoose from 'mongoose';
import Product from '@/lib/models/Product';
import Stock from '@/lib/models/Stock';
import StockLedger from '@/lib/models/StockLedger';
import InventoryRule from '@/lib/models/InventoryRule';
import Location from '@/lib/models/Location';
import SalesBucket from '@/lib/models/SalesBucket';
import InventoryRequest from '@/lib/models/InventoryRequest';
import SalesCollection from '@/lib/models/SalesCollection';
import EnquiryItem from '@/lib/models/EnquiryItem';
import {
  ACTIVE_BUCKET_STATUSES,
  NEEDS_ACTION_STATUSES,
} from '@/lib/shared/salesConstants';

function toObjectId(id) {
  return new mongoose.Types.ObjectId(String(id));
}

/**
 * @param {string|mongoose.Types.ObjectId} productId
 * @returns {Promise<{
 *   productId: string,
 *   title: string,
 *   sku: string,
 *   productType: string,
 *   deletedAt: Date|null,
 *   stock: { totalQty: number, locations: Array<{ locationId: string, path: string, qty: number, statusBucket: string }> },
 *   ledgerCount: number,
 *   inventoryRule: boolean,
 *   openBuckets: number,
 *   openRequests: number,
 *   collections: number,
 *   enquiryItems: number,
 *   childrenCount: number,
 *   parentProductId: string|null,
 *   relatedFromOthers: number,
 *   blockers: string[],
 *   canHardDelete: boolean,
 * }>}
 */
export async function getProductDeleteDependencies(productId) {
  const id = toObjectId(productId);
  const product = await Product.findById(id)
    .select('title sku productType deletedAt parentProductId')
    .lean();

  if (!product) {
    const err = new Error('Product not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const childIds = (
    await Product.find({ parentProductId: id }).select('_id').lean()
  ).map((c) => c._id);

  /** All ids whose inventory/sales refs block forever-delete of this product. */
  const scopeIds = [id, ...childIds];

  const [
    stockRows,
    ledgerCount,
    ruleCount,
    openBuckets,
    openRequests,
    collections,
    enquiryItems,
    relatedFromOthers,
  ] = await Promise.all([
    Stock.find({ productId: { $in: scopeIds }, qty: { $gt: 0 } })
      .select('productId locationId statusBucket qty')
      .lean(),
    StockLedger.countDocuments({ productId: { $in: scopeIds } }),
    InventoryRule.countDocuments({ productId: { $in: scopeIds } }),
    SalesBucket.countDocuments({
      status: { $in: ACTIVE_BUCKET_STATUSES },
      'lines.productId': { $in: scopeIds },
    }),
    InventoryRequest.countDocuments({
      status: { $in: NEEDS_ACTION_STATUSES },
      'lines.productId': { $in: scopeIds },
    }),
    SalesCollection.countDocuments({
      $or: [
        { 'items.productId': { $in: scopeIds } },
        { 'presentationSet.pins.productId': { $in: scopeIds } },
        { 'presentationSet.scenes.pins.productId': { $in: scopeIds } },
      ],
    }),
    EnquiryItem.countDocuments({ productId: { $in: scopeIds } }),
    Product.countDocuments({
      _id: { $nin: scopeIds },
      $or: [
        { relatedProductIds: { $in: scopeIds } },
        { frequentlyOrderedTogetherProductIds: { $in: scopeIds } },
      ],
    }),
  ]);

  const locIds = [...new Set(stockRows.map((r) => String(r.locationId)))];
  const locMap = new Map();
  if (locIds.length) {
    const locs = await Location.find({ _id: { $in: locIds } })
      .select('path name code')
      .lean();
    for (const loc of locs) {
      locMap.set(String(loc._id), loc.path || loc.name || loc.code || String(loc._id));
    }
  }

  const stockLocations = stockRows.map((row) => ({
    locationId: String(row.locationId),
    path: locMap.get(String(row.locationId)) || String(row.locationId),
    qty: Number(row.qty) || 0,
    statusBucket: row.statusBucket,
    productId: String(row.productId),
  }));
  const totalQty = stockLocations.reduce((sum, row) => sum + row.qty, 0);

  const blockers = [];
  if (totalQty > 0) {
    blockers.push(`Physical stock: ${totalQty} pcs`);
  }
  if (ledgerCount > 0) {
    blockers.push(`Inventory history: ${ledgerCount} ledger entries`);
  }
  if (openBuckets > 0) {
    blockers.push(`Open sales quotes: ${openBuckets}`);
  }
  if (openRequests > 0) {
    blockers.push(`Open stock requests: ${openRequests}`);
  }
  if (collections > 0) {
    blockers.push(`Sales collections: ${collections}`);
  }
  if (enquiryItems > 0) {
    blockers.push(`Enquiry line items: ${enquiryItems}`);
  }

  /**
   * Inventory rules and related-product reverse links are cleaned up during
   * hard-delete when other blockers are clear — they alone do not block.
   */

  return {
    productId: String(id),
    title: product.title || '',
    sku: product.sku || '',
    productType: product.productType || 'standalone',
    deletedAt: product.deletedAt || null,
    stock: { totalQty, locations: stockLocations },
    ledgerCount,
    inventoryRule: ruleCount > 0,
    inventoryRuleCount: ruleCount,
    openBuckets,
    openRequests,
    collections,
    enquiryItems,
    childrenCount: childIds.length,
    parentProductId: product.parentProductId ? String(product.parentProductId) : null,
    relatedFromOthers,
    blockers,
    canHardDelete: blockers.length === 0,
  };
}

/**
 * Permanently remove a soft-deleted product (and its children if parent).
 * Caller must already verify Super Admin + canHardDelete.
 *
 * @param {string|mongoose.Types.ObjectId} productId
 */
export async function hardDeleteProduct(productId) {
  const id = toObjectId(productId);
  const product = await Product.findById(id);
  if (!product) {
    const err = new Error('Product not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (!product.deletedAt) {
    const err = new Error('Product must be in trash before permanent delete. Move to trash first.');
    err.code = 'NOT_IN_TRASH';
    throw err;
  }

  const deps = await getProductDeleteDependencies(id);
  if (!deps.canHardDelete) {
    const err = new Error(
      `Cannot permanently delete. ${deps.blockers.join(' · ')}`
    );
    err.code = 'HAS_DEPENDENCIES';
    err.dependencies = deps;
    throw err;
  }

  const childIds = (
    await Product.find({ parentProductId: id }).select('_id').lean()
  ).map((c) => c._id);
  const scopeIds = [id, ...childIds];

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await InventoryRule.deleteMany({ productId: { $in: scopeIds } }).session(session);
    await Stock.deleteMany({ productId: { $in: scopeIds }, qty: 0 }).session(session);

    await Product.updateMany(
      {
        _id: { $nin: scopeIds },
        $or: [
          { relatedProductIds: { $in: scopeIds } },
          { frequentlyOrderedTogetherProductIds: { $in: scopeIds } },
        ],
      },
      {
        $pull: {
          relatedProductIds: { $in: scopeIds },
          frequentlyOrderedTogetherProductIds: { $in: scopeIds },
        },
      }
    ).session(session);

    if (product.parentProductId) {
      await Product.updateOne(
        { _id: product.parentProductId, defaultChildProductId: id },
        { $set: { defaultChildProductId: null } }
      ).session(session);
    }

    if (childIds.length > 0) {
      await Product.deleteMany({ _id: { $in: childIds } }).session(session);
    }
    await Product.deleteOne({ _id: id }).session(session);

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  return {
    deletedId: String(id),
    deletedChildren: childIds.map(String),
    title: deps.title,
  };
}
