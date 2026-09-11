/**
 * Row-level validation for product Excel import.
 *
 * Fail the row, never invent taxonomy or skip barcode clashes.
 * Warnings do not block fill-form (Phase 1 still needs title + hero to Save).
 */

import { findBarcodeConflicts, normalizeBarcode } from '@/lib/server/products/barcodeValidation';
import {
  indexTaxonomy,
  resolveBrandName,
  resolveNamedPath,
  resolveBusinessTypes,
} from '@/lib/server/products/import/resolveImportTaxonomy';

const CATEGORY_LEVELS = ['department', 'category', 'subcategory', 'type'];

export function parseYesNo(value, fallback = false) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return fallback;
  if (['yes', 'y', 'true', '1'].includes(raw)) return true;
  if (['no', 'n', 'false', '0'].includes(raw)) return false;
  return null;
}

export function parseSellingType(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw || raw === 'standalone' || raw === 'single' || raw === 'no') return 'standalone';
  if (raw === 'variants' || raw === 'variant' || raw === 'yes' || raw === 'parent') return 'variants';
  return null;
}

export function parseNumber(value) {
  const raw = String(value ?? '').replace(/,/g, '').trim();
  if (!raw) return { value: 0, empty: true, ok: true };
  const num = Number(raw);
  if (!Number.isFinite(num)) return { value: 0, empty: false, ok: false };
  return { value: num, empty: false, ok: true };
}

