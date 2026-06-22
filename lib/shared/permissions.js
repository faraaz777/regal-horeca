/**
 * Shared role permissions (safe for client + server).
 */

export const ROLE_PERMISSIONS = {
  super_admin: ['*'],
  data_entry: [
    'products:read',
    'products:write',
    'categories:read',
    'categories:write',
    'brands:read',
    'brands:write',
    'business-types:read',
    'business-types:write',
    'enquiries:read',
    'enquiries:write',
    'upload:write',
    'ai:write',
  ],
  sales: ['products:read', 'enquiries:read', 'enquiries:write'],
  inventory_manager: ['products:read', 'inventory:read', 'inventory:write'],
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
