import 'server-only';

/** Re-export sales-floor catalog search for admin/inventory product lookup. */
export { buildSalesCatalogSearchFilter as buildProductSearchFilter } from '@/lib/server/sales/catalogSearch';
