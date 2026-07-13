import 'server-only';

import { listAllLocations } from '@/lib/server/inventory/locationCrudService';
import {
  formatBranchFloorRackPath,
  resolveLocationToCascade,
} from '@/lib/shared/locationDisplay';
import { MAX_PRODUCTS_PER_RACK } from '@/lib/shared/inventoryConstants';
import { getRackProductSummariesByRackIds } from '@/lib/server/inventory/rackLimitsService';

const ACTIVE_RACK_LEVEL = 'rack';

function buildChildrenMap(locations) {
  const byParent = new Map();
  for (const loc of locations) {
    const pid = loc.parentLocationId ? String(loc.parentLocationId) : 'root';
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid).push(loc);
  }
  return byParent;
}

function collectDescendantIds(nodeId, byParent) {
  const ids = [String(nodeId)];
  for (const child of byParent.get(String(nodeId)) || []) {
    ids.push(...collectDescendantIds(child._id, byParent));
  }
  return ids;
}

async function getLocationIndex() {
  const locations = await listAllLocations();
  const byId = new Map(locations.map((l) => [String(l._id), l]));
  const byParent = buildChildrenMap(locations);
  return { locations, byId, byParent };
}

function toBranchDto(loc) {
  return {
    _id: String(loc._id),
    code: loc.code,
    name: loc.name || '',
    level: 'branch',
    path: loc.path,
  };
}

function toFloorDto(loc) {
  return {
    _id: String(loc._id),
    code: loc.code,
    name: loc.name || '',
    level: 'floor',
    parentLocationId: String(loc.parentLocationId),
    path: loc.path,
  };
}

function toRackDto(loc, byId, summary = { count: 0, productIds: [] }) {
  const productCount = summary.count || 0;
  return {
    _id: String(loc._id),
    code: loc.code,
    name: loc.name || '',
    level: 'rack',
    parentLocationId: String(loc.parentLocationId),
    path: loc.path,
    displayPath: formatBranchFloorRackPath(String(loc._id), byId),
    capacity: loc.capacity ?? MAX_PRODUCTS_PER_RACK,
    productCount,
    productIds: summary.productIds || [],
    isFull: productCount >= MAX_PRODUCTS_PER_RACK,
  };
}

export async function listCascadeBranches() {
  const { locations } = await getLocationIndex();
  return locations.filter((l) => l.level === 'branch').map(toBranchDto);
}

export async function listCascadeFloors(branchId) {
  if (!branchId) return [];
  const { locations, byId } = await getLocationIndex();
  const branch = byId.get(String(branchId));
  if (!branch || branch.level !== 'branch') {
    throw new Error('Invalid branch');
  }
  return locations
    .filter(
      (l) => l.level === 'floor' && String(l.parentLocationId) === String(branchId)
    )
    .map(toFloorDto);
}

/**
 * Rack nodes only — direct descendants of floor (via section/zone) under the selected floor.
 */
export async function listCascadeRacks(floorId, { allowedLocationIds } = {}) {
  if (!floorId) return [];
  const { locations, byId, byParent } = await getLocationIndex();
  const floor = byId.get(String(floorId));
  if (!floor || floor.level !== 'floor') {
    throw new Error('Invalid floor');
  }

  const descendantIds = new Set(collectDescendantIds(floorId, byParent));
  const allowed = allowedLocationIds?.length
    ? new Set(allowedLocationIds.map(String))
    : null;

  const rackLocs = locations.filter((l) => {
    if (!descendantIds.has(String(l._id))) return false;
    if (l.level !== ACTIVE_RACK_LEVEL) return false;
    if (allowed && !allowed.has(String(l._id))) return false;
    return true;
  });

  const summaries = await getRackProductSummariesByRackIds(rackLocs.map((l) => l._id));

  return rackLocs.map((l) =>
    toRackDto(l, byId, summaries.get(String(l._id)) || { count: 0, productIds: [] })
  );
}

export async function resolveCascadeSelection(locationId) {
  const { byId } = await getLocationIndex();
  return resolveLocationToCascade(locationId, byId);
}

/**
 * Validate location for new stock transactions (rack-level only).
 */
export async function validateNewStockLocation(locationId) {
  if (!locationId) {
    throw new Error('Select branch, floor, and rack');
  }

  const { byId } = await getLocationIndex();
  const loc = byId.get(String(locationId));
  if (!loc || !loc.isActive) {
    throw new Error('Selected rack not found or inactive');
  }

  if (loc.level !== ACTIVE_RACK_LEVEL) {
    throw new Error('New stock must be placed at a rack. Legacy shelf/zone locations are read-only.');
  }

  const selection = resolveLocationToCascade(locationId, byId);
  if (!selection.branchId || !selection.floorId || !selection.rackId) {
    throw new Error('Rack must belong to a complete Branch › Floor › Rack hierarchy');
  }

  return selection;
}

/**
 * Validate minus from existing stock (allows legacy shelf leaf ids when consuming old stock).
 */
export async function validateMinusStockLocation(locationId) {
  if (!locationId) {
    throw new Error('Select branch, floor, and rack to remove stock');
  }

  const { byId } = await getLocationIndex();
  const loc = byId.get(String(locationId));
  if (!loc || !loc.isActive) {
    throw new Error('Selected location not found or inactive');
  }

  const selection = resolveLocationToCascade(locationId, byId);
  if (!selection.branchId || !selection.floorId) {
    throw new Error('Location must belong to a branch and floor');
  }

  if (loc.level === 'shelf') {
    return { ...selection, legacyShelf: true };
  }

  if (loc.level !== ACTIVE_RACK_LEVEL) {
    throw new Error('Stock can only be removed from a rack (or legacy shelf record)');
  }

  return selection;
}

export async function buildLocationIndexMaps() {
  const { byId } = await getLocationIndex();
  return byId;
}
