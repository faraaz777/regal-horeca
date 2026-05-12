/**
 * Storefront catalog listing rules for product rows.
 *
 * - Parent carriers (`productType: 'parent'`) are never listed as cards; the default
 *   child slug is used instead.
 * - Child variants appear as their own catalog cards only when `showInCatalog` is
 *   explicitly true.
 * - Legacy child rows created before `showInCatalog` existed still use
 *   `visibleOnClient` as the listing gate so existing deployments do not suddenly
 *   hide every variant until data is backfilled.
 */

/** Mongo fragment: child document qualifies for its own storefront catalog row. */
export function mongoChildOwnCatalogRowMatch() {
  return {
    $or: [
      { showInCatalog: true },
      {
        showInCatalog: { $exists: false },
        visibleOnClient: true,
      },
    ],
  };
}

/**
 * Mongo fragment for $and[]: standalones + catalog-visible children only.
 * (Caller must still exclude `productType: 'parent'` separately.)
 */
export function mongoStorefrontCatalogListingTypes() {
  return {
    $or: [
      { productType: { $ne: 'child' } },
      { productType: 'child', ...mongoChildOwnCatalogRowMatch() },
    ],
  };
}

/** Plain JS (admin UI) — same semantics as {@link mongoChildOwnCatalogRowMatch}. */
export function childRowListedInStorefrontCatalog(child) {
  if (!child || child.productType !== 'child') return false;
  if (child.showInCatalog === true) return true;
  if (child.showInCatalog == null && child.visibleOnClient !== false) return true;
  return false;
}
