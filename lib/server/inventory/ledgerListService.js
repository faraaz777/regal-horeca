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
import { resolveMovementProductClause } from '@/lib/server/inventory/movementProductSearch';
import { ledgerLocationClause } from '@/lib/server/inventory/ledgerLocationScope';
import { ledgerDayEnd, ledgerDayStart, normalizeLedgerDateInputs } from '@/lib/shared/ledgerCalendar';

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
 * Attribution for display.
 *
 * The stored name wins over the populated user: it was captured when the sale
 * was recorded, so the row keeps reading correctly after a rename. The live
 * name is only a fallback for rows written before the snapshot existed.
 */
function soldForFields(entry) {
  return {
    soldForUserId: entry.soldForUserId?._id || entry.soldForUserId || null,
    soldForName: entry.soldForName || entry.soldForUserId?.name || '',
  };
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
          ...soldForFields(entry),
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
      ...soldForFields(entry),
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
  branchId = '',
  type = '',
  dateFrom = '',
  dateTo = '',
  search = '',
  brand = '',
  refExact = '',
  refs = '',
  userId = '',
  soldForUserId = '',
  page = 1,
  limit = 50,
  maxLimit = 200,
}) {
  const query = {};
  const productFilter = await resolveMovementProductClause({ productId, search, brand });
  if (productFilter.clause) Object.assign(query, productFilter.clause);

  const location = await ledgerLocationClause({ locationId, branchId });
  if (location.clause) Object.assign(query, location.clause);

  const types = ledgerTypesForFilter(type);
  if (types?.length) {
    query.type = { $in: types };
  }

  const range = normalizeLedgerDateInputs(dateFrom, dateTo);
  const from = ledgerDayStart(range.dateFrom);
  const to = ledgerDayEnd(range.dateTo);
  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = from;
    if (to) query.createdAt.$lte = to;
  }

  const refList = String(refs || '')
    .split(',')
    .map((ref) => ref.trim())
    .filter(Boolean)
    .slice(0, 50);
  if (refList.length) {
    query.ref = { $in: refList };
  } else if (refExact.trim()) {
    query.ref = String(refExact).trim();
  }

  /**
   * Two different questions, so two filters: `userId` is who keyed the
   * movement in, `soldForUserId` is whose sale it was.
   */
  if (userId) {
    query.performedBy = new mongoose.Types.ObjectId(String(userId));
  }

  if (soldForUserId) {
    query.soldForUserId = new mongoose.Types.ObjectId(String(soldForUserId));
  }

  const safeLimit = Math.min(Math.max(limit, 1), Math.max(1, maxLimit));
  const skip = (Math.max(page, 1) - 1) * safeLimit;

  const [rawEntries, total] = await Promise.all([
    StockLedger.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .populate('performedBy', 'name email role')
      .populate('soldForUserId', 'name email role')
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
    searchMeta: { truncated: Boolean(productFilter.truncated) },
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
    'Recorded by',
    'Sold for',
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
      row.soldForName || '',
      row.qty ?? '',
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
    lines.push(cols.join(','));
  }

  return lines.join('\n');
}
