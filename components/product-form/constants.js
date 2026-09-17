/**
 * Product form constants.
 *
 * Variant axes match the Product model: shape is a new product, not a variant.
 * Colour / size / weight / unit count are the only SKU axes (max two at once).
 * Generate accepts 1 or 2 axes → m or m×n cartesian rows.
 */

export const PRODUCT_FORM_STEPS = [
  { id: 'product', label: 'Product' },
  { id: 'selling', label: 'Selling' },
  { id: 'media', label: 'Media' },
  { id: 'content', label: 'Content' },
];

export const LOCKED_CHILD_FIELD_CLASS =
  'disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed';

export const CATEGORY_LEVEL_ORDER = ['department', 'category', 'subcategory', 'type'];

export const BRAND_LEVEL_ORDER = ['department', 'category', 'subcategory'];

export const VARIANT_AXES = [
  { key: 'size', label: 'Size / Capacity', hint: '1.5L, 2L, 10"' },
  { key: 'color', label: 'Colour', hint: 'Black, Brass, Chrome' },
  { key: 'weight', label: 'Weight', hint: '500g, 1kg' },
  { key: 'unitCount', label: 'Unit Count', hint: 'Set of 4, 6 pcs' },
];

export const UNIT_OPTIONS = ['kg', 'g', 'gm', 'pcs', 'pc', 'set', 'pack', 'box', 'pair'];
