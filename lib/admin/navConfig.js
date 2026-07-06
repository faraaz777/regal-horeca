/**
 * Admin sidebar navigation — filtered by role permissions.
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
    children: [
      { href: '/admin/inventory/add', label: '+ Add to inventory' },
      { href: '/admin/inventory/movements', label: 'Movements' },
      { href: '/admin/inventory/locations', label: 'Locations' },
    ],
  },
  {
    href: '/admin/products',
    label: 'Products',
    permission: 'products:read',
    children: [{ href: '/admin/products/add', label: '+ Add Product' }],
  },
  { href: '/admin/categories', label: 'Categories', permission: 'categories:read' },
  { href: '/admin/brands', label: 'Brands', permission: 'brands:read' },
  { href: '/admin/business-types', label: 'Business Types', permission: 'business-types:read' },
  { href: '/admin/enquiries', label: 'Enquiries', permission: 'enquiries:read' },
  {
    href: '/admin/sales',
    label: 'Sales floor',
    permission: 'sales:buckets:write',
    children: [{ href: '/admin/sales/requests', label: 'My requests' }],
  },
  {
    href: '/admin/inventory/requests',
    label: 'Stock requests',
    permission: 'inventory:requests:approve',
  },
  { href: '/admin/users', label: 'Users', roles: ['super_admin'] },
  { href: '/admin/audit', label: 'Audit log', roles: ['super_admin'] },
];

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
