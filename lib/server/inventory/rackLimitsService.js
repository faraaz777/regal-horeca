import 'server-only';

import Location from '@/lib/models/Location';
import Stock from '@/lib/models/Stock';
import {
  MAX_PRODUCTS_PER_RACK,
  RACKS_PER_FLOOR,
} from '@/lib/shared/inventoryConstants';

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
 * Count active rack nodes under a floor (includes racks under legacy section/zone).
 */
export async function countRacksOnFloor(floorId) {
  const all = await Location.find({ isActive: true }).lean();
  const byParent = buildChildrenMap(all);
  const descendantIds = new Set(collectDescendantIds(floorId, byParent));
  return all.filter((l) => l.level === 'rack' && descendantIds.has(String(l._id))).length;
}

export async function assertCanAddRackToFloor(floorId) {
  const count = await countRacksOnFloor(floorId);
  if (count >= RACKS_PER_FLOOR) {
    throw new Error(`This floor already has ${RACKS_PER_FLOOR} racks`);
  }
}

/**
 * Distinct product count at a rack (direct stock only — racks are leaf nodes).
 */
export async function getDistinctProductCountAtRack(rackId) {
  const rows = await Stock.find({ locationId: rackId, qty: { $gt: 0 } })
    .select('productId')
    .lean();
  return new Set(rows.map((r) => String(r.productId))).size;
}

/**
 * Opening stock and new placements must respect the per-rack SKU limit.
 * Existing product already on the rack does not consume an extra slot.
 */
export async function assertRackCanAcceptProduct(rackId, productId = null) {
  const count = await getDistinctProductCountAtRack(rackId);
  if (count < MAX_PRODUCTS_PER_RACK) return;

  if (productId) {
    const alreadyOnRack = await Stock.exists({
      locationId: rackId,
      productId,
      qty: { $gt: 0 },
    });
    if (alreadyOnRack) return;
  }

  throw new Error(
    `Rack is full — maximum ${MAX_PRODUCTS_PER_RACK} products per rack`
  );
}

/**
 * Batch distinct-product counts for cascade rack pickers.
 */
export async function getRackProductSummariesByRackIds(rackIds) {
  if (!rackIds?.length) return new Map();

  const objectIds = rackIds.map((id) => id);
  const agg = await Stock.aggregate([
    { $match: { locationId: { $in: objectIds }, qty: { $gt: 0 } } },
    { $group: { _id: '$locationId', products: { $addToSet: '$productId' } } },
    {
      $project: {
        count: { $size: '$products' },
        productIds: '$products',
      },
    },
  ]);

  const map = new Map();
  for (const row of agg) {
    map.set(String(row._id), {
      count: row.count,
      productIds: (row.productIds || []).map(String),
    });
  }
  return map;
}

/** @deprecated Use getRackProductSummariesByRackIds */
export async function getDistinctProductCountsByRackIds(rackIds) {
  const summaries = await getRackProductSummariesByRackIds(rackIds);
  const map = new Map();
  for (const [id, summary] of summaries) {
    map.set(id, summary.count);
  }
  return map;
}

/**
 * Create the standard R1–R5 rack set when a new floor is added.
 */
export async function seedDefaultRacksForFloor(floorId) {
  const existing = await countRacksOnFloor(floorId);
  if (existing > 0) return [];

  const created = [];
  for (let i = 1; i <= RACKS_PER_FLOOR; i += 1) {
    const doc = await Location.create({
      code: `R${i}`,
      name: `Rack ${i}`,
      level: 'rack',
      parentLocationId: floorId,
      path: `R${i}`,
      isActive: true,
      capacity: MAX_PRODUCTS_PER_RACK,
    });
    created.push(doc);
  }
  return created;
}
