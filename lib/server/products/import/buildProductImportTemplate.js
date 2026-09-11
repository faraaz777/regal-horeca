/**
 * Official blank .xlsx for product data-entry.
 *
 * Header names are the contract. Example data is kept on Instructions so
 * uploading an unmodified template does not look like a real catalog row.
 */

import {
  PRODUCT_COLUMNS,
  VARIANT_COLUMNS,
  PRODUCT_IMPORT_INSTRUCTIONS,
  PRODUCT_IMPORT_SHEETS,
} from '@/lib/server/products/import/productImportColumns';

function styleHeader(row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F2937' },
  };
  row.alignment = { vertical: 'middle', wrapText: true };
  row.height = 22;
}

function addDropdown(sheet, columnIndex, lastRow, formulae) {
  for (let r = 2; r <= lastRow; r += 1) {
    sheet.getCell(r, columnIndex).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${formulae}"`],
      showErrorMessage: true,
      error: 'Use a value from the list.',
    };
  }
}

export async function buildProductImportTemplate() {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Regal Admin';
  workbook.created = new Date();

  const instructions = workbook.addWorksheet(PRODUCT_IMPORT_SHEETS.instructions);
  instructions.getColumn(1).width = 110;
  PRODUCT_IMPORT_INSTRUCTIONS.forEach((line, idx) => {
    const cell = instructions.getCell(idx + 1, 1);
    cell.value = line;
    cell.alignment = { wrapText: true, vertical: 'top' };
    if (idx === 0) cell.font = { bold: true, size: 14 };
  });

  const products = workbook.addWorksheet(PRODUCT_IMPORT_SHEETS.products);
  products.columns = PRODUCT_COLUMNS.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width,
  }));
  styleHeader(products.getRow(1));
  products.views = [{ state: 'frozen', ySplit: 1 }];
  products.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: PRODUCT_COLUMNS.length },
  };

  const hintCol = PRODUCT_COLUMNS.findIndex((c) => c.key === 'brand_level_hint') + 1;
  const featuredCol = PRODUCT_COLUMNS.findIndex((c) => c.key === 'featured') + 1;
  const sellingCol = PRODUCT_COLUMNS.findIndex((c) => c.key === 'selling_type') + 1;
  addDropdown(products, hintCol, 80, 'department,category,subcategory');
  addDropdown(products, featuredCol, 80, 'yes,no');
  addDropdown(products, sellingCol, 80, 'standalone,variants');

  const variants = workbook.addWorksheet(PRODUCT_IMPORT_SHEETS.variants);
  variants.columns = VARIANT_COLUMNS.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width,
  }));
  styleHeader(variants.getRow(1));
  variants.views = [{ state: 'frozen', ySplit: 1 }];
  variants.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: VARIANT_COLUMNS.length },
  };
  const defaultCol = VARIANT_COLUMNS.findIndex((c) => c.key === 'is_default') + 1;
  const catalogCol = VARIANT_COLUMNS.findIndex((c) => c.key === 'show_in_catalog') + 1;
  addDropdown(variants, defaultCol, 200, 'yes,no');
  addDropdown(variants, catalogCol, 200, 'yes,no');

  return workbook;
}
