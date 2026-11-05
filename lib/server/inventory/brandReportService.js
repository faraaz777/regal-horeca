/**
 * Brand report
 *
 * Catalog families (parent + children, or a standalone SKU) with the stock
 * rule and on-hand quantity joined in two batched reads.
 *
 * Article status uses classifyArticleStock — the same rule as the inventory
 * list. The browser never reclassifies rows.
 *
 * Maintained, low, in-range, overstock, and dead stock start from InventoryRule
 * so Apply does not read the whole catalog first. The grouped result is reused
 * for the next page and for PDF/Excel for a short time.
 *
 * Does not post stock or edit rules.
 */

import 'server-only';

import mongoose from 'mongoose';
import Product from '@/lib/models/Product';
import Category from '@/lib/models/Category';
import Stock from '@/lib/models/Stock';
import InventoryRule from '@/lib/models/InventoryRule';
import Location from '@/lib/models/Location';
import { formatBranchFloorRackPathCodes } from '@/lib/shared/locationDisplay';
import { getProductMaxDiscountPercent } from '@/lib/shared/salesPricing';
import { buildBrandMatch, buildColorMatch } from '@/lib/server/products/productFilterMatch';
import { buildSalesCatalogSearchFilter } from '@/lib/server/sales/catalogSearch';
import {
  ARTICLE_MAINTAINED,
  ARTICLE_NON_MAINTAINED,
  ARTICLE_STATUS_LABELS,
  STOCK_DEAD,
  STOCK_LOW,
  STOCK_OK,
  STOCK_OVER,
  STOCK_STATUS_LABELS,
  classifyArticleStock,
} from '@/lib/shared/maintainedArticle';

export const BRAND_REPORT_PAGE_SIZE = 25;
export const BRAND_REPORT_SCAN_CAP = 2500;
export const BRAND_REPORT_EXPORT_CAP = 500;

const ARTICLE_FILTERS = new Set([ARTICLE_MAINTAINED, ARTICLE_NON_MAINTAINED]);
const STOCK_FILTERS = new Set([STOCK_LOW, STOCK_OK, STOCK_OVER, STOCK_DEAD]);

const SKU_SELECT =
  'title brand sku barcode hsnCode gstPercent mrp sellingPrice price discountPercent maxDiscountPercent moneyInPaise stockUnit colour unit variationAttributes heroImage gallery productType parentProductId categoryId';

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(String(id || ''));
}

function displayRupees(product, field) {
  const raw = Number(product?.[field] ?? 0);
  if (!raw) return 0;
  const rupees = product?.moneyInPaise ? raw / 100 : raw;
  return Math.round(rupees);
}

function variantSize(product) {
  return product?.variationAttributes?.size || product?.variationAttributes?.unitCount || '';
}

function variantColor(product) {
  return product?.variationAttributes?.color || product?.colour || '';
}

function variantUnit(product) {
  return product?.stockUnit || product?.variationAttributes?.unit || product?.unit || 'Pcs';
}

function heroImage(product) {
  if (product?.heroImage?.trim()) return product.heroImage.trim();
  const galleryImage = Array.isArray(product?.gallery) ? product.gallery.find(Boolean) : '';
  return galleryImage ? String(galleryImage).trim() : '';
}

function descendantIds(categories, rootId) {
  const children = new Map();
  for (const category of categories) {
    const parentId = category.parent ? String(category.parent._id || category.parent) : '';
    if (!children.has(parentId)) children.set(parentId, []);
    children.get(parentId).push(String(category._id));
  }
  const out = [];
  const stack = [String(rootId)];
  const seen = new Set();
  while (stack.length) {
    const id = stack.pop();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    for (const child of children.get(id) || []) stack.push(child);
  }
  return out.filter(isValidId);
}

export function parseBrandReportFilters(source = {}) {
  const brand = String(source.brand || '').trim().slice(0, 120);
  const categoryId = String(source.categoryId || '').trim();
  const subCategoryId = String(source.subCategoryId || '').trim();
  const articleStatus = String(source.articleStatus || '').trim();
  const stockStatus = String(source.stockStatus || '').trim();
  const color = String(source.color || '').trim().slice(0, 40);
  const q = String(source.q || source.search || '').trim().slice(0, 120);
  const page = Math.max(1, parseInt(source.page, 10) || 1);
  return {
    brand,
    categoryId: isValidId(categoryId) ? categoryId : '',
    subCategoryId: isValidId(subCategoryId) ? subCategoryId : '',
    articleStatus: ARTICLE_FILTERS.has(articleStatus) ? articleStatus : '',
    stockStatus: STOCK_FILTERS.has(stockStatus) ? stockStatus : '',
    color,
    q,
    page,
  };
}

