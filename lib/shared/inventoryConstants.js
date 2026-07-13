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

export const STATUS_BUCKETS = ['sellable', 'display', 'scrap', 'hold', 'non_sellable', 'dead_stock'];

/** Status buckets selectable in the stock movement modal. */
export const MOVEMENT_STATUS_BUCKETS = ['sellable', 'display', 'scrap', 'hold'];

export const STATUS_BUCKET_LABELS = {
  sellable: 'Sellable',
  display: 'Display',
  scrap: 'Scrap',
  hold: 'Hold',
  non_sellable: 'Nonsellable',
  dead_stock: 'Dead stock',
};

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

/** Active model for stock transactions and new location setup. */
export const ACTIVE_LOCATION_LEVELS = ['branch', 'floor', 'rack'];

/**
 * Standard warehouse layout: each floor gets exactly this many rack nodes.
 * New floors auto-seed racks R1–R5; manual rack creation is capped at this count.
 */
export const RACKS_PER_FLOOR = 5;

/**
 * Max distinct products (SKUs) per rack. Also used as default rack unit capacity
 * for locator fill % and opening-stock validation.
 */
export const MAX_PRODUCTS_PER_RACK = 5;

/** Legacy DB levels — read-only; not used for new stock or forms. */
export const LEGACY_LOCATION_LEVELS = ['section', 'zone', 'shelf'];

/** Parent level required when creating an active location node. */
export const ACTIVE_LOCATION_PARENT = {
  floor: 'branch',
  rack: 'floor',
};

/** Child level when adding under an active parent in the location admin UI. */
export const ACTIVE_LOCATION_CHILD = {
  branch: 'floor',
  floor: 'rack',
};

export const LEDGER_TYPES = [
  'opening',
  'adjustment_add',
  'adjustment_minus',
  'transfer_out',
  'transfer_in',
  'condition_change',
  'reservation_hold',
  'sale_fulfill',
];

/** Display path separator for flattened location select. */
export const LOCATION_PATH_SEP = ' › ';

/** Dead-stock velocity rule: units expected to sell within the selected period. */
export const DEAD_STOCK_PERIODS = ['day', 'week', 'month', '3month', '6month'];

export const DEAD_STOCK_PERIOD_LABELS = {
  day: 'A day',
  week: 'Week',
  month: 'Month',
  '3month': '3 months',
  '6month': '6 months',
};

export const MOVEMENT_REASONS = [
  'sales_return',
  'manual_adjustment',
  'damaged',
  'display',
  'scrap',
  'branch_transfer_in',
  'sold',
  'branch_transfer_out',
  'custom_add',
  'custom_minus',
];

/** Reasons available when posting an Add movement from the stock modal. */
export const ADD_MOVEMENT_REASONS = [
  'opening_stock',
  'sales_return',
  'manual_adjustment',
];

export const MOVEMENT_REASON_LABELS = {
  sales_return: 'Sales return',
  manual_adjustment: 'Manual adjustment',
  damaged: 'Damaged',
  display: 'Display',
  scrap: 'Scrap',
  branch_transfer_in: 'Branch transfer in',
  sold: 'Sold',
  branch_transfer_out: 'Branch transfer out',
  custom_add: 'Custom add',
  custom_minus: 'Custom minus',
};

export const ADD_MOVEMENT_REASON_LABELS = {
  opening_stock: 'Opening stock',
  sales_return: 'Sales return',
  manual_adjustment: 'Manual adjustment',
};

export const STOCK_MOVEMENT_TABS = ['add', 'minus', 'status_change', 'transfer'];

/** UI filter pills for the stock movement ledger page. */
export const LEDGER_FILTER_TYPES = ['opening', 'add', 'minus', 'transfer', 'status'];

export const LEDGER_FILTER_TYPE_LABELS = {
  opening: 'Opening',
  add: 'Add',
  minus: 'Minus',
  transfer: 'Transfer',
  status: 'Status',
};

/** Maps UI filter types to underlying append-only ledger entry types. */
export const LEDGER_TYPE_FILTER_MAP = {
  opening: ['opening'],
  add: ['adjustment_add'],
  minus: ['adjustment_minus', 'reservation_hold', 'sale_fulfill'],
  transfer: ['transfer_out', 'transfer_in'],
  status: ['condition_change'],
};

export const LEDGER_TYPE_LABELS = {
  opening: 'Opening',
  adjustment_add: 'Add',
  adjustment_minus: 'Minus',
  transfer_out: 'Transfer out',
  transfer_in: 'Transfer in',
  condition_change: 'Status',
  reservation_hold: 'Hold',
  sale_fulfill: 'Sale',
};

/** Combined reason labels for ledger display (opening + movement reasons). */
export const ALL_REASON_LABELS = {
  ...OPENING_REASON_LABELS,
  ...MOVEMENT_REASON_LABELS,
  transfer: 'Transfer',
};
