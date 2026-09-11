/**
 * Product Excel import — column contract.
 *
 * This is the official template for data-entry. The wizard remains the source
 * of truth; Excel only maps into the same payload the Add form already saves.
 *
 * Unknown extra columns are ignored on purpose so vendor sheets can keep notes.
 */

export const PRODUCT_IMPORT_MAX_ROWS = 100;
export const PRODUCT_IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const PRODUCT_IMPORT_SHEETS = {
  products: 'Products',
  variants: 'Variants',
  instructions: 'Instructions',
};

export const PRODUCT_COLUMNS = [
  { key: 'title', header: 'title', width: 36, required: true },
  { key: 'brand', header: 'brand', width: 22 },
  { key: 'brand_level_hint', header: 'brand_level_hint', width: 18 },
  { key: 'department', header: 'department', width: 22 },
  { key: 'category', header: 'category', width: 22 },
  { key: 'subcategory', header: 'subcategory', width: 22 },
  { key: 'type', header: 'type', width: 22 },
  { key: 'business_types', header: 'business_types', width: 28 },
  { key: 'featured', header: 'featured', width: 12 },
  { key: 'summary', header: 'summary', width: 40 },
  { key: 'selling_type', header: 'selling_type', width: 16 },
  { key: 'sku', header: 'sku', width: 16 },
  { key: 'barcode', header: 'barcode', width: 18 },
  { key: 'hsn', header: 'hsn', width: 12 },
  { key: 'gst_percent', header: 'gst_percent', width: 12 },
  { key: 'mrp', header: 'mrp', width: 12 },
  { key: 'selling_price', header: 'selling_price', width: 14 },
  { key: 'max_discount_percent', header: 'max_discount_percent', width: 20 },
  { key: 'margin_price', header: 'margin_price', width: 14 },
  { key: 'unit', header: 'unit', width: 10 },
  { key: 'hero_image_url', header: 'hero_image_url', width: 36 },
  { key: 'gallery_urls', header: 'gallery_urls', width: 36 },
  { key: 'blog_url', header: 'blog_url', width: 28 },
];

export const VARIANT_COLUMNS = [
  { key: 'parent_title', header: 'parent_title', width: 36, required: true },
  { key: 'parent_row', header: 'parent_row', width: 12 },
  { key: 'size', header: 'size', width: 12 },
  { key: 'colour', header: 'colour', width: 14 },
  { key: 'weight', header: 'weight', width: 12 },
  { key: 'unit_count', header: 'unit_count', width: 12 },
  { key: 'sku', header: 'sku', width: 16 },
  { key: 'barcode', header: 'barcode', width: 18 },
  { key: 'hsn', header: 'hsn', width: 12 },
  { key: 'gst_percent', header: 'gst_percent', width: 12 },
  { key: 'mrp', header: 'mrp', width: 12 },
  { key: 'selling_price', header: 'selling_price', width: 14 },
  { key: 'max_discount_percent', header: 'max_discount_percent', width: 20 },
  { key: 'margin_price', header: 'margin_price', width: 14 },
  { key: 'unit', header: 'unit', width: 10 },
  { key: 'is_default', header: 'is_default', width: 12 },
  { key: 'show_in_catalog', header: 'show_in_catalog', width: 16 },
  { key: 'image_urls', header: 'image_urls', width: 36 },
];

export const PRODUCT_HEADER_TO_KEY = Object.fromEntries(
  PRODUCT_COLUMNS.map((col) => [normalizeHeader(col.header), col.key])
);
export const VARIANT_HEADER_TO_KEY = Object.fromEntries(
  VARIANT_COLUMNS.map((col) => [normalizeHeader(col.header), col.key])
);

export function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

export const PRODUCT_IMPORT_INSTRUCTIONS = [
  'Regal Horeca — Product import template',
  '',
  'This file is optional. The Add Product wizard still works without it.',
  'Fill this sheet offline, then Import on Products or Add Product.',
  'Nothing is saved to the catalog until you click Save on the form (Phase 1).',
  '',
  'Sheets',
  '- Products: one row = one standalone SKU, or one parent family.',
  '- Variants: child SKUs. Link with parent_title (must match Products.title).',
  '- Instructions: this page. Extra columns anywhere are ignored.',
  '',
  'Required',
  '- Products.title is required per product row.',
  '- Title + hero image are still required to Save. Hero can be uploaded in the form.',
  '',
  'selling_type',
  '- standalone = SKU / barcode / prices live on the Products row.',
  '- variants = leave parent SKU/barcode empty; fill the Variants sheet.',
  '',
  'Brand',
  '- Type the brand name exactly as in Admin → Brands.',
  '- If the same name exists at more than one level (e.g. A1 department and A1 category), set brand_level_hint to department, category, or subcategory.',
  '',
  'Category',
  '- Fill department → category → subcategory → type using catalog names (not IDs).',
  '- Partial path is allowed; unmatched names fail that row.',
  '',
  'business_types',
  '- Comma-separated names or slugs (Retail, Hotels, …).',
  '',
  'featured',
  '- yes or no. Homepage / header showcase only.',
  '',
  'Variants (business rule)',
  '- Variant axes are only size, colour, weight, unit_count. Shape is a new product, not a variant.',
  '- Prefer at most two axes per family (same as the form).',
  '- image_urls on a variant row are SKU-only overrides. Shared colour photos are uploaded in Media after import.',
  '',
  'Pricing',
  '- selling_price cannot exceed mrp.',
  '- margin_price cannot exceed selling_price.',
  '- max_discount_percent must be below 100. Sales uses this cap, not margin.',
  '',
  'Images',
  '- hero_image_url / gallery_urls / image_urls must be http(s) links if provided.',
  '- Inventory stock is NOT imported here. Use Inventory → Product sheet for stock.',
  '',
  `Limits: ${PRODUCT_IMPORT_MAX_ROWS} product rows, 5 MB file, .xlsx only.`,
];
