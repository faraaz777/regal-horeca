import 'server-only';

import mongoose from 'mongoose';
import Location from '@/lib/models/Location';
import Stock from '@/lib/models/Stock';
import {
  ACTIVE_LOCATION_LEVELS,
  LEGACY_LOCATION_LEVELS,
  ACTIVE_LOCATION_PARENT,
} from '@/lib/shared/inventoryConstants';
import { formatBranchFloorRackPath } from '@/lib/shared/locationDisplay';

/**
 * Strict ObjectId check — rejects 12-char strings that areValid would accept.
 */
export function isValidLocationId(id) {
  if (id == null || id === '') return false;
  const s = String(id);
  return mongoose.Types.ObjectId.isValid(s) && String(new mongoose.Types.ObjectId(s)) === s;
}

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
  const ids = [nodeId];
  for (const child of byParent.get(String(nodeId)) || []) {
    ids.push(...collectDescendantIds(String(child._id), byParent));
  }
  return ids;
}

export function validateLevelParent(level, parentLocationId) {
  if (level === 'branch') {
    if (parentLocationId) {
      throw new Error('Branch locations cannot have a parent');
    }
    return;
  }
  if (!parentLocationId) {
    throw new Error(`Parent is required for level "${level}"`);
  }
}

export async function validateParentLevel(level, parentLocationId) {
  assertActiveLevel(level);

  if (level === 'branch') return null;

  const parent = await Location.findById(parentLocationId).lean();
  if (!parent || !parent.isActive) {
    throw new Error('Parent location not found or inactive');
  }

  const expectedParentLevel = ACTIVE_LOCATION_PARENT[level];
  if (parent.level !== expectedParentLevel) {
    throw new Error(
      `Parent must be a "${expectedParentLevel}" for a "${level}" node`
    );
  }
  return parent;
}

function assertActiveLevel(level) {
  if (LEGACY_LOCATION_LEVELS.includes(level)) {
    throw new Error(
      'Section, zone, and shelf are legacy levels. Use Branch → Floor → Rack only.'
    );
  }
  if (!ACTIVE_LOCATION_LEVELS.includes(level)) {
    throw new Error('Invalid location level');
  }
}

const CODE_PREFIX = {
  branch: 'B',
  floor: 'F',
  rack: 'R',
};

/**
 * Next sequential code under a parent (B1, F2, R3…).
 * Server is the source of truth so concurrent creates stay unique.
 */
