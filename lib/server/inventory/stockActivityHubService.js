import 'server-only';

import mongoose from 'mongoose';
import StockLedger from '@/lib/models/StockLedger';
import Stock from '@/lib/models/Stock';
import Product from '@/lib/models/Product';
import User from '@/lib/server/models/User';
import {
  LEDGER_TYPE_FILTER_MAP,
  LEDGER_TYPE_LABELS,
} from '@/lib/shared/inventoryConstants';
import { formatBranchFloorRackPath } from '@/lib/shared/locationDisplay';
import { buildLocationIndexMaps } from '@/lib/server/inventory/locationSelectService';

function escapeRegex(raw) {
  return String(raw || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ledgerTypesForFilter(filterType) {
  if (!filterType) return null;
  return LEDGER_TYPE_FILTER_MAP[filterType] || null;
}

function parseDate(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildLedgerMatch({
  productId = '',
  locationId = '',
  type = '',
  dateFrom = '',
  dateTo = '',
  search = '',
  refExact = '',
  userId = '',
} = {}) {
  const match = {};

  if (productId) {
    match.productId = new mongoose.Types.ObjectId(String(productId));
  }
  if (locationId) {
    match.locationId = new mongoose.Types.ObjectId(String(locationId));
  }

  const types = ledgerTypesForFilter(type);
  if (types?.length) {
    match.type = { $in: types };
  }

  const from = parseDate(dateFrom);
  const to = parseDate(dateTo);
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = from;
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      match.createdAt.$lte = end;
    }
  }

  if (search.trim()) {
    const re = new RegExp(escapeRegex(search.trim()), 'i');
    match.$or = [{ remark: re }, { ref: re }];
  }

  if (refExact.trim()) {
    match.ref = String(refExact).trim();
  }

  if (userId) {
    match.performedBy = new mongoose.Types.ObjectId(String(userId));
  }

  return match;
}

/**
 * Stock Position tab:
 * current sellable stock grouped by product with per-rack quantities.
 */
export async function listStockPosition({
  locationId = '',
  productId = '',
  search = '',
  page = 1,
  limit = 20,
} = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safePage = Math.max(1, Number(page) || 1);
  const skip = (safePage - 1) * safeLimit;

  const stockMatch = { statusBucket: 'sellable', qty: { $gt: 0 } };
  if (locationId) stockMatch.locationId = new mongoose.Types.ObjectId(String(locationId));
  if (productId) stockMatch.productId = new mongoose.Types.ObjectId(String(productId));

  let productIdsFromSearch = null;
  if (search.trim()) {
    const re = new RegExp(escapeRegex(search.trim()), 'i');
    const products = await Product.find({ $or: [{ title: re }, { sku: re }] })
      .select('_id')
      .limit(500)
      .lean();
    productIdsFromSearch = products.map((p) => p._id);
    if (!productIdsFromSearch.length) {
      return { items: [], pagination: { page: safePage, limit: safeLimit, total: 0, pages: 1 } };
    }
    stockMatch.productId = { $in: productIdsFromSearch };
  }

  const [grouped, totalAgg] = await Promise.all([
    Stock.aggregate([
      { $match: stockMatch },
      {
        $group: {
          _id: { productId: '$productId', locationId: '$locationId' },
          qty: { $sum: '$qty' },
          lastLedgerAt: { $max: '$lastLedgerAt' },
        },
      },
      {
        $group: {
          _id: '$_id.productId',
          totalQty: { $sum: '$qty' },
          lastLedgerAt: { $max: '$lastLedgerAt' },
          locations: {
            $push: {
              locationId: '$_id.locationId',
              qty: '$qty',
              lastLedgerAt: '$lastLedgerAt',
            },
          },
        },
      },
      { $sort: { totalQty: -1, lastLedgerAt: -1 } },
      { $skip: skip },
      { $limit: safeLimit },
    ]),
    Stock.aggregate([
      { $match: stockMatch },
      { $group: { _id: '$productId' } },
      { $count: 'total' },
    ]),
  ]);

  const total = totalAgg?.[0]?.total || 0;
  if (!grouped.length) {
    return {
      items: [],
      pagination: { page: safePage, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) || 1 },
    };
  }

  const productIds = grouped.map((g) => g._id);
  const products = await Product.find({ _id: { $in: productIds } })
    .select('title sku heroImage gallery parentProductId')
    .populate('parentProductId', 'heroImage gallery')
    .lean();
  const productMap = new Map(products.map((p) => [String(p._id), p]));
  const locationById = await buildLocationIndexMaps();

  const items = grouped
    .map((row) => {
      const product = productMap.get(String(row._id));
      if (!product) return null;
      const locations = (row.locations || [])
        .map((loc) => ({
          locationId: String(loc.locationId),
          qty: Number(loc.qty) || 0,
          lastLedgerAt: loc.lastLedgerAt || null,
          locationDisplayPath: formatBranchFloorRackPath(String(loc.locationId), locationById),
        }))
        .sort((a, b) => b.qty - a.qty || a.locationDisplayPath.localeCompare(b.locationDisplayPath));

      let heroImage = '';
      if (product.heroImage?.trim()) heroImage = product.heroImage.trim();
      else if (Array.isArray(product.gallery) && product.gallery.find(Boolean)) {
        heroImage = String(product.gallery.find(Boolean)).trim();
      } else if (product.parentProductId?.heroImage?.trim()) {
        heroImage = product.parentProductId.heroImage.trim();
      } else if (
        Array.isArray(product.parentProductId?.gallery) &&
        product.parentProductId.gallery.find(Boolean)
      ) {
        heroImage = String(product.parentProductId.gallery.find(Boolean)).trim();
      }

      return {
        productId: String(row._id),
        title: product.title || '—',
        sku: product.sku || '',
        heroImage,
        totalQty: Number(row.totalQty) || 0,
        lastLedgerAt: row.lastLedgerAt || null,
        locations,
      };
    })
    .filter(Boolean);

  return {
    items,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit) || 1,
    },
  };
}

