/** Stock packaging units for inventory product master. */
export const STOCK_UNITS = [
  'Pcs',
  'Box',
  'Set',
  'Carton',
  'Kg',
  'Litre',
  'Dozen',
  'Roll',
];

export const PRODUCT_STATUSES = ['active', 'inactive'];

export const STATUS_BUCKETS = ['sellable', 'hold', 'non_sellable'];

export const OPENING_REASONS = [
  'opening_stock',
  'purchase',
  'branch_transfer_in',
];

export const OPENING_REASON_LABELS = {
  opening_stock: 'Opening stock',
  purchase: 'Purchase',
  branch_transfer_in: 'Branch transfer in',
};

export const LOCATION_LEVELS = [
  'branch',
  'floor',
  'section',
  'zone',
  'rack',
  'shelf',
];

export const LEDGER_TYPES = [
  'opening',
  'adjustment_add',
  'adjustment_minus',
  'transfer_out',
  'transfer_in',
  'condition_change',
];

/** Display path separator for flattened location select. */
export const LOCATION_PATH_SEP = ' › ';
