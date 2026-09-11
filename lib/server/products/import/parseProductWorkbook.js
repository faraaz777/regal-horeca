/**
 * Read a product-import .xlsx into plain row objects.
 *
 * Excel formulas are reduced to cached results when ExcelJS provides them.
 * Empty title rows are skipped; they are not errors.
 */

import {
  PRODUCT_COLUMNS,
  VARIANT_COLUMNS,
  PRODUCT_HEADER_TO_KEY,
  VARIANT_HEADER_TO_KEY,
  PRODUCT_IMPORT_MAX_ROWS,
  PRODUCT_IMPORT_SHEETS,
  normalizeHeader,
} from '@/lib/server/products/import/productImportColumns';

export function cellToString(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) ? String(value) : String(value);
  }
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'object') {
    if (value.result != null && value.result !== value) return cellToString(value.result);
    if (typeof value.text === 'string') return value.text.trim();
    if (Array.isArray(value.richText)) {
      return value.richText.map((part) => part?.text || '').join('').trim();
    }
    if (value.hyperlink) return String(value.text || value.hyperlink).trim();
  }
  return String(value).trim();
}

function sheetByName(workbook, name) {
  const wanted = String(name).toLowerCase();
  return workbook.worksheets.find((ws) => String(ws.name || '').trim().toLowerCase() === wanted);
}

function mapHeaderRow(worksheet, headerMap) {
  const headerRow = worksheet.getRow(1);
  const indexToKey = {};
  let recognized = 0;
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const key = headerMap[normalizeHeader(cellToString(cell.value))];
    if (key) {
      indexToKey[colNumber] = key;
      recognized += 1;
    }
  });
  return { indexToKey, recognized };
}

function readSheetRows(worksheet, columns, headerMap, { requireTitleKey, maxRows, sheetLabel }) {
  const fileErrors = [];
  const rows = [];
  if (!worksheet) {
    return { rows, fileErrors };
  }

  const { indexToKey, recognized } = mapHeaderRow(worksheet, headerMap);
  if (recognized === 0) {
    fileErrors.push(`${sheetLabel} sheet has no recognized column headers. Download a fresh template.`);
    return { rows, fileErrors };
  }

  const lastRow = worksheet.actualRowCount || worksheet.rowCount || 1;
  let dataCount = 0;

  for (let excelRow = 2; excelRow <= lastRow; excelRow += 1) {
    const sheetRow = worksheet.getRow(excelRow);
    const values = {};
    for (const col of columns) values[col.key] = '';

    sheetRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const key = indexToKey[colNumber];
      if (!key) return;
      values[key] = cellToString(cell.value);
    });

    const hasAny = Object.values(values).some((v) => String(v).trim());
    if (!hasAny) continue;

    if (requireTitleKey && !String(values[requireTitleKey] || '').trim()) {
      continue;
    }

    dataCount += 1;
    if (dataCount > maxRows) {
      fileErrors.push(
        `${sheetLabel} exceeds ${maxRows} rows. Split the file or remove extra rows.`
      );
      break;
    }

    rows.push({ excelRow, values });
  }

  return { rows, fileErrors };
}

/**
 * @param {import('exceljs').Workbook} workbook
 */
export function parseProductWorkbook(workbook) {
  const fileErrors = [];
  const productsSheet = sheetByName(workbook, PRODUCT_IMPORT_SHEETS.products);
  if (!productsSheet) {
    fileErrors.push(`Missing "${PRODUCT_IMPORT_SHEETS.products}" sheet. Download the official template.`);
    return { products: [], variants: [], fileErrors };
  }

  const productsParsed = readSheetRows(productsSheet, PRODUCT_COLUMNS, PRODUCT_HEADER_TO_KEY, {
    requireTitleKey: 'title',
    maxRows: PRODUCT_IMPORT_MAX_ROWS,
    sheetLabel: PRODUCT_IMPORT_SHEETS.products,
  });
  fileErrors.push(...productsParsed.fileErrors);

  const variantsSheet = sheetByName(workbook, PRODUCT_IMPORT_SHEETS.variants);
  const variantsParsed = readSheetRows(
    variantsSheet,
    VARIANT_COLUMNS,
    VARIANT_HEADER_TO_KEY,
    {
      requireTitleKey: null,
      maxRows: PRODUCT_IMPORT_MAX_ROWS * 20,
      sheetLabel: PRODUCT_IMPORT_SHEETS.variants,
    }
  );
  fileErrors.push(...variantsParsed.fileErrors);

  if (productsParsed.rows.length === 0 && fileErrors.length === 0) {
    fileErrors.push('No product rows found. Add at least one title on the Products sheet.');
  }

  return {
    products: productsParsed.rows,
    variants: variantsParsed.rows,
    fileErrors,
  };
}
