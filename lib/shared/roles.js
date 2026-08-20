/**
 * Canonical staff roles. product_manager and inventory_supervisor were
 * duplicate names added later — they are migrated to data_entry and
 * inventory_manager on connect and must not be assigned again.
 */
export const USER_ROLES = [
  'super_admin',
  'data_entry',
  'sales',
  'inventory_manager',
  'viewer',
];

export const ROLE_LABELS = {
  super_admin: 'Super Admin',
  data_entry: 'Data Entry',
  sales: 'Sales',
  inventory_manager: 'Inventory Manager',
  viewer: 'Viewer',
  product_manager: 'Product Manager',
  inventory_supervisor: 'Inventory Supervisor',
};

export const LEGACY_ROLE_MAP = {
  product_manager: 'data_entry',
  inventory_supervisor: 'inventory_manager',
};

/** Roles that can own a sales collection or draft quote. */
export const SALES_WORK_ROLES = ['sales', 'super_admin'];

/** Roles that appear in the enquiry assignee picker. */
export const ENQUIRY_ASSIGNEE_ROLES = ['super_admin', 'data_entry', 'sales'];

/**
 * Roles a sale can be credited to on a Sold movement.
 *
 * Only staff who can genuinely be involved in a sale. Data entry never
 * handles goods, and viewers exist to read reports — crediting a sale to
 * either produces a name nobody can act on.
 */
export const SOLD_FOR_ROLES = ['super_admin', 'sales', 'inventory_manager'];
