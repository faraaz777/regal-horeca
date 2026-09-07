/**
 * Admin sidebar navigation — filtered by role permissions.
 *
 * Super Admin sees every module. Items are grouped into sections so the
 * sidebar can be scanned by function (stock, catalog, sales, admin)
 * instead of one undifferentiated list.
 *
 * Inventory routes stay siblings under the Inventory heading — not children
 * of the Inventory page. Nesting them used to look like a dropdown that
 * never collapsed.
 */

import { hasPermission } from '@/lib/shared/permissions';

/** @typedef {{ href: string, label: string, permission?: string, roles?: string[], children?: { href: string, label: string }[] }} NavItem */
/** @typedef {{ id: string, label: string|null, items: NavItem[] }} NavSection */

/** @type {NavSection[]} */
export const ADMIN_NAV_SECTIONS = [
  {
    id: 'overview',
    label: null,
    items: [{ href: '/admin/dashboard', label: 'Dashboard' }],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    items: [
      { href: '/admin/inventory', label: 'Inventory', permission: 'inventory:read' },
      { href: '/admin/inventory/add', label: 'Add to inventory', permission: 'inventory:write' },
      { href: '/admin/inventory/movements', label: 'Movements', permission: 'inventory:read' },
      { href: '/admin/inventory/locations', label: 'Locations', permission: 'locations:read' },
      { href: '/admin/inventory/locator', label: 'Locator', permission: 'inventory:read' },
      {
        href: '/admin/inventory/product-sheet',
        label: 'Product stock sheet',
        permission: 'inventory:read',
      },
      {
        href: '/admin/inventory/requests',
        label: 'Stock requests',
        permission: 'inventory:requests:approve',
      },
    ],
  },
  {
    id: 'catalog',
    label: 'Catalog',
    items: [
      /**
       * Products stay for catalog editors only (products:write).
       * Inventory roles have products:read for lookups but add stock via
       * "Add to inventory" — they do not need a Products nav entry here.
       */
      { href: '/admin/products', label: 'Products', permission: 'products:write' },
      { href: '/admin/categories', label: 'Categories', permission: 'categories:read' },
      { href: '/admin/brands', label: 'Brands', permission: 'brands:read' },
      { href: '/admin/business-types', label: 'Business Types', permission: 'business-types:read' },
    ],
  },
  {
    id: 'sales',
    label: 'Sales',
    items: [
      { href: '/admin/enquiries', label: 'Enquiries', permission: 'enquiries:read' },
      {
        href: '/admin/sales',
        label: 'Sales floor',
        permission: 'sales:buckets:write',
        children: [
          { href: '/admin/sales/collections', label: 'My sales collections' },
          { href: '/admin/sales/requests', label: 'My requests' },
          { href: '/admin/sales/my-sales', label: 'My sales' },
        ],
      },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    items: [
      { href: '/admin/users', label: 'Users', roles: ['super_admin'] },
      { href: '/admin/audit', label: 'Audit log', roles: ['super_admin'] },
      { href: '/admin/company-profile', label: 'Company Profile', roles: ['super_admin'] },
    ],
  },
];

/** Flat list — same items, used by helpers that do not need section chrome. */
export const ADMIN_NAV = ADMIN_NAV_SECTIONS.flatMap((section) => section.items);

function isNavItemVisible(item, role) {
  if (item.roles?.length) return item.roles.includes(role);
  if (item.permission) return hasPermission(role, item.permission);
  return true;
}

/**
 * Prefer the longest matching href so /admin/inventory does not stay active
 * on /admin/inventory/movements (and similar flat inventory routes).
 */
export function isNavItemActive(pathname, href, navHrefs) {
  if (!pathname || !href) return false;
  if (pathname === href) return true;
  if (href === '/admin/dashboard') return false;
  if (!pathname.startsWith(`${href}/`)) return false;

  const hasMoreSpecific = navHrefs.some(
    (other) =>
      other !== href &&
      other.startsWith(`${href}/`) &&
      (pathname === other || pathname.startsWith(`${other}/`))
  );

  return !hasMoreSpecific;
}

export function filterNavForRole(role) {
  return ADMIN_NAV.filter((item) => isNavItemVisible(item, role));
}

/**
 * Same permission filter, but keeps section groupings.
 * Empty sections (no visible items for this role) are dropped.
 */
export function filterNavSectionsForRole(role) {
  return ADMIN_NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => isNavItemVisible(item, role)),
  })).filter((section) => section.items.length > 0);
}

export function collectNavHrefs(sections) {
  return sections.flatMap((section) =>
    section.items.flatMap((item) => [
      item.href,
      ...(item.children || []).map((child) => child.href),
    ])
  );
}

export function findActiveNavSectionId(pathname, sections, navHrefs) {
  for (const section of sections) {
    for (const item of section.items) {
      if (isNavItemActive(pathname, item.href, navHrefs)) return section.id;
      for (const child of item.children || []) {
        if (isNavItemActive(pathname, child.href, navHrefs)) return section.id;
      }
    }
  }
  return null;
}
