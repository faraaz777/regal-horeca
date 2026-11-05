/**
 * Toggleable brand-report columns.
 *
 * Product identity (name, and image on screen/PDF) stays fixed.
 * Everything else can be turned off, and the same list drives
 * the table, Excel, and PDF so exports never show hidden fields.
 */

export const BRAND_REPORT_COLUMN_STORAGE_KEY = 'regal.brandReport.visibleColumns';

export const BRAND_REPORT_TOGGLE_COLUMNS = [
  { id: 'size', label: 'Size', excelHeader: 'Size', excelKey: 'size', excelWidth: 12, align: 'left' },
  { id: 'unit', label: 'Unit', excelHeader: 'Unit', excelKey: 'unit', excelWidth: 10, align: 'left' },
  { id: 'color', label: 'Color', excelHeader: 'Color', excelKey: 'color', excelWidth: 14, align: 'left' },
  { id: 'sku', label: 'SKU', excelHeader: 'SKU', excelKey: 'sku', excelWidth: 16, align: 'left' },
  { id: 'barcode', label: 'Barcode', excelHeader: 'Barcode', excelKey: 'barcode', excelWidth: 18, align: 'left' },
  { id: 'hsnCode', label: 'HSN', excelHeader: 'HSN Code', excelKey: 'hsnCode', excelWidth: 12, align: 'left' },
  { id: 'gstPercent', label: 'GST', excelHeader: 'GST%', excelKey: 'gstPercent', excelWidth: 8, align: 'right' },
  { id: 'mrp', label: 'MRP', excelHeader: 'MRP', excelKey: 'mrp', excelWidth: 10, align: 'right' },
  { id: 'sellingPrice', label: 'SP', excelHeader: 'SP', excelKey: 'sellingPrice', excelWidth: 10, align: 'right' },
  { id: 'maxDiscountPercent', label: 'Disc', excelHeader: 'Max discount %', excelKey: 'maxDiscountPercent', excelWidth: 16, align: 'right' },
  { id: 'totalQuantity', label: 'Qty', excelHeader: 'Total qty', excelKey: 'totalQuantity', excelWidth: 12, align: 'right' },
  { id: 'minQuantity', label: 'Min', excelHeader: 'Min', excelKey: 'minQuantity', excelWidth: 10, align: 'right' },
  { id: 'maxQuantity', label: 'Max', excelHeader: 'Max', excelKey: 'maxQuantity', excelWidth: 10, align: 'right' },
  { id: 'reorderQty', label: 'Reorder', excelHeader: 'Reorder qty', excelKey: 'reorderQty', excelWidth: 14, align: 'right' },
  { id: 'location', label: 'Location', excelHeader: 'Location', excelKey: 'location', excelWidth: 28, align: 'left' },
  { id: 'articleStatus', label: 'Article', excelHeader: 'Article status', excelKey: 'articleStatus', excelWidth: 18, align: 'left' },
  { id: 'stockStatus', label: 'Stock', excelHeader: 'Stock status', excelKey: 'stockStatus', excelWidth: 14, align: 'left' },
];

export const BRAND_REPORT_DEFAULT_COLUMN_IDS = BRAND_REPORT_TOGGLE_COLUMNS.map((column) => column.id);

const COLUMN_IDS = new Set(BRAND_REPORT_DEFAULT_COLUMN_IDS);

export function normalizeBrandReportColumns(input) {
  const list = Array.isArray(input) ? input.map(String) : [];
  const seen = new Set();
  const out = [];
  for (const id of list) {
    if (!COLUMN_IDS.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out.length ? out : [...BRAND_REPORT_DEFAULT_COLUMN_IDS];
}

export function resolveBrandReportColumns(columnIds) {
  const wanted = new Set(normalizeBrandReportColumns(columnIds));
  return BRAND_REPORT_TOGGLE_COLUMNS.filter((column) => wanted.has(column.id));
}

export function readStoredBrandReportColumns() {
  if (typeof window === 'undefined') return [...BRAND_REPORT_DEFAULT_COLUMN_IDS];
  try {
    const raw = window.localStorage.getItem(BRAND_REPORT_COLUMN_STORAGE_KEY);
    if (!raw) return [...BRAND_REPORT_DEFAULT_COLUMN_IDS];
    return normalizeBrandReportColumns(JSON.parse(raw));
  } catch {
    return [...BRAND_REPORT_DEFAULT_COLUMN_IDS];
  }
}

export function storeBrandReportColumns(columnIds) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      BRAND_REPORT_COLUMN_STORAGE_KEY,
      JSON.stringify(normalizeBrandReportColumns(columnIds))
    );
  } catch {
    // Ignore quota / private-mode failures.
  }
}
