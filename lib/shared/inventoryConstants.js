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

/**
 * Ledger status buckets (physical qty + sold history).
 * - sellable: physical qty at a location ("we have N pieces")
 * - sold: sold history (does not contribute to available stock)
 *
 * Dead stock is NOT a qty bucket — it is InventoryRule.deadStockMarked (product tag).
 */
export const STATUS_BUCKETS = ['sellable', 'sold'];

/**
 * @deprecated Intake always writes sellable. Kept for older schema defaults.
 */
export const INTAKE_STATUS_BUCKETS = ['sellable'];

/** @deprecated Use INTAKE_STATUS_BUCKETS — kept for older imports. */
export const MOVEMENT_STATUS_BUCKETS = INTAKE_STATUS_BUCKETS;

export const STATUS_BUCKET_LABELS = {
  sellable: 'Sellable',
  sold: 'Sold',
};

/** Product availability derived from on-hand (sellable) qty. */
export const STOCK_AVAILABILITY = {
  IN_STOCK: 'in_stock',
  LOW_STOCK: 'low',
  OUT_OF_STOCK: 'out',
};

export const STOCK_AVAILABILITY_LABELS = {
  in_stock: 'In stock',
  low: 'Low stock',
  out: 'Out of stock',
};

/**
 * Inventory condition = product-wide dead-stock TAG (not a qty split).
 * HAS_DEAD_STOCK when InventoryRule.deadStockMarked is true.
 */
export const INVENTORY_CONDITIONS = ['NORMAL', 'HAS_DEAD_STOCK'];

export const INVENTORY_CONDITION_LABELS = {
  NORMAL: 'Normal',
  HAS_DEAD_STOCK: 'Dead stock',
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
  'sale_fulfill',
  // Legacy types retained so historical rows remain readable after migration.
  'condition_change',
  'reservation_hold',
];

/** Display path separator for flattened location select. */
export const LOCATION_PATH_SEP = ' › ';

/**
 * Soft cap for stock rows returned by location items / search primary list.
 * Prevents huge payloads; meta.truncated is set when more rows exist.
 */
export const LOCATION_ITEMS_MAX = 500;

/** Hard cap on raw stock rows scanned during location product search. */
export const LOCATION_SEARCH_STOCK_SCAN_MAX = 2000;

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
  'branch_transfer_in',
  'sold',
  'branch_transfer_out',
  'custom_add',
  'custom_minus',
];

/** Max location lines allowed in one batch add/minus post. */
export const MAX_MOVEMENT_LINES = 50;
/** Max remark length on stock movements. */
export const MAX_MOVEMENT_REMARK_LENGTH = 500;
/** Max ref length on stock movements. */
export const MAX_MOVEMENT_REF_LENGTH = 100;

/**
 * Reasons available when posting an Add movement from the stock modal.
 * Opening stock is create-product only — later intake uses purchase.
 */
export const ADD_MOVEMENT_REASONS = [
  'purchase',
  'sales_return',
  'manual_adjustment',
];

/** Reasons available when posting a Minus / sale movement. */
export const MINUS_MOVEMENT_REASONS = [
  'sold',
  'manual_adjustment',
  'branch_transfer_out',
  'custom_minus',
];

export const MOVEMENT_REASON_LABELS = {
  sales_return: 'Sales return',
  manual_adjustment: 'Manual adjustment',
  branch_transfer_in: 'Branch transfer in',
  sold: 'Sold',
  branch_transfer_out: 'Branch transfer out',
  custom_add: 'Custom add',
  custom_minus: 'Custom minus',
};

/** Labels for minus reason chips in the stock movement modal. */
export const MINUS_REASON_CHIP_LABELS = {
  sold: 'Sold',
  manual_adjustment: 'Manual adjustment',
  branch_transfer_out: 'Showroom',
  custom_minus: 'Other',
};

export const ADD_MOVEMENT_REASON_LABELS = {
  purchase: 'Purchase',
  sales_return: 'Sales return',
  manual_adjustment: 'Manual adjustment',
};

/** Labels for add reason chips in the stock movement modal. */
export const ADD_REASON_CHIP_LABELS = {
  purchase: 'Purchase',
  sales_return: 'Sales return',
  manual_adjustment: 'Manual adjustment',
};

/** UI filter pills for the stock movement ledger page. */
export const LEDGER_FILTER_TYPES = ['opening', 'add', 'minus', 'transfer', 'sold'];

export const LEDGER_FILTER_TYPE_LABELS = {
  opening: 'Opening',
  add: 'Add',
  minus: 'Minus',
  transfer: 'Transfer',
  sold: 'Sold',
};

/** Maps UI filter types to underlying append-only ledger entry types. */
export const LEDGER_TYPE_FILTER_MAP = {
  opening: ['opening'],
  add: ['adjustment_add'],
  minus: ['adjustment_minus'],
  transfer: ['transfer_out', 'transfer_in'],
  sold: ['sale_fulfill'],
};

export const LEDGER_TYPE_LABELS = {
  opening: 'Opening',
  adjustment_add: 'Add',
  adjustment_minus: 'Minus',
  transfer_out: 'Transfer out',
  transfer_in: 'Transfer in',
  sale_fulfill: 'Sold',
  // Legacy historical types
  condition_change: 'Status (legacy)',
  reservation_hold: 'Hold (legacy)',
};

/** Combined reason labels for ledger display (opening + movement reasons). */
export const ALL_REASON_LABELS = {
  ...OPENING_REASON_LABELS,
  ...MOVEMENT_REASON_LABELS,
  transfer: 'Transfer',
};

/** Historical buckets that once mapped into a dead_stock qty pile (retired). */
export const LEGACY_STATUS_BUCKETS_TO_DEAD_STOCK = [
  'display',
  'scrap',
  'hold',
  'non_sellable',
  'damage',
  'sample',
  'return_vendor',
  'dead_stock',
];
