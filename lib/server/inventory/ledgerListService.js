import 'server-only';

import mongoose from 'mongoose';
import StockLedger from '@/lib/models/StockLedger';
import Product from '@/lib/models/Product';
import {
  LEDGER_TYPE_FILTER_MAP,
  LEDGER_TYPE_LABELS,
  STATUS_BUCKET_LABELS,
  ALL_REASON_LABELS,
} from '@/lib/shared/inventoryConstants';
import { formatBranchFloorRackPath } from '@/lib/shared/locationDisplay';
import { buildLocationIndexMaps } from '@/lib/server/inventory/locationSelectService';

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function ledgerTypesForFilter(filterType) {
  if (!filterType) return null;
  return LEDGER_TYPE_FILTER_MAP[filterType] || null;
}

function formatSignedChange(entry) {
  const sign = entry.qty > 0 ? '+' : '';
  return `${sign}${entry.qty}`;
}

function formatStatusChange(fromBucket, toBucket, qty) {
  const from = STATUS_BUCKET_LABELS[fromBucket] || fromBucket;
  const to = STATUS_BUCKET_LABELS[toBucket] || toBucket;
  return `${from}→${to} ×${qty}`;
}

/**
 * Pair condition_change ledger rows into a single display row.
 * Unpaired rows are returned as-is.
 */
export function groupLedgerEntriesForDisplay(entries) {
  const rows = [];
  const used = new Set();

  for (let i = 0; i < entries.length; i++) {
    if (used.has(i)) continue;
    const entry = entries[i];

    if (entry.type === 'condition_change' && entry.qty < 0) {
      const matchIdx = entries.findIndex((other, j) => {
        if (j === i || used.has(j)) return false;
        if (other.type !== 'condition_change' || other.qty <= 0) return false;
        if (String(other.productId) !== String(entry.productId)) return false;
        if (String(other.locationId?._id || other.locationId) !== String(entry.locationId?._id || entry.locationId)) {
          return false;
        }
        if (Math.abs(other.qty) !== Math.abs(entry.qty)) return false;
        if (String(other.performedBy?._id || other.performedBy) !== String(entry.performedBy?._id || entry.performedBy)) {
          return false;
        }
        const dt = Math.abs(new Date(other.createdAt) - new Date(entry.createdAt));
        return dt < 3000;
      });

      if (matchIdx >= 0) {
        const positive = entries[matchIdx];
        const qty = Math.abs(entry.qty);
        rows.push({
          _id: entry._id,
          pairId: `${entry._id}-${positive._id}`,
          productId: entry.productId,
          locationId: entry.locationId,
          type: 'condition_change',
          displayType: 'status',
          typeLabel: LEDGER_TYPE_LABELS.condition_change,
          changeDisplay: formatStatusChange(entry.statusBucket, positive.statusBucket, qty),
          qty: entry.qty,
          statusBucket: entry.statusBucket,
          fromBucket: entry.statusBucket,
          toBucket: positive.statusBucket,
          reason: entry.reason,
          reasonLabel: ALL_REASON_LABELS[entry.reason] || entry.reason,
          remark: entry.remark || positive.remark || '',
          ref: entry.ref || positive.ref || '',
          performedBy: entry.performedBy,
          createdAt: entry.createdAt,
          ratePaise: entry.ratePaise,
        });
        used.add(i);
        used.add(matchIdx);
        continue;
      }
    }

    if (entry.type === 'condition_change' && entry.qty > 0) {
      const alreadyPaired = entries.some(
        (other, j) =>
          j !== i &&
          !used.has(j) &&
          other.type === 'condition_change' &&
          other.qty < 0 &&
          String(other.productId) === String(entry.productId) &&
          Math.abs(other.qty) === entry.qty &&
          Math.abs(new Date(other.createdAt) - new Date(entry.createdAt)) < 3000
      );
      if (alreadyPaired) {
        used.add(i);
        continue;
      }
    }

    rows.push({
      _id: entry._id,
      pairId: String(entry._id),
      productId: entry.productId,
      locationId: entry.locationId,
      type: entry.type,
      displayType: entry.type,
      typeLabel: LEDGER_TYPE_LABELS[entry.type] || entry.type,
      changeDisplay: formatSignedChange(entry),
      qty: entry.qty,
      statusBucket: entry.statusBucket,
      fromBucket: null,
      toBucket: null,
      reason: entry.reason,
      reasonLabel: ALL_REASON_LABELS[entry.reason] || entry.reason,
      remark: entry.remark || '',
      ref: entry.ref || '',
      performedBy: entry.performedBy,
      createdAt: entry.createdAt,
      ratePaise: entry.ratePaise,
    });
    used.add(i);
  }

  return rows;
}

