/**
 * Product Stock Sheet
 *
 * Builds a Vishwas-style family report: one group per selected product family
 * (parent + children, or a standalone SKU), with on-hand qty rolled up
 * across racks into a single row per variant.
 *
 * Qty = all physical stock still in inventory (sellable + dead-stock tagged).
 * Sold history is excluded — it is not on the rack.
 *
 * Does NOT handle sales quotes or catalog PDFs.
 */

import 'server-only';

import mongoose from 'mongoose';
import Product from '@/lib/models/Product';
import Stock from '@/lib/models/Stock';
import { listAllLocations } from '@/lib/server/inventory/locationCrudService';
import { formatBranchFloorRackPathCodes } from '@/lib/shared/locationDisplay';
import { getProductMaxDiscountPercent } from '@/lib/shared/salesPricing';
import { buildSalesCatalogSearchFilter } from '@/lib/server/sales/catalogSearch';
import { buildBrandMatch, buildColorMatch } from '@/lib/server/products/productFilterMatch';
import { getInventoryPresenceProductIds } from '@/lib/server/inventory/inventoryProductQuery';
import { canonicalizeCatalogColorName } from '@/lib/shared/catalogColors';

export const PRODUCT_SHEET_MAX_FAMILIES = 20;
export const PRODUCT_SHEET_MAX_ROWS = 400;
export const PRODUCT_SHEET_SEARCH_LIMIT = 25;

const FAMILY_SELECT =
  'title brand sku barcode hsnCode gstPercent mrp sellingPrice price discountPercent maxDiscountPercent moneyInPaise stockUnit colour unit variationAttributes heroImage gallery productType parentProductId deletedAt';

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(String(id || ''));
}

function toIdString(value) {
  if (!value) return '';
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
}

function resolveHeroImage(product, parent) {
  if (product?.heroImage?.trim()) return product.heroImage.trim();
  const galleryImage = Array.isArray(product?.gallery) ? product.gallery.find(Boolean) : '';
  if (galleryImage) return String(galleryImage).trim();
  if (parent?.heroImage?.trim()) return parent.heroImage.trim();
  const parentGallery = Array.isArray(parent?.gallery) ? parent.gallery.find(Boolean) : '';
  return parentGallery ? String(parentGallery).trim() : '';
}

function displayRupees(product, field) {
  const raw = Number(product?.[field] ?? 0);
  if (!raw) return 0;
  const rupees = product?.moneyInPaise ? raw / 100 : raw;
  return Math.round(rupees);
}