/**
 * A report with no brand, category, article, stock, or color filter
 * still needs two characters. One letter would scan the catalog and
 * stop at the cap. Any real filter is enough on its own.
 */
export function brandReportNeedsFilter(filters) {
  const hasFilter = Boolean(
    filters.brand
    || filters.categoryId
    || filters.subCategoryId
    || filters.articleStatus
    || filters.stockStatus
    || filters.color
  );
  return !hasFilter && filters.q.length < 2;
}

const MAINTAINED_RULE = { minStock: { $gt: 0 }, maxStock: { $gt: 0 } };
const REPORT_CACHE_TTL_MS = 45_000;
const REPORT_CACHE_MAX = 12;
const reportCache = new Map();

function reportCacheKey(filters) {
  return [
    filters.brand,
    filters.categoryId,
    filters.subCategoryId,
    filters.articleStatus,
    filters.stockStatus,
    filters.color,
    filters.q,
  ].join('\n');
}

function readReportCache(key) {
  const hit = reportCache.get(key);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    reportCache.delete(key);
    return null;
  }
  return hit.value;
}

function writeReportCache(key, value) {
  if (reportCache.size >= REPORT_CACHE_MAX) {
    const oldest = reportCache.keys().next().value;
    reportCache.delete(oldest);
  }
  reportCache.set(key, { expires: Date.now() + REPORT_CACHE_TTL_MS, value });
}

/**
 * Low, in range, and overstock only exist on maintained articles.
 * Dead stock is the tag. Non-maintained is every SKU that is not maintained,
 * including SKUs that have no rule at all.
 */
async function articleIdConstraint(filters) {
  const maintained = filters.articleStatus === ARTICLE_MAINTAINED
    || filters.stockStatus === STOCK_LOW
    || filters.stockStatus === STOCK_OK
    || filters.stockStatus === STOCK_OVER;
  const nonMaintained = filters.articleStatus === ARTICLE_NON_MAINTAINED;
  const dead = filters.stockStatus === STOCK_DEAD;

  if (nonMaintained && (filters.stockStatus === STOCK_LOW || filters.stockStatus === STOCK_OK || filters.stockStatus === STOCK_OVER)) {
    return { empty: true };
  }

  if (!maintained && !nonMaintained && !dead) return null;

  if (dead && nonMaintained) {
    const rules = await InventoryRule.find({
      deadStockMarked: true,
      $or: [{ minStock: { $lte: 0 } }, { maxStock: { $lte: 0 } }],
    }).select('productId').lean();
    return { include: rules.map((rule) => rule.productId) };
  }

  if (dead && maintained) {
    const rules = await InventoryRule.find({ ...MAINTAINED_RULE, deadStockMarked: true })
      .select('productId')
      .lean();
    return { include: rules.map((rule) => rule.productId) };
  }

  if (dead) {
    const rules = await InventoryRule.find({ deadStockMarked: true }).select('productId').lean();
    return { include: rules.map((rule) => rule.productId) };
  }

  if (maintained) {
    const rules = await InventoryRule.find(MAINTAINED_RULE).select('productId').lean();
    return { include: rules.map((rule) => rule.productId) };
  }

  const rules = await InventoryRule.find(MAINTAINED_RULE).select('productId').lean();
  return { exclude: rules.map((rule) => rule.productId) };
}

/**
 * Location labels need the rack and its floor and branch.
 * Loading only that chain avoids formatting every warehouse location.
 */
async function locationMapForStock(stockRows) {
  const byId = new Map();
  let frontier = [...new Set(stockRows.map((row) => String(row.locationId || '')).filter(isValidId))];
  let guard = 0;
  while (frontier.length && guard < 6) {
    guard += 1;
    const docs = await Location.find({ _id: { $in: frontier } })
      .select('_id code name level parentLocationId')
      .lean();
    const next = [];
    for (const doc of docs) {
      const id = String(doc._id);
      if (byId.has(id)) continue;
      byId.set(id, doc);
      const parentId = doc.parentLocationId ? String(doc.parentLocationId) : '';
      if (parentId && isValidId(parentId) && !byId.has(parentId)) next.push(parentId);
    }
    frontier = [...new Set(next)];
  }
  return byId;
}

