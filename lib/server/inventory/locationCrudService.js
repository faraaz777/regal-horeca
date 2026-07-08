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
  const locations = await Location.find({ isActive: true }).sort({ path: 1 }).lean();
  const byId = new Map(locations.map((l) => [String(l._id), l]));

  return locations.map((loc) => ({
    _id: loc._id,
    code: loc.code,
    name: loc.name,
    level: loc.level,
    parentLocationId: loc.parentLocationId,
    path: formatBranchFloorRackPath(String(loc._id), byId),
    isActive: loc.isActive,
    isLegacy: LEGACY_LOCATION_LEVELS.includes(loc.level),
  }));
}

export async function createLocation({ code, name, level, parentLocationId }) {
  const trimmedCode = String(code || '').trim();
  if (!trimmedCode) throw new Error('Location code is required');
  assertActiveLevel(level);

  validateLevelParent(level, parentLocationId);
  await validateParentLevel(level, parentLocationId || null);

  const doc = await Location.create({
    code: trimmedCode,
    name: String(name || '').trim(),
    level,
    parentLocationId: parentLocationId || null,
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

export async function updateLocation(id, { code, name, level, parentLocationId, isActive }) {
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

  validateLevelParent(nextLevel, nextParent);
  await validateParentLevel(nextLevel, nextParent);

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
