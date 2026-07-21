/**
 * Personal branch list order for Locations admin (this browser only).
 * Does not change shared Location data — safe fallback to code sort.
 */

const STORAGE_KEY = 'regal.inventory.branchOrder';

export function loadBranchOrder() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function saveBranchOrder(ids) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.map(String)));
  } catch {
    // Quota / private mode — ignore; UI order still works for the session
  }
}

/**
 * Apply saved IDs first; any new branches append by code.
 */
export function applyBranchOrder(branches, orderIds) {
  if (!branches?.length) return [];
  const byId = new Map(branches.map((b) => [String(b._id), b]));
  const ordered = [];
  const seen = new Set();

  for (const id of orderIds || []) {
    const key = String(id);
    if (!byId.has(key) || seen.has(key)) continue;
    ordered.push(byId.get(key));
    seen.add(key);
  }

  const rest = branches
    .filter((b) => !seen.has(String(b._id)))
    .sort((a, b) => (a.code || '').localeCompare(b.code || ''));

  return [...ordered, ...rest];
}

export function moveBranchId(orderIds, activeId, overId) {
  const ids = orderIds.map(String);
  const from = ids.indexOf(String(activeId));
  const to = ids.indexOf(String(overId));
  if (from < 0 || to < 0 || from === to) return ids;
  const next = [...ids];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
