import 'server-only';

import Location from '@/lib/models/Location';
import { listAllLocations } from '@/lib/server/inventory/locationCrudService';
import {
  formatBranchFloorRackPath,
  resolveLocationToCascade,
} from '@/lib/shared/locationDisplay';
import { getRackProductSummariesByRackIds } from '@/lib/server/inventory/rackLimitsService';
import {
  peekLocationIndexCache,
  setLocationIndexCache,
} from '@/lib/server/inventory/locationIndexCache';

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

/**
 * Shared location index for cascade APIs.
 * Reads Stock snapshots separately — never replays StockLedger for qty.
 */
async function getLocationIndex() {
  const cached = peekLocationIndexCache();
  if (cached) return cached;

  const locations = await listAllLocations();
  const byId = new Map(locations.map((l) => [String(l._id), l]));
  const byParent = buildChildrenMap(locations);
  return setLocationIndexCache({ locations, byId, byParent });
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

function toRackDto(loc, byId, summary = { count: 0, productIds: [], totalQty: 0 }) {
  const productCount = summary.count || 0;
  return {
    _id: String(loc._id),
    code: loc.code,
    name: loc.name || '',
    level: 'rack',
    parentLocationId: String(loc.parentLocationId),
    path: loc.path,
    displayPath: formatBranchFloorRackPath(String(loc._id), byId),
    productCount,
    productIds: summary.productIds || [],
    /**
     * Sellable units of every SKU already sitting on this rack.
     * From Stock snapshot only — never summed from ledger on read.
     */
    totalQty: Number(summary.totalQty) || 0,
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
 * Cold-path: walk only descendants of this floor (section/zone/rack).
 * Avoids loading the entire warehouse when the TTL cache is empty.
 */
async function loadRacksScopedToFloor(floorId) {
  const floor = await Location.findOne({
    _id: floorId,
    level: 'floor',
    isActive: true,
  })
    .select('_id code name level parentLocationId path isActive')
    .lean();

  if (!floor) throw new Error('Invalid floor');

  const byId = new Map([[String(floor._id), floor]]);
  const rackLocs = [];
  let frontier = [floor._id];

  while (frontier.length) {
    const children = await Location.find({
      parentLocationId: { $in: frontier },
      isActive: true,
    })
      .select('_id code name level parentLocationId path isActive')
      .lean();

    frontier = [];
    for (const child of children) {
      byId.set(String(child._id), child);
      if (child.level === ACTIVE_RACK_LEVEL) {
        rackLocs.push(child);
      } else {
        frontier.push(child._id);
      }
    }
  }

  // Ancestors (branch) for displayPath — usually one hop from floor.
  let cursor = floor;
  while (cursor?.parentLocationId) {
    const pid = String(cursor.parentLocationId);
    if (byId.has(pid)) break;
    const parent = await Location.findById(pid)
      .select('_id code name level parentLocationId path isActive')
      .lean();
    if (!parent) break;
    byId.set(pid, parent);
    cursor = parent;
  }

  return { rackLocs, byId };
}

/**
 * Rack nodes under the selected floor.
 * Warm cache → filter in memory. Cold → scoped BFS under that floor only.
 * Qty from Stock snapshot — never ledger replay.
 */
export async function listCascadeRacks(floorId, { allowedLocationIds } = {}) {
  if (!floorId) return [];

  const allowed = allowedLocationIds?.length
    ? new Set(allowedLocationIds.map(String))
    : null;

  let rackLocs;
  let byId;

  const cached = peekLocationIndexCache();
  if (cached) {
    const floor = cached.byId.get(String(floorId));
    if (!floor || floor.level !== 'floor') {
      throw new Error('Invalid floor');
    }
    const descendantIds = new Set(collectDescendantIds(floorId, cached.byParent));
    rackLocs = cached.locations.filter((l) => {
      if (!descendantIds.has(String(l._id))) return false;
      if (l.level !== ACTIVE_RACK_LEVEL) return false;
      if (allowed && !allowed.has(String(l._id))) return false;
      return true;
    });
    byId = cached.byId;
  } else {
    const scoped = await loadRacksScopedToFloor(floorId);
    rackLocs = scoped.rackLocs.filter((l) => !allowed || allowed.has(String(l._id)));
    byId = scoped.byId;
    // Warm shared index for floors/branches without blocking this response's shape.
    getLocationIndex().catch(() => {});
  }

  const summaries = await getRackProductSummariesByRackIds(rackLocs.map((l) => l._id));

  return rackLocs.map((l) =>
    toRackDto(l, byId, summaries.get(String(l._id)) || { count: 0, productIds: [], totalQty: 0 })
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