export function splitUrlList(raw) {
  return String(raw || '')
    .split(/[,|;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function pricingErrors(prefix, mrp, selling, discount, margin) {
  const errors = [];
  if (!mrp.ok) errors.push(`${prefix}MRP is not a number.`);
  if (!selling.ok) errors.push(`${prefix}Selling price is not a number.`);
  if (!discount.ok) errors.push(`${prefix}Max discount % is not a number.`);
  if (!margin.ok) errors.push(`${prefix}Margin price is not a number.`);
  if (mrp.ok && selling.ok && selling.value > mrp.value && selling.value > 0 && mrp.value > 0) {
    errors.push(`${prefix}Selling price cannot exceed MRP.`);
  }
  if (selling.ok && margin.ok && margin.value > selling.value && margin.value > 0) {
    errors.push(`${prefix}Margin price cannot exceed selling price.`);
  }
  if (discount.ok && discount.value >= 100) {
    errors.push(`${prefix}Max discount % must be below 100.`);
  }
  if (discount.ok && discount.value < 0) {
    errors.push(`${prefix}Max discount % cannot be negative.`);
  }
  return errors;
}

function variantAxisCount(rows) {
  const axes = {
    size: rows.some((r) => String(r.values.size || '').trim()),
    colour: rows.some((r) => String(r.values.colour || '').trim()),
    weight: rows.some((r) => String(r.values.weight || '').trim()),
    unit_count: rows.some((r) => String(r.values.unit_count || '').trim()),
  };
  return Object.values(axes).filter(Boolean).length;
}

/**
 * Attach variant rows to product rows, then collect errors / warnings.
 */
export async function validateImportRows({ products, variants, catalogs }) {
  const brandIndex = indexTaxonomy(catalogs.brands);
  const categoryIndex = indexTaxonomy(catalogs.categories);

  const productByTitle = new Map();
  const productByExcelRow = new Map();
  const results = products.map((row) => {
    const title = String(row.values.title || '').trim();
    const titleKey = title.toLowerCase();
    const entry = {
      excelRow: row.excelRow,
      title,
      values: row.values,
      variantRows: [],
      errors: [],
      warnings: [],
      resolved: {},
    };
    if (titleKey) {
      if (!productByTitle.has(titleKey)) productByTitle.set(titleKey, []);
      productByTitle.get(titleKey).push(entry);
    }
    productByExcelRow.set(row.excelRow, entry);
    return entry;
  });

  const orphanVariants = [];
  for (const vRow of variants) {
    const vals = vRow.values;
    const hasData = Object.entries(vals).some(
      ([key, val]) => !['parent_title', 'parent_row'].includes(key) && String(val).trim()
    );
    if (!hasData) continue;

    const parentRowNum = Number(String(vals.parent_row || '').trim());
    let parent =
      Number.isFinite(parentRowNum) && parentRowNum >= 2
        ? productByExcelRow.get(parentRowNum)
        : null;
    if (!parent) {
      const titleKey = String(vals.parent_title || '').trim().toLowerCase();
      const matches = titleKey ? productByTitle.get(titleKey) || [] : [];
      if (matches.length === 1) parent = matches[0];
      else if (matches.length > 1) {
        orphanVariants.push({
          excelRow: vRow.excelRow,
          error: `Variants row ${vRow.excelRow}: parent_title "${vals.parent_title}" matches more than one Products row. Set parent_row.`,
        });
        continue;
      }
    }
    if (!parent) {
      orphanVariants.push({
        excelRow: vRow.excelRow,
        error: `Variants row ${vRow.excelRow}: no matching Products.title for "${vals.parent_title || ''}".`,
      });
      continue;
    }
    parent.variantRows.push(vRow);
  }

  const barcodes = [];
  for (const entry of results) {
    const sellingType = parseSellingType(entry.values.selling_type);
    if (sellingType == null) {
      entry.errors.push('selling_type must be standalone or variants.');
    }
    entry.resolved.sellingType = sellingType || 'standalone';

    const featured = parseYesNo(entry.values.featured, false);
    if (featured == null) entry.errors.push('featured must be yes or no.');
    entry.resolved.featured = featured === true;

    const brand = resolveBrandName(
      entry.values.brand,
      entry.values.brand_level_hint,
      brandIndex
    );
    entry.errors.push(...brand.errors);
    entry.resolved.brandCategoryId = brand.id;
    entry.resolved.brandDisplayName = brand.displayName || String(entry.values.brand || '').trim();
    if (String(entry.values.brand || '').trim() && !brand.id) {
      // errors already added
    } else if (!String(entry.values.brand || '').trim()) {
      entry.warnings.push('No brand linked. You can set it on the form before Save.');
    }

    const category = resolveNamedPath(
      {
        department: entry.values.department,
        category: entry.values.category,
        subcategory: entry.values.subcategory,
        type: entry.values.type,
      },
      categoryIndex,
      CATEGORY_LEVELS
    );
    entry.errors.push(...category.errors);
    entry.resolved.categoryId = category.id;
    const hasCategoryPath = CATEGORY_LEVELS.some((level) => String(entry.values[level] || '').trim());
    if (!category.id && !hasCategoryPath) {
      entry.warnings.push('No category path. You can set it on the form before Save.');
    }

    const business = resolveBusinessTypes(entry.values.business_types, catalogs.businessTypes);
    entry.errors.push(...business.errors);
    entry.resolved.businessTypeSlugs = business.slugs;

    const mrp = parseNumber(entry.values.mrp);
    const selling = parseNumber(entry.values.selling_price);
    const discount = parseNumber(entry.values.max_discount_percent);
    const margin = parseNumber(entry.values.margin_price);
    const gst = parseNumber(entry.values.gst_percent);
    if (!gst.ok) entry.errors.push('GST% is not a number.');
    entry.resolved.mrp = mrp;
    entry.resolved.selling = selling;
    entry.resolved.discount = discount;
    entry.resolved.margin = margin;
    entry.resolved.gst = gst;

    if (entry.resolved.sellingType === 'standalone') {
      entry.errors.push(...pricingErrors('', mrp, selling, discount, margin));
      if (entry.variantRows.length > 0) {
        entry.errors.push(
          'selling_type is standalone but Variants rows exist for this title. Switch to variants or remove those rows.'
        );
      }
    } else if (entry.variantRows.length === 0) {
      entry.errors.push('selling_type is variants but no Variants rows match this product.');
    } else {
      const axes = variantAxisCount(entry.variantRows);
      if (axes > 2) {
        entry.warnings.push(
          'More than two variant axes are filled. The form normally allows two (size, colour, weight, unit count). Shape is never a variant.'
        );
      }
    }

    const hero = String(entry.values.hero_image_url || '').trim();
    if (hero && !isHttpUrl(hero)) {
      entry.errors.push('hero_image_url must start with http:// or https://.');
    }
    if (!hero) {
      entry.warnings.push('No hero image. Upload one on the Media step before Save.');
    }
    for (const url of splitUrlList(entry.values.gallery_urls)) {
      if (!isHttpUrl(url)) entry.errors.push(`Gallery URL is not http(s): ${url}`);
    }

    const parentBarcode = normalizeBarcode(entry.values.barcode);
    if (entry.resolved.sellingType === 'standalone' && parentBarcode) {
      barcodes.push({ barcode: parentBarcode, excelRow: entry.excelRow, title: entry.title });
    }

    for (const vRow of entry.variantRows) {
      const vMrp = parseNumber(vRow.values.mrp);
      const vSelling = parseNumber(vRow.values.selling_price);
      const vDiscount = parseNumber(vRow.values.max_discount_percent);
      const vMargin = parseNumber(vRow.values.margin_price);
      const vGst = parseNumber(vRow.values.gst_percent);
      if (!vGst.ok) entry.errors.push(`Variants row ${vRow.excelRow}: GST% is not a number.`);
      entry.errors.push(
        ...pricingErrors(`Variants row ${vRow.excelRow}: `, vMrp, vSelling, vDiscount, vMargin)
      );
      const yesDefault = parseYesNo(vRow.values.is_default, false);
      if (yesDefault == null) {
        entry.errors.push(`Variants row ${vRow.excelRow}: is_default must be yes or no.`);
      }
      const show = parseYesNo(vRow.values.show_in_catalog, true);
      if (show == null) {
        entry.errors.push(`Variants row ${vRow.excelRow}: show_in_catalog must be yes or no.`);
      }
      for (const url of splitUrlList(vRow.values.image_urls)) {
        if (!isHttpUrl(url)) {
          entry.errors.push(`Variants row ${vRow.excelRow}: image URL is not http(s): ${url}`);
        }
      }
      const vBarcode = normalizeBarcode(vRow.values.barcode);
      if (vBarcode) {
        barcodes.push({
          barcode: vBarcode,
          excelRow: vRow.excelRow,
          title: `${entry.title} (variant)`,
        });
      }
      vRow.resolved = {
        mrp: vMrp,
        selling: vSelling,
        discount: vDiscount,
        margin: vMargin,
        gst: vGst,
        isDefault: yesDefault === true,
        showInCatalog: show !== false,
      };
    }
  }

  const inFile = new Map();
  for (const item of barcodes) {
    if (inFile.has(item.barcode)) {
      const first = inFile.get(item.barcode);
      const target = results.find((r) => r.excelRow === item.excelRow) ||
        results.find((r) => r.variantRows.some((v) => v.excelRow === item.excelRow));
      if (target) {
        target.errors.push(
          `Duplicate barcode "${item.barcode}" in this file (also row ${first.excelRow}).`
        );
      }
    } else {
      inFile.set(item.barcode, item);
    }
  }

  const uniqueBarcodes = [...inFile.keys()];
  if (uniqueBarcodes.length > 0) {
    const conflicts = await findBarcodeConflicts(uniqueBarcodes);
    const byBarcode = new Map();
    for (const conflict of conflicts) {
      if (!byBarcode.has(conflict.barcode)) byBarcode.set(conflict.barcode, conflict);
    }
    for (const entry of results) {
      const check = [
        entry.resolved.sellingType === 'standalone' ? normalizeBarcode(entry.values.barcode) : '',
        ...entry.variantRows.map((v) => normalizeBarcode(v.values.barcode)),
      ].filter(Boolean);
      for (const barcode of check) {
        const hit = byBarcode.get(barcode);
        if (hit) {
          entry.errors.push(`Barcode "${barcode}" is already used by "${hit.title}".`);
        }
      }
    }
  }

  return { results, orphanVariantErrors: orphanVariants.map((o) => o.error) };
}