function sizeSortKey(size) {
  const n = parseFloat(String(size || '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

function variantSize(product) {
  return (
    product?.variationAttributes?.size ||
    product?.variationAttributes?.unitCount ||
    ''
  );
}

function variantColor(product) {
  return product?.variationAttributes?.color || product?.colour || '';
}

function variantUnit(product) {
  return (
    product?.stockUnit ||
    product?.variationAttributes?.unit ||
    product?.unit ||
    'Pcs'
  );
}

const SHEET_FAMILY_TYPES = ['parent', 'standalone'];

function sheetFamilyBaseFilter() {
  return {
    deletedAt: null,
    productType: { $in: SHEET_FAMILY_TYPES },
  };
}

/**
 * Brands on the sheet picker universe (parents and standalones).
 * Not the ledger-only inventory brand list — that would hide families
 * that have never been stocked.
 */
export async function listProductSheetBrands() {
  const brands = await Product.distinct('brand', {
    ...sheetFamilyBaseFilter(),
    brand: { $exists: true, $nin: [null, ''] },
  });

  return brands
    .map((brand) => String(brand).trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

function sortFacetLabels(values) {
  return [...values].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

/**
 * Colours that can appear on a sheet family: the family row itself
 * (standalone colour or parent swatches) or any child variant colour.
 * Case variants collapse to the catalog name when one exists.
 */
export async function listProductSheetColors() {
  const [variantColors, swatchColors, topColours] = await Promise.all([
    Product.distinct('variationAttributes.color', {
      deletedAt: null,
      productType: { $in: ['child', 'standalone'] },
      'variationAttributes.color': { $exists: true, $nin: [null, ''] },
    }),
    Product.distinct('colorVariants.colorName', {
      ...sheetFamilyBaseFilter(),
      'colorVariants.colorName': { $exists: true, $nin: [null, ''] },
    }),
    Product.distinct('colour', {
      ...sheetFamilyBaseFilter(),
      colour: { $exists: true, $nin: [null, ''] },
    }),
  ]);

  const colors = new Map();
  for (const raw of [...variantColors, ...swatchColors, ...topColours]) {
    const trimmed = String(raw || '').trim();
    if (!trimmed) continue;
    const label = canonicalizeCatalogColorName(trimmed) || trimmed;
    const key = label.toLowerCase();
    if (!colors.has(key)) colors.set(key, label);
  }
  return sortFacetLabels(colors.values());
}

/**
 * A family matches a colour when the parent/standalone row matches,
 * or any of its children does. Colour lives on the variant for most families.
 */
async function familyColorMatch(color) {
  const colorName = String(color || '').trim();
  if (!colorName) return null;
  const colorMatch = buildColorMatch([colorName]);
  if (!colorMatch) return null;

  const [directIds, parentIds] = await Promise.all([
    Product.distinct('_id', { $and: [sheetFamilyBaseFilter(), colorMatch] }),
    Product.distinct('parentProductId', {
      deletedAt: null,
      productType: 'child',
      parentProductId: { $ne: null },
      $and: [colorMatch],
    }),
  ]);

  const familyIds = [
    ...new Set([
      ...directIds.filter(Boolean).map((id) => String(id)),
      ...parentIds.filter(Boolean).map((id) => String(id)),
    ]),
  ]
    .filter(isValidId)
    .map((id) => new mongoose.Types.ObjectId(id));

  return { _id: { $in: familyIds } };
}

/**
 * Family is "in inventory" when the standalone/parent itself has presence,
 * or any of its children does. Presence matches Add to Inventory:
 * ledger history or a stock row with qty > 0.
 */
async function familyInventoryMatch(inventoryStatus) {
  const status = String(inventoryStatus || 'all');
  if (status !== 'in' && status !== 'out') return null;

  const presenceIds = (await getInventoryPresenceProductIds()).filter(isValidId);
  const presenceOids = presenceIds.map((id) => new mongoose.Types.ObjectId(id));

  const parentIdsWithStock = presenceOids.length
    ? await Product.distinct('parentProductId', {
        deletedAt: null,
        productType: 'child',
        _id: { $in: presenceOids },
        parentProductId: { $ne: null },
      })
    : [];

  const familyIds = [
    ...new Set([
      ...presenceIds,
      ...parentIdsWithStock.filter(Boolean).map((id) => String(id)),
    ]),
  ]
    .filter(isValidId)
    .map((id) => new mongoose.Types.ObjectId(id));

  if (status === 'in') {
    return { _id: { $in: familyIds } };
  }
  if (!familyIds.length) return null;
  return { _id: { $nin: familyIds } };
}

/**
 * Search parent families and standalone SKUs for the picker.
 * Children are not listed — selecting a parent expands every variant.
 *
 * Brand, colour, and inventoryStatus narrow this list before the limit.
 * They do not change sheet generation, which still takes explicit ids.
 */
export async function searchProductSheetFamilies(
  query,
  limit = PRODUCT_SHEET_SEARCH_LIMIT,
  { brand = '', color = '', inventoryStatus = 'all' } = {}
) {
  const capped = Math.min(Math.max(Number(limit) || PRODUCT_SHEET_SEARCH_LIMIT, 1), 50);
  const and = [sheetFamilyBaseFilter()];

  const term = String(query || '').trim();
  if (term) {
    const searchFilter = await buildSalesCatalogSearchFilter(term);
    if (searchFilter) and.push(searchFilter);
  }

  const brandName = String(brand || '').trim();
  if (brandName) {
    const brandMatch = buildBrandMatch([brandName]);
    if (brandMatch) and.push(brandMatch);
  }

  const colorMatch = await familyColorMatch(color);
  if (colorMatch) and.push(colorMatch);

  const inventoryMatch = await familyInventoryMatch(inventoryStatus);
  if (inventoryMatch) and.push(inventoryMatch);

  const products = await Product.find({ $and: and })
    .select('title brand sku heroImage gallery productType')
    .sort({ title: 1 })
    .limit(capped)
    .lean();

  return products.map((p) => ({
    _id: String(p._id),
    title: p.title || '',
    brand: p.brand || '',
    sku: p.sku || '',
    productType: p.productType,
    heroImage: resolveHeroImage(p, null),
  }));
}

async function loadSelectedDocuments(productIds) {
  const unique = [...new Set(productIds.map(String).filter(isValidId))];
  if (!unique.length) return [];
  return Product.find({ _id: { $in: unique }, deletedAt: null })
    .select(FAMILY_SELECT)
    .populate('parentProductId', FAMILY_SELECT)
    .lean();
}

/**
 * Turn mixed picker IDs (parent / child / standalone) into unique family roots.
 */
function resolveFamilyRoots(selectedDocs) {
  const roots = new Map();

  for (const doc of selectedDocs) {
    if (doc.productType === 'child') {
      const parent = doc.parentProductId;
      if (parent && typeof parent === 'object' && parent._id) {
        roots.set(String(parent._id), parent);
      } else if (parent) {
        roots.set(toIdString(parent), { _id: parent, productType: 'parent' });
      }
      continue;
    }
    roots.set(String(doc._id), doc);
  }

  return [...roots.values()];
}

function buildRow(product, parent, qty, locationLabel) {
  const mrp = displayRupees(product, 'mrp');
  const selling = displayRupees(product, 'sellingPrice') || displayRupees(product, 'price');
  const gst = Number(product.gstPercent) || 0;
  const maxDiscount = getProductMaxDiscountPercent(product);

  return {
    productId: String(product._id),
    image: resolveHeroImage(product, parent),
    name: product.title || '',
    size: variantSize(product),
    unit: variantUnit(product),
    color: variantColor(product),
    sku: product.sku || '',
    barcode: product.barcode || '',
    hsnCode: product.hsnCode || '',
    gstPercent: gst,
    mrp,
    sellingPrice: selling,
    maxDiscountPercent: maxDiscount,
    qty,
    location: locationLabel || '—',
  };
}

/**
 * @param {string[]} productIds
 */
export async function buildProductStockSheet(productIds) {
  const selected = await loadSelectedDocuments(productIds);
  if (!selected.length) {
    return { groups: [], totals: { families: 0, variants: 0, qty: 0 } };
  }

  let roots = resolveFamilyRoots(selected);
  const missingParentIds = roots
    .filter((r) => !r.title && r.productType === 'parent')
    .map((r) => String(r._id));

  if (missingParentIds.length) {
    const loaded = await Product.find({ _id: { $in: missingParentIds }, deletedAt: null })
      .select(FAMILY_SELECT)
      .lean();
    const byId = new Map(loaded.map((p) => [String(p._id), p]));
    roots = roots.map((r) => byId.get(String(r._id)) || r).filter((r) => r?.title);
  }

  if (roots.length > PRODUCT_SHEET_MAX_FAMILIES) {
    const error = new Error(
      `Select at most ${PRODUCT_SHEET_MAX_FAMILIES} products at a time.`
    );
    error.status = 400;
    throw error;
  }

  const parentIds = roots.filter((r) => r.productType === 'parent').map((r) => r._id);
  const children = parentIds.length
    ? await Product.find({
        parentProductId: { $in: parentIds },
        deletedAt: null,
      })
        .select(FAMILY_SELECT)
        .sort({ createdAt: 1 })
        .lean()
    : [];

  const childrenByParent = new Map();
  for (const child of children) {
    const pid = toIdString(child.parentProductId);
    if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
    childrenByParent.get(pid).push(child);
  }

  const skuDocs = [];
  for (const root of roots) {
    if (root.productType === 'parent') {
      skuDocs.push(...(childrenByParent.get(String(root._id)) || []));
    } else {
      skuDocs.push(root);
    }
  }

  if (skuDocs.length > PRODUCT_SHEET_MAX_ROWS) {
    const error = new Error(
      `This selection has ${skuDocs.length} variants. Select fewer products (max ${PRODUCT_SHEET_MAX_ROWS} rows).`
    );
    error.status = 400;
    throw error;
  }

  const skuIds = skuDocs.map((p) => p._id);
  const stockRows = skuIds.length
    ? await Stock.find({
        productId: { $in: skuIds },
        statusBucket: { $ne: 'sold' },
        qty: { $gt: 0 },
      })
        .select('productId locationId qty')
        .lean()
    : [];

  const allLocs = await listAllLocations();
  const locById = new Map(allLocs.map((l) => [String(l._id), l]));

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

  const parentById = new Map(roots.map((r) => [String(r._id), r]));
  const groups = [];
  let totalQty = 0;

  for (const root of roots) {
    const variants =
      root.productType === 'parent'
        ? childrenByParent.get(String(root._id)) || []
        : [root];

    const rows = variants
      .map((sku) => {
        const pid = String(sku._id);
        const qty = qtyByProduct.get(pid) || 0;
        const locations = locationsByProduct.get(pid) || [];
        totalQty += qty;
        return buildRow(
          sku,
          root.productType === 'parent' ? parentById.get(String(root._id)) : null,
          qty,
          locations.join(', ')
        );
      })
      .sort((a, b) => {
        const sizeDiff = sizeSortKey(a.size) - sizeSortKey(b.size);
        if (sizeDiff !== 0) return sizeDiff;
        return String(a.name).localeCompare(String(b.name));
      });

    groups.push({
      familyId: String(root._id),
      brand: root.brand || '—',
      familyTitle: root.title || '',
      productType: root.productType,
      rows,
    });
  }

  groups.sort((a, b) => {
    const brandCmp = String(a.brand).localeCompare(String(b.brand));
    if (brandCmp !== 0) return brandCmp;
    return String(a.familyTitle).localeCompare(String(b.familyTitle));
  });

  return {
    generatedAt: new Date().toISOString(),
    groups,
    totals: {
      families: groups.length,
      variants: groups.reduce((n, g) => n + g.rows.length, 0),
      qty: totalQty,
    },
  };
}

export const PRODUCT_SHEET_COLUMNS = [
  { header: 'S.NO', key: 'sno', width: 8 },
  { header: 'Image', key: 'image', width: 18 },
  { header: 'Name', key: 'name', width: 42 },
  { header: 'Size', key: 'size', width: 12 },
  { header: 'Unit', key: 'unit', width: 10 },
  { header: 'Color', key: 'color', width: 12 },
  { header: 'SKU', key: 'sku', width: 14 },
  { header: 'Barcode', key: 'barcode', width: 16 },
  { header: 'HSN Code', key: 'hsn', width: 12 },
  { header: 'GST%', key: 'gst', width: 8 },
  { header: 'MRP', key: 'mrp', width: 10 },
  { header: 'SP', key: 'sp', width: 10 },
  { header: 'MAX DISCOUNT %', key: 'discount', width: 16 },
  { header: 'TOTAL QNTY', key: 'qty', width: 12 },
  { header: 'LOCATION', key: 'location', width: 28 },
];

/**
 * Excel workbook for the stock sheet. Images are omitted — print view carries thumbnails.
 */
export async function buildProductStockSheetWorkbook(sheet) {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Regal Admin';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Product stock sheet', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, paperSize: 9 },
  });
  ws.columns = PRODUCT_SHEET_COLUMNS;

  let excelRow = 1;
  for (const group of sheet.groups) {
    ws.mergeCells(excelRow, 1, excelRow, 15);
    const brandCell = ws.getCell(excelRow, 1);
    brandCell.value = `BRAND  ${group.brand}`;
    brandCell.font = { bold: true, color: { argb: 'FFB91C1C' }, size: 14 };
    excelRow += 1;

    ws.mergeCells(excelRow, 1, excelRow, 15);
    const titleCell = ws.getCell(excelRow, 1);
    titleCell.value = group.familyTitle;
    titleCell.font = { bold: true, size: 11 };
    excelRow += 1;

    const header = ws.getRow(excelRow);
    PRODUCT_SHEET_COLUMNS.forEach((col, idx) => {
      const cell = header.getCell(idx + 1);
      cell.value = col.header;
      cell.font = { bold: true };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
    excelRow += 1;

    group.rows.forEach((row, index) => {
      const r = ws.getRow(excelRow);
      const values = [
        index + 1,
        row.image || '—',
        row.name,
        row.size || '—',
        row.unit || '—',
        row.color || '—',
        row.sku || '—',
        row.barcode || '—',
        row.hsnCode || '—',
        row.gstPercent ? `${row.gstPercent}%` : '—',
        row.mrp || 0,
        row.sellingPrice || 0,
        row.maxDiscountPercent ? `${row.maxDiscountPercent}%` : '—',
        row.qty,
        row.location || '—',
      ];
      values.forEach((value, idx) => {
        const cell = r.getCell(idx + 1);
        cell.value = value;
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
        cell.alignment = { vertical: 'middle', wrapText: true };
      });
      excelRow += 1;
    });

    excelRow += 1;
  }

  return workbook;
}
