import 'server-only';

import { listAllLocations } from '@/lib/server/inventory/locationCrudService';
import { resolveLocationToCascade } from '@/lib/shared/locationDisplay';
import {
  peekLocationIndexCache,
  setLocationIndexCache,
  getLocationIndexGeneration,
} from '@/lib/server/inventory/locationIndexCache';
import {
  listRacksUnderFloor,
  normalizeRackParentsToFloor,
} from '@/lib/server/inventory/floorRacks';

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

/**
 * Shared location index for cascade APIs.
 * Reads Stock snapshots separately — never replays StockLedger for qty.
 *
 * Single-flight: parallel floor prefetch must not run listAllLocations() N times
 * and race cold vs warm responses (that made rack cards flicker).
 */
let locationIndexInflight = null;

async function getLocationIndex() {
  const cached = peekLocationIndexCache();
  if (cached) return cached;

  if (locationIndexInflight) return locationIndexInflight;

  const generation = getLocationIndexGeneration();
  locationIndexInflight = (async () => {
    try {
      const locations = await listAllLocations();
      /**
       * If locations were mutated while this load ran, discard and reload once
       * so we never publish a stale tree after invalidate.
       */
      if (generation !== getLocationIndexGeneration()) {
        return getLocationIndex();
      }
      const byId = new Map(locations.map((l) => [String(l._id), l]));
      const byParent = buildChildrenMap(locations);
      return setLocationIndexCache({ locations, byId, byParent });
    } finally {
      locationIndexInflight = null;
    }
  })();

  return locationIndexInflight;
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
 * Rack nodes under the selected floor.
 * Same membership rule as Locations (nearest floor ancestor).
 * Qty from Stock snapshot — never ledger replay.
 */
export async function listCascadeRacks(floorId, { allowedLocationIds } = {}) {
  return listRacksUnderFloor(floorId, { allowedLocationIds });
}

export async function resolveCascadeSelection(locationId) {
  await normalizeRackParentsToFloor();
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

  await normalizeRackParentsToFloor();
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
 * Validate minus from existing stock (Branch › Floor › Rack only).
 * Legacy shelf/zone/section stock has been cleared — do not accept those ids.
 */
export async function validateMinusStockLocation(locationId) {
  if (!locationId) {
    throw new Error('Select branch, floor, and rack to remove stock');
  }

  await normalizeRackParentsToFloor();
  const { byId } = await getLocationIndex();
  const loc = byId.get(String(locationId));
  if (!loc || !loc.isActive) {
    throw new Error('Selected location not found or inactive');
  }

  const selection = resolveLocationToCascade(locationId, byId);
  if (!selection.branchId || !selection.floorId) {
    throw new Error('Location must belong to a branch and floor');
  }

  if (loc.level !== ACTIVE_RACK_LEVEL) {
    throw new Error('Stock can only be removed from a rack');
  }

  return selection;
}

export async function buildLocationIndexMaps() {
  await normalizeRackParentsToFloor();
  const { byId } = await getLocationIndex();
  return byId;
}
