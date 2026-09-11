/**
 * Product import validate orchestrator.
 *
 * Read-only: parse workbook, resolve taxonomy, barcode-check, map payloads.
 * Does not insert products. Fill-form (Phase 1) uses payload without _id.
 */

import 'server-only';

import Brand from '@/lib/models/Brand';
import Category from '@/lib/models/Category';
import BusinessType from '@/lib/models/BusinessType';
import { parseProductWorkbook } from '@/lib/server/products/import/parseProductWorkbook';
import { validateImportRows } from '@/lib/server/products/import/validateImportRows';
import { mapRowToProductPayload } from '@/lib/server/products/import/mapRowToProductPayload';
import { PRODUCT_IMPORT_MAX_FILE_BYTES } from '@/lib/server/products/import/productImportColumns';

export async function loadImportCatalogs() {
  const [brands, categories, businessTypes] = await Promise.all([
    Brand.find({}).select('name slug level parent').lean(),
    Category.find({}).select('name slug level parent').lean(),
    BusinessType.find({}).select('name slug').lean(),
  ]);
  return { brands, categories, businessTypes };
}

export async function runProductImportValidate(buffer, { originalName } = {}) {
  if (!buffer || !buffer.length) {
    return { ok: false, fileErrors: ['The uploaded file is empty.'], products: [] };
  }
  if (buffer.length > PRODUCT_IMPORT_MAX_FILE_BYTES) {
    return {
      ok: false,
      fileErrors: ['File is larger than 5 MB. Split the workbook and try again.'],
      products: [],
    };
  }

  const name = String(originalName || '').toLowerCase();
  if (name && !name.endsWith('.xlsx')) {
    return {
      ok: false,
      fileErrors: ['Use the official .xlsx template (Excel). CSV is not accepted in this version.'],
      products: [],
    };
  }

  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    return {
      ok: false,
      fileErrors: ['Could not read this file. Save it as .xlsx from Excel and upload the template format.'],
      products: [],
    };
  }

  const parsed = parseProductWorkbook(workbook);
  if (parsed.fileErrors.length > 0 && parsed.products.length === 0) {
    return { ok: false, fileErrors: parsed.fileErrors, products: [] };
  }

  const catalogs = await loadImportCatalogs();
  const { results, orphanVariantErrors } = await validateImportRows({
    products: parsed.products,
    variants: parsed.variants,
    catalogs,
  });

  const fileErrors = [...parsed.fileErrors, ...orphanVariantErrors];
  const products = results.map((entry) => {
    const valid = entry.errors.length === 0;
    return {
      excelRow: entry.excelRow,
      title: entry.title,
      sellingType: entry.resolved.sellingType,
      variantCount: entry.variantRows.length,
      errors: entry.errors,
      warnings: entry.warnings,
      payload: valid ? mapRowToProductPayload(entry) : null,
    };
  });

  const validCount = products.filter((p) => p.payload).length;
  return {
    ok: fileErrors.length === 0 && validCount > 0,
    fileErrors,
    validCount,
    errorCount: products.filter((p) => !p.payload).length,
    products,
  };
}
