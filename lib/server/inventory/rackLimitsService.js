import 'server-only';

import Location from '@/lib/models/Location';
import Stock from '@/lib/models/Stock';

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
 * Batch rack occupancy for cascade pickers.
 * count = distinct products; totalQty = sum of sellable units across all SKUs.
 * No capacity / full-flag enforcement — operators decide rack density.
 */
export async function getRackProductSummariesByRackIds(rackIds) {
  if (!rackIds?.length) return new Map();

  const objectIds = rackIds.map((id) => id);
  const agg = await Stock.aggregate([
    {
      $match: {
        locationId: { $in: objectIds },
        qty: { $gt: 0 },
        statusBucket: 'sellable',
      },
    },
    {
      $group: {
        _id: '$locationId',
        products: { $addToSet: '$productId' },
        totalQty: { $sum: '$qty' },
      },
    },
    {
      $project: {
        count: { $size: '$products' },
        productIds: '$products',
        totalQty: 1,
      },
    },
  ]);

  const map = new Map();
  for (const row of agg) {
    map.set(String(row._id), {
      count: row.count,
      productIds: (row.productIds || []).map(String),
      totalQty: Number(row.totalQty) || 0,
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
