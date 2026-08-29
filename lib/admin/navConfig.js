/**
 * Admin sidebar navigation — filtered by role permissions.
 *
 * Inventory links are flat (same level) on purpose: nested children looked like
 * a dropdown but were always expanded, which confused the hierarchy.
 */

import { hasPermission } from '@/lib/shared/permissions';

/** @typedef {{ href: string, label: string, permission?: string, roles?: string[], children?: { href: string, label: string }[] }} NavItem */

/** @type {NavItem[]} */
export const ADMIN_NAV = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  {
    href: '/admin/inventory',
    label: 'Inventory',
    permission: 'inventory:read',
  },
  {
    href: '/admin/inventory/add',
    label: 'Add to inventory',
    permission: 'inventory:write',
  },
  {
    href: '/admin/inventory/movements',
    label: 'Movements',
    permission: 'inventory:read',
  },
  {
    href: '/admin/inventory/locations',
    label: 'Locations',
    permission: 'locations:read',
  },
  {
    href: '/admin/inventory/locator',
    label: 'Locator',
    permission: 'inventory:read',
  },
  {
    href: '/admin/inventory/product-sheet',
    label: 'Product stock sheet',
    permission: 'inventory:read',
  },
  /**
   * Products stay for catalog editors only (products:write).
   * Inventory roles have products:read for lookups but add stock via
   * "Add to inventory" — they do not need a Products nav entry here.
   */
  {
    href: '/admin/products',
    label: 'Products',
    permission: 'products:write',
  },
  { href: '/admin/categories', label: 'Categories', permission: 'categories:read' },
  { href: '/admin/brands', label: 'Brands', permission: 'brands:read' },
  { href: '/admin/business-types', label: 'Business Types', permission: 'business-types:read' },
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
  {
    href: '/admin/inventory/requests',
    label: 'Stock requests',
    permission: 'inventory:requests:approve',
  },
  { href: '/admin/users', label: 'Users', roles: ['super_admin'] },
  { href: '/admin/audit', label: 'Audit log', roles: ['super_admin'] },
  { href: '/admin/company-profile', label: 'Company Profile', roles: ['super_admin'] },
];

/**
 * Prefer the longest matching href so /admin/inventory does not stay active
 * on /admin/inventory/movements (and similar flat inventory routes).
 */
export function isNavItemActive(pathname, href, navHrefs) {
  if (!pathname || !href) return false;
  if (pathname === href) return true;
  if (href === '/admin/dashboard') return false;
  if (!pathname.startsWith(`${href}/`)) return false;

  // Another nav item is a more specific match for this path.
  const hasMoreSpecific = navHrefs.some(
    (other) =>
      other !== href &&
      other.startsWith(`${href}/`) &&
      (pathname === other || pathname.startsWith(`${other}/`))
  );

  return !hasMoreSpecific;
}

export function filterNavForRole(role) {
  return ADMIN_NAV.filter((item) => {
    if (item.roles?.length) {
      return item.roles.includes(role);
    }
    if (item.permission) {
      return hasPermission(role, item.permission);
    }
    return true;
  });
}
