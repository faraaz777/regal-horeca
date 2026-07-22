/**
 * Stable SWR key so prefetch (LocationCascadePicker) and floor grids share one cache entry.
 */
export function cascadeRacksSwrKey(prefix, floorId) {
  if (!floorId) return null;
  return [`cascade-racks-${prefix || 'default'}`, String(floorId)];
}
