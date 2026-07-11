/**
 * Branch › Floor › Rack display helpers.
 * Legacy section / zone / shelf levels are ignored in UI formatting.
 */

import { LOCATION_PATH_SEP } from '@/lib/shared/inventoryConstants';

function labelFor(loc) {
  if (!loc) return '';
  return (loc.name && loc.name.trim()) || loc.code || '';
}

function codeLabelFor(loc) {
  if (!loc) return '';
  return (loc.code && loc.code.trim()) || (loc.name && loc.name.trim()) || '';
}

function nameLabelFor(loc) {
  if (!loc) return '';
  return (loc.name && loc.name.trim()) || (loc.code && loc.code.trim()) || '';
}

function walkAncestors(locationId, byId) {
  const chain = [];
  let current = byId.get(String(locationId));
  const seen = new Set();

  while (current && !seen.has(String(current._id))) {
    seen.add(String(current._id));
    chain.unshift(current);
    if (!current.parentLocationId) break;
    current = byId.get(String(current.parentLocationId));
  }

  return chain;
}

/**
 * @param {string} locationId
 * @param {Map<string, object>} byId
 */
export function formatBranchFloorRackPath(locationId, byId) {
  if (!locationId || !byId?.size) return '—';

  const chain = walkAncestors(locationId, byId);
  const branch = chain.find((l) => l.level === 'branch');
  const floor = chain.find((l) => l.level === 'floor');
  const rack = chain.find((l) => l.level === 'rack');

  const parts = [branch, floor, rack].map(labelFor).filter(Boolean);
  if (parts.length) return parts.join(LOCATION_PATH_SEP);

  return '—';
}

/**
 * Branch and floor as codes; rack (last level) as display name.
 * @param {string} locationId
 * @param {Map<string, object>} byId
 */
export function formatBranchFloorRackPathCodesWithRackName(locationId, byId) {
  if (!locationId || !byId?.size) return '—';

  const chain = walkAncestors(locationId, byId);
  const branch = chain.find((l) => l.level === 'branch');
  const floor = chain.find((l) => l.level === 'floor');
  const rack = chain.find((l) => l.level === 'rack');

  const parts = [];
  if (branch) parts.push(codeLabelFor(branch));
  if (floor) parts.push(codeLabelFor(floor));
  if (rack) parts.push(nameLabelFor(rack));

  if (parts.length) return parts.join(LOCATION_PATH_SEP);

  return '—';
}

/**
 * Rack label for dropdowns and rack-only fields (name, then code).
 * Falls back to the last segment of displayPath when only a breadcrumb string is available.
 * @param {{ name?: string; code?: string; displayPath?: string } | null | undefined} loc
 */
export function formatRackDisplayName(loc) {
  if (!loc) return '';

  const name = loc.name?.trim();
  if (name) return name;

  const code = loc.code?.trim();
  if (code) return code;

  const path = loc.displayPath?.trim();
  if (path) {
    if (path.includes(LOCATION_PATH_SEP)) {
      const parts = path.split(LOCATION_PATH_SEP).map((p) => p.trim()).filter(Boolean);
      return parts[parts.length - 1] || path;
    }
    return path;
  }

  return 'Rack';
}

/**
 * @param {string} locationId
 * @param {Map<string, object>} byId
 */
export function resolveLocationToCascade(locationId, byId) {
  const empty = {
    branchId: null,
    floorId: null,
    rackId: null,
    locationId: null,
    displayPath: '',
  };

  if (!locationId || !byId?.size) return empty;

  const loc = byId.get(String(locationId));
  if (!loc) return empty;

  const chain = walkAncestors(locationId, byId);
  const branch = chain.find((l) => l.level === 'branch');
  const floor = chain.find((l) => l.level === 'floor');
  const rack =
    loc.level === 'rack'
      ? loc
      : chain.find((l) => l.level === 'rack');

  return {
    branchId: branch ? String(branch._id) : null,
    floorId: floor ? String(floor._id) : null,
    rackId: rack ? String(rack._id) : loc.level === 'rack' ? String(loc._id) : null,
    locationId: String(locationId),
    displayPath: formatBranchFloorRackPath(locationId, byId),
  };
}
