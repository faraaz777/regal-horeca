/**
 * Floor rack list filter — matches editable code/name and Mongo id.
 * Client-only; racks are already loaded for the selected floor.
 */
export function rackMatchesQuery(rack, query) {
  const q = String(query || '')
    .trim()
    .toLowerCase();
  if (!q) return true;

  const id = String(rack?._id || '').toLowerCase();
  const code = String(rack?.code || '').toLowerCase();
  const name = String(rack?.name || '').toLowerCase();

  return code.includes(q) || name.includes(q) || id.includes(q);
}
