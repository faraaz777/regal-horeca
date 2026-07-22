import 'server-only';

import StockLedger from '@/lib/models/StockLedger';
import Stock from '@/lib/models/Stock';
import InventoryRule from '@/lib/models/InventoryRule';
import { buildSalesCatalogSearchFilter } from '@/lib/server/sales/catalogSearch';

/**
 * Inventory list/search base — same sellable rows as the sales floor (non-parent),
 * without sales-only gates (inactive status, stock filters, storefront visibility).
 */
export function inventoryProductBaseFilter() {
  return {
    deletedAt: null,
    productType: { $ne: 'parent' },
  };
}

/**
 * MongoDB match for inventory product search — mirrors sales-floor catalog query
 * composition so brand/name/SKU lookups return the same product set.
 */
export async function buildInventoryProductQuery({ search = '', categoryId = '', brand = '' } = {}) {
  const and = [inventoryProductBaseFilter()];

  const term = String(search || '').trim();
  if (term) {
    const searchFilter = await buildSalesCatalogSearchFilter(term);
    if (searchFilter) and.push(searchFilter);
  }

  const cat = String(categoryId || '').trim();
  if (cat) {
    and.push({
      $or: [{ categoryId: cat }, { categoryIds: cat }],
    });
  }

  const brandVal = String(brand || '').trim();
  if (brandVal) {
    and.push({ brand: brandVal });
  }

  if (and.length === 1) return and[0];
  return { $and: and };
}

/**
 * Product ids that entered inventory (opening stock / ledger) or have stock / rules.
 * Source of truth for qty is ledger Stock projection.
 */
export async function getInventoryTrackedProductIds() {
  const [ledgerIds, stockIds, ruleIds] = await Promise.all([
    StockLedger.distinct('productId'),
    Stock.distinct('productId'),
    InventoryRule.distinct('productId'),
  ]);

  const seen = new Set();
  for (const id of [...ledgerIds, ...stockIds, ...ruleIds]) {
    if (id) seen.add(String(id));
  }
  return [...seen];
}

/**
 * Live ledger list — only products added via inventory intake or with location stock.
 */
export async function buildInventoryLedgerProductQuery({ search = '', categoryId = '', brand = '' } = {}) {
  const trackedIds = await getInventoryTrackedProductIds();
  if (trackedIds.length === 0) {
    return { _id: { $in: [] } };
  }

  const baseMatch = await buildInventoryProductQuery({ search, categoryId, brand });
  return {
    $and: [baseMatch, { _id: { $in: trackedIds } }],
  };
}