function resolveProductHeroImage(product) {
  if (!product) return '';
  if (product.heroImage?.trim()) return product.heroImage.trim();
  const galleryImage = Array.isArray(product.gallery) ? product.gallery.find(Boolean) : '';
  if (galleryImage) return String(galleryImage).trim();
  const parent = product.parentProductId;
  if (parent?.heroImage?.trim()) return parent.heroImage.trim();
  const parentGallery = Array.isArray(parent?.gallery) ? parent.gallery.find(Boolean) : '';
  return parentGallery ? String(parentGallery).trim() : '';
}

function enrichProductFields(row, productMap) {
  const pid = String(row.productId?._id || row.productId);
  const product = productMap.get(pid);
  return {
    ...row,
    productTitle: product?.title || '—',
    productSku: product?.sku || '',
    productHeroImage: resolveProductHeroImage(product),
  };
}

/**
 * Paginated stock movement ledger with filters.
 */
export async function listStockLedgerEntries({
  productId = '',
  locationId = '',
  type = '',
  dateFrom = '',
  dateTo = '',
  search = '',
  refExact = '',
  userId = '',
  page = 1,
  limit = 50,
}) {
  const query = {};

  if (productId) {
    query.productId = new mongoose.Types.ObjectId(String(productId));
  }

  if (locationId) {
    query.locationId = new mongoose.Types.ObjectId(String(locationId));
  }

  const types = ledgerTypesForFilter(type);
  if (types?.length) {
    query.type = { $in: types };
  }

  const from = parseDate(dateFrom);
  const to = parseDate(dateTo);
  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = from;
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }

  if (search.trim()) {
    const re = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [{ remark: re }, { ref: re }];
  }

  if (refExact.trim()) {
    query.ref = String(refExact).trim();
  }

  if (userId) {
    query.performedBy = new mongoose.Types.ObjectId(String(userId));
  }

  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const skip = (Math.max(page, 1) - 1) * safeLimit;

  const [rawEntries, total] = await Promise.all([
    StockLedger.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .populate('performedBy', 'name email role')
      .populate('locationId', 'path code')
      .lean(),
    StockLedger.countDocuments(query),
  ]);

  const grouped = groupLedgerEntriesForDisplay(rawEntries);

  const productIds = [...new Set(grouped.map((r) => String(r.productId?._id || r.productId)))];
  const products = productIds.length
    ? await Product.find({ _id: { $in: productIds } })
        .select('title sku heroImage gallery parentProductId')
        .populate('parentProductId', 'heroImage gallery')
        .lean()
    : [];
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  const locationById = await buildLocationIndexMaps();

  const items = grouped.map((row) => {
    const enriched = enrichProductFields(row, productMap);
    const locId = row.locationId?._id || row.locationId;
    return {
      ...enriched,
      locationDisplayPath: locId
        ? formatBranchFloorRackPath(String(locId), locationById)
        : '—',
    };
  });

  return {
    items,
    pagination: {
      page: Math.max(page, 1),
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit) || 1,
    },
  };
}

export function ledgerRowsToCsv(items) {
  const header = [
    'Timestamp',
    'Product',
    'SKU',
    'Type',
    'Change',
    'Status bucket',
    'Reason',
    'Remark',
    'Ref',
    'Location',
    'User',
    'Qty',
  ];

  const lines = [header.join(',')];

  for (const row of items) {
    const cols = [
      row.createdAt ? new Date(row.createdAt).toISOString() : '',
      row.productTitle || '',
      row.productSku || '',
      row.typeLabel || '',
      row.changeDisplay || '',
      row.statusBucket || '',
      row.reasonLabel || '',
      row.remark || '',
      row.ref || '',
      row.locationDisplayPath || row.locationId?.path || '',
      row.performedBy?.name || row.performedBy?.email || '',
      row.qty ?? '',
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
    lines.push(cols.join(','));
  }

  return lines.join('\n');
}