/**
 * Operators tab: grouped by ledger performer.
 */
export async function listOperators({
  productId = '',
  locationId = '',
  type = '',
  dateFrom = '',
  dateTo = '',
  search = '',
  refExact = '',
  page = 1,
  limit = 20,
} = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safePage = Math.max(1, Number(page) || 1);
  const skip = (safePage - 1) * safeLimit;

  const match = buildLedgerMatch({
    productId,
    locationId,
    type,
    dateFrom,
    dateTo,
    search,
    refExact,
  });

  const [grouped, totalAgg] = await Promise.all([
    StockLedger.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$performedBy',
          movementCount: { $sum: 1 },
          plusQty: { $sum: { $cond: [{ $gt: ['$qty', 0] }, '$qty', 0] } },
          minusQty: {
            $sum: {
              $cond: [{ $lt: ['$qty', 0] }, { $multiply: ['$qty', -1] }, 0],
            },
          },
          lastMovementAt: { $max: '$createdAt' },
        },
      },
      { $sort: { movementCount: -1, lastMovementAt: -1 } },
      { $skip: skip },
      { $limit: safeLimit },
    ]),
    StockLedger.aggregate([
      { $match: match },
      { $group: { _id: '$performedBy' } },
      { $count: 'total' },
    ]),
  ]);

  const total = totalAgg?.[0]?.total || 0;
  const userIds = grouped.map((g) => g._id).filter(Boolean);
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } }).select('name email role').lean()
    : [];
  const userMap = new Map(users.map((u) => [String(u._id), u]));

  const items = grouped.map((row) => {
    const user = userMap.get(String(row._id));
    return {
      userId: row._id ? String(row._id) : '',
      name: user?.name || 'Unknown',
      email: user?.email || '',
      role: user?.role || '',
      movementCount: Number(row.movementCount) || 0,
      plusQty: Number(row.plusQty) || 0,
      minusQty: Number(row.minusQty) || 0,
      lastMovementAt: row.lastMovementAt || null,
    };
  });

  return {
    items,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit) || 1,
    },
  };
}

/**
 * Insights tab: concise operational aggregates from ledger.
 */
