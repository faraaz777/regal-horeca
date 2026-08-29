/**
 * Taxonomy Menu Builder — config per entity type.
 *
 * Categories and brands share one UI engine; only levels, APIs, and fields differ.
 */

export const TAXONOMY_UI_STORAGE_KEY = 'regal.admin.taxonomy.ui';

/** @typedef {'classic' | 'menu-builder'} TaxonomyUiMode */

/** @typedef {'category' | 'brand'} TaxonomyType */

/**
 * @typedef {Object} TaxonomyConfig
 * @property {TaxonomyType} type
 * @property {string} title
 * @property {string} singularLabel
 * @property {string[]} levels
 * @property {string} apiBase - CRUD base path
 * @property {string} adminListApi - uncached flat list for admin
 * @property {string} reorderApi - batch reorder endpoint
 * @property {string} responseKey - key in API JSON (categories | brands)
 * @property {string} permissionRead
 * @property {string} permissionWrite
 * @property {string[]} editFields
 * @property {boolean} supportsImage
 * @property {string} [uploadFolder]
 */

/** @type {TaxonomyConfig} */
export const CATEGORY_TAXONOMY_CONFIG = {
  type: 'category',
  title: 'Manage Categories',
  singularLabel: 'Category',
  levels: ['department', 'category', 'subcategory', 'type'],
  apiBase: '/api/categories',
  adminListApi: '/api/admin/categories',
  reorderApi: '/api/admin/taxonomy/reorder',
  responseKey: 'categories',
  permissionRead: 'categories:read',
  permissionWrite: 'categories:write',
  editFields: ['name', 'slug', 'tagline', 'image'],
  supportsImage: true,
  uploadFolder: 'categories',
};

/** @type {TaxonomyConfig} */
export const BRAND_TAXONOMY_CONFIG = {
  type: 'brand',
  title: 'Manage Brands',
  singularLabel: 'Brand',
  levels: ['department', 'category', 'subcategory'],
  apiBase: '/api/brands',
  adminListApi: '/api/admin/brands',
  reorderApi: '/api/admin/taxonomy/reorder',
  responseKey: 'brands',
  permissionRead: 'brands:read',
  permissionWrite: 'brands:write',
  editFields: ['name', 'slug', 'tagline'],
  supportsImage: false,
};

/**
 * @param {TaxonomyType} type
 * @returns {TaxonomyConfig}
 */
export function getTaxonomyConfig(type) {
  if (type === 'brand') return BRAND_TAXONOMY_CONFIG;
  return CATEGORY_TAXONOMY_CONFIG;
}
