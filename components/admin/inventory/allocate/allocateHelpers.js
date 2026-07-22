/** Remember last allocate branch/floor so the next session opens on the same warehouse. */
export const LAST_BRANCH_KEY = 'regal.inventory.allocate.lastBranchId';
export const LAST_FLOOR_KEY = 'regal.inventory.allocate.lastFloorId';

export function readStoredId(key) {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

export function writeStoredId(key, id) {
  if (!id) return;
  try {
    localStorage.setItem(key, String(id));
  } catch {
    /* ignore quota / private mode */
  }
}

export function parsePositiveInt(value) {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? 0 : n;
}

export function clampRackQty(rawValue, rowQty, remaining, openingQty) {
  const parsed = parsePositiveInt(rawValue);
  if (parsed < 0) return 0;
  const maxForRow = remaining + (Number(rowQty) || 0);
  return Math.min(parsed, maxForRow, openingQty);
}

export function buildLocationCodePath(branchCode, floor, rack) {
  const parts = [
    branchCode,
    floor?.code || floor?.name,
    rack?.code || rack?.name,
  ]
    .map((p) => String(p || '').trim())
    .filter(Boolean);
  return parts.join(' › ');
}