export async function listBrandReportFacets() {
  const [brands, categories] = await Promise.all([
    Product.distinct('brand', {
      deletedAt: null,
      productType: { $in: ['parent', 'standalone'] },
      brand: { $exists: true, $nin: [null, ''] },
    }),
    Category.find({ level: { $in: ['category', 'subcategory'] } })
      .select('name level parent')
      .sort({ name: 1 })
      .lean(),
  ]);

  return {
    brands: brands
      .map((brand) => String(brand).trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
    categories: categories.map((category) => ({
      id: String(category._id),
      name: category.name,
      level: category.level,
      parentId: category.parent ? String(category.parent) : '',
    })),
  };
}

async function categoryScopeIds(categoryId, subCategoryId) {
  const focus = subCategoryId || categoryId;
  if (!focus) return null;
  const categories = await Category.find({}).select('_id parent').lean();
  const ids = descendantIds(categories, focus);
  return ids.map((id) => new mongoose.Types.ObjectId(id));
}

async function loadSkuDocuments(filters) {
  const constraint = await articleIdConstraint(filters);
  if (constraint?.empty) return { skuDocs: [], scanCapped: false };
  if (constraint?.include && constraint.include.length === 0) return { skuDocs: [], scanCapped: false };

  const and = [{ deletedAt: null, productType: { $in: ['child', 'standalone'] } }];
  if (constraint?.include?.length) and.push({ _id: { $in: constraint.include } });
  if (constraint?.exclude?.length) and.push({ _id: { $nin: constraint.exclude } });
  const brandMatch = buildBrandMatch(filters.brand ? [filters.brand] : []);
  if (brandMatch) and.push(brandMatch);

  const scopeIds = await categoryScopeIds(filters.categoryId, filters.subCategoryId);
  if (scopeIds) {
    and.push({
      $or: [{ categoryId: { $in: scopeIds } }, { categoryIds: { $in: scopeIds } }],
    });
  }

  const colorMatch = buildColorMatch(filters.color ? [filters.color] : []);
  if (colorMatch) and.push(colorMatch);

  if (filters.q.length >= 1) {
    const searchFilter = await buildSalesCatalogSearchFilter(filters.q);
    if (searchFilter) and.push(searchFilter);
  }

  const scanned = await Product.find({ $and: and })
    .select(SKU_SELECT)
    .sort({ title: 1 })
    .limit(BRAND_REPORT_SCAN_CAP + 1)
    .lean();

  const scanCapped = scanned.length > BRAND_REPORT_SCAN_CAP;
  return { skuDocs: scanCapped ? scanned.slice(0, BRAND_REPORT_SCAN_CAP) : scanned, scanCapped };
}

function buildGroups(skuDocs, parents, qtyByProduct, locationsByProduct, ruleByProduct) {
  const groups = new Map();

  for (const sku of skuDocs) {
    const parentId = sku.productType === 'child' ? String(sku.parentProductId || '') : String(sku._id);
    const parent = sku.productType === 'child' ? parents.get(parentId) : sku;
    if (!groups.has(parentId || String(sku._id))) {
      groups.set(parentId || String(sku._id), {
        familyId: parentId || String(sku._id),
        familyTitle: parent?.title || sku.title || '',
        brand: parent?.brand || sku.brand || '',
        rows: [],
      });
    }

    const pid = String(sku._id);
    const rule = ruleByProduct.get(pid) || null;
    const qty = qtyByProduct.get(pid) || 0;
    const health = classifyArticleStock(rule, qty);
    const locations = locationsByProduct.get(pid) || [];

    groups.get(parentId || pid).rows.push({
      id: pid,
      parentId: parentId || pid,
      parentName: parent?.title || sku.title || '',
      imageUrl: heroImage(sku) || heroImage(parent),
      name: sku.title || '',
      size: variantSize(sku),
      unit: variantUnit(sku),
      color: variantColor(sku),
      sku: sku.sku || '',
      barcode: sku.barcode || '',
      hsnCode: sku.hsnCode || '',
      gstPercent: Number(sku.gstPercent) || 0,
      mrp: displayRupees(sku, 'mrp'),
      sellingPrice: displayRupees(sku, 'sellingPrice') || displayRupees(sku, 'price'),
      maxDiscountPercent: getProductMaxDiscountPercent(sku),
      totalQuantity: health.totalQuantity,
      minQuantity: health.minQuantity,
      maxQuantity: health.maxQuantity,
      reorderQty: health.reorderQty,
      location: locations.join(', '),
      articleStatus: health.articleStatus,
      stockStatus: health.stockStatus,
      brand: sku.brand || parent?.brand || '',
    });
  }

  const list = [...groups.values()];
  for (const group of list) {
    group.rows.sort((a, b) => String(a.size).localeCompare(String(b.size), undefined, { numeric: true })
      || String(a.name).localeCompare(String(b.name)));
    group.variantCount = group.rows.length;
  }
  list.sort((a, b) => String(a.brand).localeCompare(String(b.brand))
    || String(a.familyTitle).localeCompare(String(b.familyTitle)));
  return list;
}

export async function queryBrandReport(rawFilters, { pageSize = BRAND_REPORT_PAGE_SIZE, forExport = false, rowIds = [] } = {}) {
  const filters = parseBrandReportFilters(rawFilters);
  if (brandReportNeedsFilter(filters)) {
    return {
      needsFilter: true,
      filters,
      groups: [],
      totals: { families: 0, variants: 0, qty: 0 },
      pagination: { page: 1, pages: 1, pageSize },
      scanCapped: false,
      exportCap: BRAND_REPORT_EXPORT_CAP,
      generatedAt: new Date().toISOString(),
    };
  }

  const cacheKey = reportCacheKey(filters);
  const cached = readReportCache(cacheKey);
  if (cached) {
    return presentBrandReport(cached, filters, { pageSize, forExport, rowIds });
  }

  const { skuDocs, scanCapped } = await loadSkuDocuments(filters);
  const parentIds = [...new Set(
    skuDocs
      .filter((sku) => sku.productType === 'child' && sku.parentProductId)
      .map((sku) => String(sku.parentProductId))
      .filter(isValidId)
  )];
  const skuIds = skuDocs.map((sku) => sku._id);

  const [parents, stockRows, rules] = await Promise.all([
    parentIds.length
      ? Product.find({ _id: { $in: parentIds }, deletedAt: null }).select('title brand heroImage gallery').lean()
      : [],
    skuIds.length
      ? Stock.find({
          productId: { $in: skuIds },
          statusBucket: { $ne: 'sold' },
          qty: { $gt: 0 },
        }).select('productId locationId qty').lean()
      : [],
    skuIds.length
      ? InventoryRule.find({ productId: { $in: skuIds } })
          .select('productId minStock maxStock reorderQty deadStockMarked')
          .lean()
      : [],
  ]);
  const locById = await locationMapForStock(stockRows);
  const qtyByProduct = new Map();
  const locationsByProduct = new Map();
  for (const row of stockRows) {
    const pid = String(row.productId);
    qtyByProduct.set(pid, (qtyByProduct.get(pid) || 0) + Number(row.qty || 0));
    const path = formatBranchFloorRackPathCodes(String(row.locationId), locById);
    if (!path || path === '—') continue;
    if (!locationsByProduct.has(pid)) locationsByProduct.set(pid, []);
    const list = locationsByProduct.get(pid);
    if (!list.includes(path)) list.push(path);
  }

  let groups = buildGroups(
    skuDocs,
    new Map(parents.map((parent) => [String(parent._id), parent])),
    qtyByProduct,
    locationsByProduct,
    new Map(rules.map((rule) => [String(rule.productId), rule]))
  );

  if (filters.articleStatus || filters.stockStatus) {
    groups = groups
      .map((group) => ({
        ...group,
        rows: group.rows.filter((row) => {
          if (filters.articleStatus && row.articleStatus !== filters.articleStatus) return false;
          if (filters.stockStatus && row.stockStatus !== filters.stockStatus) return false;
          return true;
        }),
      }))
      .filter((group) => group.rows.length > 0)
      .map((group) => ({ ...group, variantCount: group.rows.length }));
  }

  const bundle = {
    filters,
    groups,
    scanCapped,
    generatedAt: new Date().toISOString(),
  };
  writeReportCache(cacheKey, bundle);
  return presentBrandReport(bundle, filters, { pageSize, forExport, rowIds });
}

function presentBrandReport(bundle, filters, { pageSize, forExport, rowIds }) {
  let groups = bundle.groups;
  if (forExport && rowIds?.length) {
    const wanted = new Set(rowIds.map(String).filter(Boolean));
    groups = groups
      .map((group) => ({
        ...group,
        rows: group.rows.filter((row) => wanted.has(row.id)),
      }))
      .filter((group) => group.rows.length > 0)
      .map((group) => ({ ...group, variantCount: group.rows.length }));
  }

  const allRows = groups.flatMap((group) => group.rows);
  const totals = {
    families: groups.length,
    variants: allRows.length,
    qty: allRows.reduce((sum, row) => sum + row.totalQuantity, 0),
  };

  let exportCapped = false;
  let pageGroups = groups;
  let pagination = { page: 1, pages: 1, pageSize: groups.length || pageSize };

  if (forExport) {
    let kept = 0;
    pageGroups = [];
    for (const group of groups) {
      if (kept >= BRAND_REPORT_EXPORT_CAP) {
        exportCapped = true;
        break;
      }
      const room = BRAND_REPORT_EXPORT_CAP - kept;
      const rows = group.rows.slice(0, room);
      if (rows.length < group.rows.length) exportCapped = true;
      pageGroups.push({ ...group, rows, variantCount: rows.length });
      kept += rows.length;
    }
  } else {
    const pages = Math.max(1, Math.ceil(groups.length / pageSize));
    const page = Math.min(filters.page, pages);
    pagination = { page, pages, pageSize };
    pageGroups = groups.slice((page - 1) * pageSize, page * pageSize);
  }

  return {
    needsFilter: false,
    filters,
    groups: pageGroups,
    totals,
    pagination,
    scanCapped: bundle.scanCapped,
    exportCapped,
    exportCap: BRAND_REPORT_EXPORT_CAP,
    generatedAt: bundle.generatedAt,
  };
}

export function flattenBrandReportRows(groups, rowIds) {
  const wanted = new Set((rowIds || []).map(String).filter(Boolean));
  const rows = [];
  for (const group of groups) {
    for (const row of group.rows) {
      if (wanted.size && !wanted.has(row.id)) continue;
      rows.push(row);
    }
  }
  return rows;
}

export const BRAND_REPORT_EXCEL_COLUMNS = [
  { header: 'Parent', key: 'parentName', width: 32 },
  { header: 'Name', key: 'name', width: 36 },
  { header: 'Size', key: 'size', width: 12 },
  { header: 'Unit', key: 'unit', width: 10 },
  { header: 'Color', key: 'color', width: 14 },
  { header: 'SKU', key: 'sku', width: 16 },
  { header: 'Barcode', key: 'barcode', width: 18 },
  { header: 'HSN Code', key: 'hsnCode', width: 12 },
  { header: 'GST%', key: 'gstPercent', width: 8 },
  { header: 'MRP', key: 'mrp', width: 10 },
  { header: 'SP', key: 'sellingPrice', width: 10 },
  { header: 'Max discount %', key: 'maxDiscountPercent', width: 16 },
  { header: 'Total qty', key: 'totalQuantity', width: 12 },
  { header: 'Min', key: 'minQuantity', width: 10 },
  { header: 'Max', key: 'maxQuantity', width: 10 },
  { header: 'Reorder qty', key: 'reorderQty', width: 14 },
  { header: 'Location', key: 'location', width: 28 },
  { header: 'Article status', key: 'articleStatus', width: 18 },
  { header: 'Stock status', key: 'stockStatus', width: 14 },
];

export async function buildBrandReportWorkbook(rows) {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Regal Admin';
  workbook.created = new Date();
  const ws = workbook.addWorksheet('Brand report', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, paperSize: 9 },
  });
  ws.columns = BRAND_REPORT_EXCEL_COLUMNS;
  ws.getRow(1).font = { bold: true };
  for (const row of rows) {
    ws.addRow({
      ...row,
      minQuantity: row.minQuantity ?? '',
      maxQuantity: row.maxQuantity ?? '',
      reorderQty: row.reorderQty ?? '',
      articleStatus: ARTICLE_STATUS_LABELS[row.articleStatus] || row.articleStatus,
      stockStatus: STOCK_STATUS_LABELS[row.stockStatus] || '',
    });
  }
  return workbook;
}