export async function getActivityInsights(filters = {}) {
  const match = buildLedgerMatch(filters);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  if (!filters.dateFrom && !filters.dateTo) {
    match.createdAt = { $gte: todayStart };
  }

  const [totals, topItems, topRacks] = await Promise.all([
    StockLedger.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          addedQty: {
            $sum: {
              $cond: [{ $in: ['$type', ['opening', 'adjustment_add', 'transfer_in']] }, '$qty', 0],
            },
          },
          removedQtyRaw: {
            $sum: {
              $cond: [{ $in: ['$type', ['adjustment_minus', 'transfer_out', 'sale_fulfill']] }, '$qty', 0],
            },
          },
          transferCount: {
            $sum: { $cond: [{ $eq: ['$type', 'transfer_out'] }, 1, 0] },
          },
          movementCount: { $sum: 1 },
        },
      },
    ]),
    StockLedger.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$productId',
          movedQtyAbs: { $sum: { $abs: '$qty' } },
          movementCount: { $sum: 1 },
        },
      },
      { $sort: { movedQtyAbs: -1, movementCount: -1 } },
      { $limit: 1 },
    ]),
    StockLedger.aggregate([
      { $match: match },
      { $group: { _id: '$locationId', movementCount: { $sum: 1 } } },
      { $sort: { movementCount: -1 } },
      { $limit: 5 },
    ]),
  ]);

  const totalsRow = totals?.[0] || {};
  const topItemRow = topItems?.[0] || null;
  const locationById = await buildLocationIndexMaps();

  let topItem = null;
  if (topItemRow?._id) {
    const product = await Product.findById(topItemRow._id).select('title sku').lean();
    if (product) {
      topItem = {
        productId: String(product._id),
        title: product.title || '—',
        sku: product.sku || '',
        movedQtyAbs: Number(topItemRow.movedQtyAbs) || 0,
        movementCount: Number(topItemRow.movementCount) || 0,
      };
    }
  }

  const racks = topRacks.map((r) => ({
    locationId: String(r._id),
    movementCount: Number(r.movementCount) || 0,
    locationDisplayPath: formatBranchFloorRackPath(String(r._id), locationById),
  }));

  return {
    addedQty: Number(totalsRow.addedQty) || 0,
    removedQty: Math.abs(Number(totalsRow.removedQtyRaw) || 0),
    transferCount: Number(totalsRow.transferCount) || 0,
    movementCount: Number(totalsRow.movementCount) || 0,
    topItem,
    topRacks: racks,
  };
}

/**
 * Reference tab: group ledger entries by reference string.
 */
export async function listReferenceRollups({
  productId = '',
  locationId = '',
  type = '',
  dateFrom = '',
  dateTo = '',
  refSearch = '',
  page = 1,
  limit = 20,
} = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safePage = Math.max(1, Number(page) || 1);
  const skip = (safePage - 1) * safeLimit;

  const match = buildLedgerMatch({
    productId,
    locationId,
    type,
    dateFrom,
    dateTo,
  });
  match.ref = { $exists: true, $ne: '' };
  if (refSearch.trim()) {
    match.ref = { $regex: new RegExp(escapeRegex(refSearch.trim()), 'i') };
  }

  const [rows, totalAgg] = await Promise.all([
    StockLedger.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$ref',
          movementCount: { $sum: 1 },
          netQty: { $sum: '$qty' },
          addedQty: { $sum: { $cond: [{ $gt: ['$qty', 0] }, '$qty', 0] } },
          removedQty: {
            $sum: { $cond: [{ $lt: ['$qty', 0] }, { $multiply: ['$qty', -1] }, 0] },
          },
          lastAt: { $max: '$createdAt' },
        },
      },
      { $sort: { lastAt: -1 } },
      { $skip: skip },
      { $limit: safeLimit },
    ]),
    StockLedger.aggregate([
      { $match: match },
      { $group: { _id: '$ref' } },
      { $count: 'total' },
    ]),
  ]);

  return {
    items: rows.map((r) => ({
      ref: r._id,
      movementCount: Number(r.movementCount) || 0,
      netQty: Number(r.netQty) || 0,
      addedQty: Number(r.addedQty) || 0,
      removedQty: Number(r.removedQty) || 0,
      lastAt: r.lastAt || null,
    })),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: totalAgg?.[0]?.total || 0,
      pages: Math.ceil((totalAgg?.[0]?.total || 0) / safeLimit) || 1,
    },
  };
}

export function getLedgerTypeLabel(type) {
  return LEDGER_TYPE_LABELS[type] || type;
}
