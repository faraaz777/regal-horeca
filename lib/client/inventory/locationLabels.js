import { LOCATION_PATH_SEP } from '@/lib/shared/inventoryConstants';

/** Rack-first label for fast chip taps — e.g. "b1 › f2 › R12" → "R12". */
export function shortLocationLabel(row) {
  const path = String(row?.locationPath || '').trim();
  if (!path || path === '—') return 'Unassigned';
  const parts = path.split(LOCATION_PATH_SEP).map((p) => p.trim()).filter(Boolean);
  return parts[parts.length - 1] || path;
}

/** Code primary + name secondary — matches locations RackTile. */
export function locationRackCode(loc) {
  return String(loc?.locationCode || loc?.code || '').trim();
}

export function locationRackName(loc) {
  const code = locationRackCode(loc);
  const name = String(loc?.locationName || loc?.name || '').trim();
  return name || code || 'Rack';
}

export function locationCodePath(loc) {
  return String(loc?.locationCodePath || '').trim() || '—';
}
