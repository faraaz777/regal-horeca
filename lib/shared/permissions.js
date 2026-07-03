/**
 * Shared role permissions (safe for client + server).
 */

const PRODUCT_WRITE_PERMS = [
  'products:read',
  'products:write',
  'categories:read',
  'categories:write',
  'brands:read',
  'brands:write',
  'business-types:read',
  'business-types:write',
  'enquiries:read',
  'upload:write',
  'ai:write',
];

const SALES_PERMS = [
  'products:read',
  'enquiries:read',
  'enquiries:write',
  'sales:catalog:read',
  'sales:buckets:write',
  'sales:collections:read',
  'sales:collections:write',
  'sales:requests:read',
  'sales:requests:write',
];

const INVENTORY_WRITE_PERMS = [
  'products:read',
  'inventory:read',
  'inventory:write',
  'inventory:requests:approve',
  'locations:read',
  'locations:write',
];

export const ROLE_PERMISSIONS = {
  super_admin: ['*'],
  product_manager: PRODUCT_WRITE_PERMS,
  inventory_supervisor: INVENTORY_WRITE_PERMS,
  // Legacy aliases — same access as the roles above
  data_entry: PRODUCT_WRITE_PERMS,
  inventory_manager: INVENTORY_WRITE_PERMS,
  sales: SALES_PERMS,
  viewer: ['products:read', 'enquiries:read'],
};

export function hasPermission(role, permission) {
  if (!role || !permission) return false;
  const perms = ROLE_PERMISSIONS[role] || [];
  return perms.includes('*') || perms.includes(permission);
}

export function hasAnyPermission(role, permissions = []) {
  return permissions.some((p) => hasPermission(role, p));
}

export function canManageUsers(role) {
  return role === 'super_admin';
}

export function canWriteProducts(role) {
  return hasPermission(role, 'products:write');
}

export function canHardDeleteProducts(role) {
  return role === 'super_admin';
}

export function canWriteInventory(role) {
  return hasPermission(role, 'inventory:write');
}

export function canReadInventory(role) {
  return hasPermission(role, 'inventory:read');
}

export function canApproveInventoryRequests(role) {
  return hasPermission(role, 'inventory:requests:approve');
}

export function canReadSalesCatalog(role) {
  return hasPermission(role, 'sales:catalog:read');
}

/** super_admin may delete any location; inventory_supervisor only when empty. */
export function canDeleteLocation(role, { isEmpty = false } = {}) {
  if (role === 'super_admin') return true;
  if (role === 'inventory_supervisor' || role === 'inventory_manager') {
    return isEmpty;
  }
  return false;
}
