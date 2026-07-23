import 'server-only';

import mongoose from 'mongoose';
import Location from '@/lib/models/Location';
import { rebuildPathsFromRoot } from '@/lib/server/inventory/locationCrudService';
import { invalidateLocationIndexCache } from '@/lib/server/inventory/locationIndexCache';
import { getRackProductSummariesByRackIds } from '@/lib/server/inventory/rackLimitsService';
import { formatBranchFloorRackPath } from '@/lib/shared/locationDisplay';

/**
 * Floor rack membership — Branch › Floor › Rack.
 *
 * A rack belongs on floor F when walking parentLocationId reaches F.
 * Create-via-+ already parents to the floor; this heals older rows and
 * keeps Locations / Allocate / Movement lists identical.
 */

const NORMALIZE_COOLDOWN_MS = 30_000;

/** @type {Promise<{ updated: number }> | null} */
let normalizeInflight = null;
let lastNormalizeAt = 0;

/**
 * @param {{ level?: string, parentLocationId?: unknown, _id?: unknown }} loc
 * @param {Map<string, object>} byId
 */
export function findNearestFloorId(loc, byId) {
  let current = loc;
  const seen = new Set();
  while (current && !seen.has(String(current._id))) {
    seen.add(String(current._id));
    if (current.level === 'floor') return String(current._id);
    if (!current.parentLocationId) break;
    current = byId.get(String(current.parentLocationId));
  }
  return null;
}

/**
 * Idempotent: any active rack whose parent is not a floor is re-parented
 * to its nearest floor ancestor so Branch › Floor › Rack holds in DB.
 */
export async function normalizeRackParentsToFloor() {
  if (normalizeInflight) return normalizeInflight;
  if (Date.now() - lastNormalizeAt < NORMALIZE_COOLDOWN_MS) {
    return { updated: 0, skipped: true };
  }

  normalizeInflight = (async () => {
    try {
      const all = await Location.find({ isActive: true })
        .select('_id level parentLocationId')
        .lean();
      const byId = new Map(all.map((l) => [String(l._id), l]));

      const updates = [];
      for (const rack of all) {
        if (rack.level !== 'rack') continue;
        const parent = rack.parentLocationId
          ? byId.get(String(rack.parentLocationId))
          : null;
        if (parent?.level === 'floor') continue;

        const floorId = findNearestFloorId(rack, byId);
        if (!floorId) continue;
        if (String(rack.parentLocationId || '') === floorId) continue;

        updates.push({ rackId: rack._id, floorId });
      }

      if (!updates.length) {
        lastNormalizeAt = Date.now();
        return { updated: 0 };
      }

      for (const u of updates) {
        await Location.updateOne(
          { _id: u.rackId },
          { $set: { parentLocationId: new mongoose.Types.ObjectId(u.floorId) } }
        );
        await rebuildPathsFromRoot(u.rackId);
      }

      invalidateLocationIndexCache();
      lastNormalizeAt = Date.now();
      return { updated: updates.length };
    } finally {
      normalizeInflight = null;
    }
  })();

  return normalizeInflight;
}

/**
 * Active racks under a floor (same set Locations and Allocate must show).
 * Qty from Stock snapshot — never ledger replay.
 */
export async function listRacksUnderFloor(floorId, { allowedLocationIds } = {}) {
  if (!floorId) return [];

  await normalizeRackParentsToFloor();

  const all = await Location.find({ isActive: true })
    .select('_id code name level parentLocationId path isActive')
    .lean();
  const byId = new Map(all.map((l) => [String(l._id), l]));

  const floor = byId.get(String(floorId));
  if (!floor || floor.level !== 'floor') {
    throw new Error('Invalid floor');
  }

  const allowed = allowedLocationIds?.length
    ? new Set(allowedLocationIds.map(String))
    : null;

  const rackLocs = all
    .filter((l) => {
      if (l.level !== 'rack') return false;
      if (allowed && !allowed.has(String(l._id))) return false;
      return findNearestFloorId(l, byId) === String(floorId);
    })
    .sort((a, b) =>
      String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true })
    );

  const summaries = await getRackProductSummariesByRackIds(rackLocs.map((l) => l._id));

  return rackLocs.map((l) => {
    const summary = summaries.get(String(l._id)) || {
      count: 0,
      productIds: [],
      totalQty: 0,
    };
    return {
      _id: String(l._id),
      code: l.code,
      name: l.name || '',
      level: 'rack',
      parentLocationId: String(l.parentLocationId || ''),
      path: l.path,
      displayPath: formatBranchFloorRackPath(String(l._id), byId),
      productCount: summary.count || 0,
      productIds: summary.productIds || [],
      totalQty: Number(summary.totalQty) || 0,
    };
  });
}