export async function suggestNextLocationCode(level, parentLocationId = null) {
  assertActiveLevel(level);
  const prefix = CODE_PREFIX[level];
  if (!prefix) throw new Error('Invalid location level');

  const siblings = await Location.find({
    level,
    parentLocationId: parentLocationId || null,
  })
    .select('code')
    .lean();

  let max = 0;
  const re = new RegExp(`^${prefix}(\\d+)$`, 'i');
  for (const s of siblings) {
    const m = String(s.code || '').trim().match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}${max + 1}`;
}

function defaultNameFor(level, code) {
  const num = String(code || '').replace(/^[A-Za-z]+/, '') || '1';
  if (level === 'branch') return `Branch ${num}`;
  if (level === 'floor') return `Floor ${num}`;
  return `Rack ${num}`;
}

async function rebuildStoredPath(loc, byId) {
  const displayPath = formatBranchFloorRackPath(String(loc._id), byId);
  await Location.updateOne({ _id: loc._id }, { path: displayPath });
  return displayPath;
}

export async function rebuildPathsFromRoot(rootId = null) {
  const all = await Location.find(rootId ? { _id: rootId } : {}).lean();
  if (rootId && all.length === 0) return;

  const fullTree = await Location.find({}).lean();
  const byId = new Map(fullTree.map((l) => [String(l._id), l]));
  const byParent = buildChildrenMap(fullTree);

  async function walk(id) {
    const loc = byId.get(String(id));
    if (!loc) return;
    await rebuildStoredPath(loc, byId);
    for (const child of byParent.get(String(id)) || []) {
      await walk(child._id);
    }
  }

  const startIds = rootId ? [rootId] : (byParent.get('root') || []).map((l) => l._id);
  for (const id of startIds) {
    await walk(id);
  }
}

export async function listAllLocations() {
  const locations = await Location.find({
    isActive: true,
    level: { $in: ACTIVE_LOCATION_LEVELS },
  })
    .sort({ path: 1 })
    .lean();
  const byId = new Map(locations.map((l) => [String(l._id), l]));

  return locations.map((loc) => ({
    _id: loc._id,
    code: loc.code,
    name: loc.name,
    level: loc.level,
    parentLocationId: loc.parentLocationId,
    path: formatBranchFloorRackPath(String(loc._id), byId),
    isActive: loc.isActive,
  }));
}

/**
 * Create a location. Code/name auto-generated when omitted.
 * Floors no longer auto-seed racks — use the Locations UI "+" to add racks.
 * Delete rules unchanged: children-first, stock blocks, hard delete when empty.
 */
export async function createLocation({ code, name, level, parentLocationId }) {
  assertActiveLevel(level);

  const parentId = parentLocationId || null;
  validateLevelParent(level, parentId);
  await validateParentLevel(level, parentId);

  let trimmedCode = String(code || '').trim();
  if (!trimmedCode) {
    trimmedCode = await suggestNextLocationCode(level, parentId);
  }

  let trimmedName = String(name || '').trim();
  if (!trimmedName) {
    trimmedName = defaultNameFor(level, trimmedCode);
  }

  const doc = await Location.create({
    code: trimmedCode,
    name: trimmedName,
    level,
    parentLocationId: parentId,
    path: trimmedCode,
    isActive: true,
  });

  await rebuildPathsFromRoot(doc._id);
  const fresh = await Location.findById(doc._id).lean();
  const byId = new Map((await Location.find({}).lean()).map((l) => [String(l._id), l]));

  return {
    ...fresh,
    displayPath: formatBranchFloorRackPath(String(fresh._id), byId),
  };
}

export async function updateLocation(id, { code, name, level, parentLocationId, isActive, capacity }) {
  const location = await Location.findById(id);
  if (!location) throw new Error('Location not found');

  if (LEGACY_LOCATION_LEVELS.includes(location.level)) {
    throw new Error('Legacy location nodes are read-only');
  }

  const nextLevel = level ?? location.level;
  assertActiveLevel(nextLevel);
  const nextParent =
    parentLocationId !== undefined
      ? parentLocationId || null
      : location.parentLocationId;

  if (code != null) location.code = String(code).trim();
  if (name != null) location.name = String(name).trim();
  if (level != null) location.level = level;
  if (parentLocationId !== undefined) location.parentLocationId = nextParent;
  if (isActive != null) location.isActive = Boolean(isActive);
  if (capacity !== undefined) {
    if (capacity === null || capacity === '') {
      location.capacity = null;
    } else {
      const num = Number(capacity);
      if (!Number.isFinite(num) || num < 0) {
        throw new Error('Capacity must be a positive number');
      }
      location.capacity = num;
    }
  }

  const structuralChange =
    level !== undefined || parentLocationId !== undefined;
  if (structuralChange) {
    validateLevelParent(nextLevel, nextParent);
    await validateParentLevel(nextLevel, nextParent);
  }

  await location.save();
  await rebuildPathsFromRoot(location._id);

  const fresh = await Location.findById(id).lean();
  const byId = new Map((await Location.find({}).lean()).map((l) => [String(l._id), l]));
  return { ...fresh, displayPath: formatBranchFloorRackPath(String(fresh._id), byId) };
}

export async function locationHasChildren(locationId) {
  const count = await Location.countDocuments({ parentLocationId: locationId });
  return count > 0;
}

export async function locationHasStock(locationId) {
  const all = await Location.find({}).lean();
  const byParent = buildChildrenMap(all);
  const ids = collectDescendantIds(String(locationId), byParent);

  const count = await Stock.countDocuments({
    locationId: { $in: ids },
    statusBucket: 'sellable',
    qty: { $gt: 0 },
  });
  return count > 0;
}

export async function deleteLocation(locationId) {
  const location = await Location.findById(locationId);
  if (!location) throw new Error('Location not found');

  if (LEGACY_LOCATION_LEVELS.includes(location.level)) {
    throw new Error('Legacy location nodes are read-only');
  }

  if (await locationHasChildren(locationId)) {
    throw new Error('Delete child locations first');
  }
  if (await locationHasStock(locationId)) {
    throw new Error('Location has stock and cannot be deleted');
  }

  await Location.findByIdAndDelete(locationId);
  return { success: true };
}

export async function getLocationById(locationId) {
  const loc = await Location.findById(locationId).lean();
  if (!loc) throw new Error('Location not found');
  const byId = new Map((await Location.find({}).lean()).map((l) => [String(l._id), l]));
  return { ...loc, displayPath: formatBranchFloorRackPath(String(loc._id), byId) };
}
