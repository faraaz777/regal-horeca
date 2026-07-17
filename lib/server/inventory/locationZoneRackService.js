import 'server-only';

import Location from '@/lib/models/Location';
import FloorLayout from '@/lib/models/FloorLayout';
import Stock from '@/lib/models/Stock';
import Product from '@/lib/models/Product';
import { resolveRackPlacementInZone } from '@/lib/shared/rackPlacementUtils';
import { listCascadeRacks } from '@/lib/server/inventory/locationSelectService';
import { listAllLocations } from '@/lib/server/inventory/locationCrudService';
import { logAudit } from '@/lib/server/audit/logAudit';
import { deriveStockStatus, getDefaultLowStockThreshold } from '@/lib/server/inventory/inventoryService';
import {
  getCanvasDimensions,
  normaliseRackPosition,
  buildZoneSummariesDetailed,
} from '@/lib/server/inventory/locationZoneService';

export const DEFAULT_RACK_WIDTH = 120;
export const DEFAULT_RACK_HEIGHT = 80;

function deriveRackStockStatus(stockAgg, threshold) {
  return deriveStockStatus(stockAgg.sellableQty, threshold);
}

function aggregateRackStock(stockRows) {
  let sellableQty = 0;
  let deadStockQty = 0;
  for (const row of stockRows || []) {
    const qty = row.qty || 0;
    if (row.statusBucket === 'sellable') sellableQty += qty;
    else if (row.statusBucket === 'dead_stock') deadStockQty += qty;
  }
  return {
    sellableQty,
    deadStockQty,
    holdQty: 0,
    scrapQty: 0,
    totalQty: sellableQty + deadStockQty,
  };
}

async function loadFloorContext(floorId) {
  const floor = await Location.findById(floorId).lean();
  if (!floor || floor.level !== 'floor' || !floor.isActive) {
    throw new Error('Floor not found');
  }

  let layoutDoc = await FloorLayout.findOne({ floorId }).lean();
  if (!layoutDoc) {
    const created = await FloorLayout.create({
      floorId,
      branchId: floor.parentLocationId,
      version: 1,
    });
    layoutDoc = created.toObject();
  }

  const allLocs = await listAllLocations();
  const byId = new Map(allLocs.map((l) => [String(l._id), l]));

  const cascadeRacks = await listCascadeRacks(floorId);
  const rackIds = cascadeRacks.map((r) => r._id);

  const [rackDocs, stocks, threshold, products] = await Promise.all([
    rackIds.length
      ? Location.find({ _id: { $in: rackIds }, level: 'rack' }).lean()
      : [],
    rackIds.length
      ? Stock.find({
          locationId: { $in: rackIds },
          qty: { $gt: 0 },
          statusBucket: { $in: ['sellable', 'dead_stock'] },
        }).lean()
      : [],
    getDefaultLowStockThreshold(),
    rackIds.length
      ? Stock.find({ locationId: { $in: rackIds }, qty: { $gt: 0 } })
          .distinct('productId')
          .then((pids) =>
            pids.length
              ? Product.find({ _id: { $in: pids }, deletedAt: null })
                  .select('title sku barcode')
                  .lean()
              : []
          )
      : [],
  ]);

  const productById = new Map(products.map((p) => [String(p._id), p]));
  const stockByRack = new Map();
  const productsByRack = new Map();

  for (const row of stocks) {
    const rid = String(row.locationId);
    if (!stockByRack.has(rid)) stockByRack.set(rid, []);
    stockByRack.get(rid).push(row);

    if (!productsByRack.has(rid)) productsByRack.set(rid, new Set());
    productsByRack.get(rid).add(String(row.productId));
  }

  const rackDocById = new Map(rackDocs.map((r) => [String(r._id), r]));
  const zoneById = new Map((layoutDoc.zones || []).map((z) => [z.id, z]));

  const floorName = floor.name || floor.code || 'Floor';

  return {
    floor,
    layoutDoc,
    byId,
    rackDocById,
    stockByRack,
    productsByRack,
    productById,
    zoneById,
    threshold,
    floorName,
    cascadeRacks,
  };
}

function getAllocationStatus(rackDoc, zoneId, zoneById) {
  if (!rackDoc.isActive) return 'inactive';
  const zid = rackDoc.position?.zoneId;
  if (!zid) return 'available';
  if (zid === zoneId) return 'assigned_here';
  return 'assigned_elsewhere';
}

function rackMatchesSearch(rackDoc, ctx, q) {
  if (!q) return true;
  const lower = q.toLowerCase();
  const code = (rackDoc.code || '').toLowerCase();
  const name = (rackDoc.name || '').toLowerCase();
  if (code.includes(lower) || name.includes(lower)) return true;

  const zid = rackDoc.position?.zoneId;
  if (zid && ctx.zoneById.has(zid)) {
    const z = ctx.zoneById.get(zid);
    if ((z.name || '').toLowerCase().includes(lower)) return true;
    if ((z.code || '').toLowerCase().includes(lower)) return true;
  }

  if (ctx.floorName.toLowerCase().includes(lower)) return true;

  const rid = String(rackDoc._id);
  const productIds = ctx.productsByRack.get(rid);
  if (productIds) {
    for (const pid of productIds) {
      const p = ctx.productById.get(pid);
      if (!p) continue;
      if ((p.title || '').toLowerCase().includes(lower)) return true;
      if ((p.sku || '').toLowerCase().includes(lower)) return true;
      if ((p.barcode || '').toLowerCase().includes(lower)) return true;
    }
  }
  return false;
}

function buildRackOptionItem(rackDoc, ctx, zoneId) {
  const rid = String(rackDoc._id);
  const stockAgg = aggregateRackStock(ctx.stockByRack.get(rid) || []);
  const status = deriveRackStockStatus(stockAgg, ctx.threshold);
  const allocationStatus = getAllocationStatus(rackDoc, zoneId, ctx.zoneById);
  const assignedZoneId = rackDoc.position?.zoneId;
  const assignedZone = assignedZoneId ? ctx.zoneById.get(assignedZoneId) : null;
  const capacity = rackDoc.capacity ?? null;
  const productSet = ctx.productsByRack.get(rid);

  return {
    rackId: rid,
    name: rackDoc.name || '',
    code: rackDoc.code || '',
    shelfName: '',
    allocationStatus,
    assignedZone: assignedZone
      ? { id: assignedZone.id, name: assignedZone.name || assignedZone.code }
      : null,
    totalQty: stockAgg.totalQty,
    distinctProductCount: productSet?.size ?? 0,
    capacity,
    utilisationPercent:
      capacity && capacity > 0
        ? Math.min(100, Math.round((stockAgg.totalQty / capacity) * 100))
        : null,
    stockStatus: status,
    sellableQty: stockAgg.sellableQty,
    deadStockQty: stockAgg.deadStockQty,
    holdQty: 0,
    scrapQty: 0,
  };
}

export async function getZoneRackOptions(floorId, zoneId, { search = '', status = 'all', page = 1, limit = 50 } = {}) {
  const ctx = await loadFloorContext(floorId);
  const zone = ctx.zoneById.get(zoneId);
  if (!zone) throw new Error('Zone not found');

  let items = [];
  for (const rack of ctx.cascadeRacks) {
    const doc = ctx.rackDocById.get(String(rack._id));
    if (!doc) continue;
    if (!rackMatchesSearch(doc, ctx, search)) continue;

    const allocationStatus = getAllocationStatus(doc, zoneId, ctx.zoneById);

    if (status === 'available' && allocationStatus !== 'available') continue;
    if (status === 'assigned_here' && allocationStatus !== 'assigned_here') continue;
    if (status === 'assigned_elsewhere' && allocationStatus !== 'assigned_elsewhere') continue;

    items.push(buildRackOptionItem(doc, ctx, zoneId));
  }

  items.sort((a, b) => a.code.localeCompare(b.code));
  const total = items.length;
  const start = (page - 1) * limit;
  const paged = items.slice(start, start + limit);

  return {
    zone: { id: zone.id, name: zone.name, code: zone.code || '' },
    items: paged,
    pagination: { page, limit, total },
  };
}

export async function getZoneSummary(floorId, zoneId) {
  const ctx = await loadFloorContext(floorId);
  const zone = ctx.zoneById.get(zoneId);
  if (!zone) throw new Error('Zone not found');

  const rackDtos = [];
  for (const rack of ctx.cascadeRacks) {
    const doc = ctx.rackDocById.get(String(rack._id));
    if (!doc?.position?.zoneId || doc.position.zoneId !== zoneId) continue;
    const rid = String(doc._id);
    const stockAgg = aggregateRackStock(ctx.stockByRack.get(rid) || []);
    rackDtos.push({
      _id: rid,
      stockStatus: deriveRackStockStatus(stockAgg, ctx.threshold),
      totalQty: stockAgg.totalQty,
      capacity: doc.capacity ?? null,
      sellableQty: stockAgg.sellableQty,
      deadStockQty: stockAgg.deadStockQty,
      holdQty: 0,
      scrapQty: 0,
    });
  }

  const summaries = buildZoneSummariesDetailed([zone], rackDtos, ctx.stockByRack);
  return summaries[0]?.summary || null;
}

async function assertLayoutVersion(floorId, layoutVersion) {
  let doc = await FloorLayout.findOne({ floorId });
  if (!doc) {
    const floor = await Location.findById(floorId).lean();
    if (!floor || floor.level !== 'floor') throw new Error('Floor not found');
    doc = await FloorLayout.create({
      floorId,
      branchId: floor.parentLocationId,
      version: 1,
    });
  }
  if (layoutVersion != null && doc.version !== layoutVersion) {
    const err = new Error('Layout version conflict');
    err.code = 'LAYOUT_CONFLICT';
    err.currentVersion = doc.version;
    throw err;
  }
  return doc;
}

function buildAssignedRacksInZone(ctx, zoneId) {
  const racks = [];
  for (const rack of ctx.cascadeRacks) {
    const doc = ctx.rackDocById.get(String(rack._id));
    if (doc?.position?.zoneId === zoneId && doc.position?.x != null) {
      racks.push({ _id: String(doc._id), position: doc.position });
    }
  }
  return racks;
}

export async function assignRacksToZone(
  floorId,
  zoneId,
  rackIds,
  layoutVersion,
  user = null,
  request = null
) {
  await assertLayoutVersion(floorId, layoutVersion);
  const ctx = await loadFloorContext(floorId);
  const zone = ctx.zoneById.get(zoneId);
  if (!zone) throw new Error('Zone not found');

  const { coordinateWidth, coordinateHeight } = getCanvasDimensions(ctx.layoutDoc);
  const assignedInZone = buildAssignedRacksInZone(ctx, zoneId);
  const results = [];

  for (const rackId of rackIds) {
    const doc = ctx.rackDocById.get(String(rackId));
    if (!doc || !doc.isActive) throw new Error(`Rack ${rackId} not found or inactive`);

    const existingZoneId = doc.position?.zoneId;
    if (existingZoneId && existingZoneId !== zoneId) {
      throw new Error(`Rack ${doc.code} is assigned to another zone — use move instead`);
    }

    const rackWidth = doc.position?.width ?? DEFAULT_RACK_WIDTH;
    const rackHeight = doc.position?.height ?? DEFAULT_RACK_HEIGHT;

    const slot = resolveRackPlacementInZone(
      zone,
      assignedInZone.map((r) => ({ position: r.position })),
      { width: rackWidth, height: rackHeight },
      assignedInZone.length
    );

    const position = normaliseRackPosition(
      { ...slot, zoneId, rotation: doc.position?.rotation ?? 0, isPlaced: true },
      coordinateWidth,
      coordinateHeight
    );

    await Location.findByIdAndUpdate(rackId, { $set: { position } });

    assignedInZone.push({ _id: String(rackId), position });
    results.push({ rackId: String(rackId), position });

    await logAudit({
      actorId: user?.userId,
      actorRole: user?.role,
      action: 'locator.rack_assigned_to_zone',
      entityType: 'Location',
      entityId: rackId,
      before: doc.position,
      after: position,
      metadata: { floorId: String(floorId), zoneId },
      request,
    });
  }

  await FloorLayout.updateOne({ floorId }, { $inc: { version: 1 } });

  return { assigned: results };
}

export async function moveRackToZone(
  floorId,
  zoneId,
  rackId,
  fromZoneId,
  layoutVersion,
  user = null,
  request = null
) {
  await assertLayoutVersion(floorId, layoutVersion);
  const ctx = await loadFloorContext(floorId);
  const zone = ctx.zoneById.get(zoneId);
  if (!zone) throw new Error('Target zone not found');

  const doc = ctx.rackDocById.get(String(rackId));
  if (!doc || !doc.isActive) throw new Error('Rack not found');

  if (doc.position?.zoneId !== fromZoneId) {
    throw new Error('Rack is not assigned to the specified source zone');
  }

  const { coordinateWidth, coordinateHeight } = getCanvasDimensions(ctx.layoutDoc);
  const width = doc.position?.width ?? DEFAULT_RACK_WIDTH;
  const height = doc.position?.height ?? DEFAULT_RACK_HEIGHT;

  const assignedInZone = buildAssignedRacksInZone(ctx, zoneId);
  const slot = resolveRackPlacementInZone(
    zone,
    assignedInZone.map((r) => ({ position: r.position })),
    { width, height },
    assignedInZone.length
  );

  const position = normaliseRackPosition(
    { ...slot, zoneId, width, height, rotation: doc.position?.rotation ?? 0, isPlaced: true },
    coordinateWidth,
    coordinateHeight
  );

  await Location.findByIdAndUpdate(rackId, { $set: { position } });

  await logAudit({
    actorId: user?.userId,
    actorRole: user?.role,
    action: 'locator.rack_moved_between_zones',
    entityType: 'Location',
    entityId: rackId,
    before: doc.position,
    after: position,
    metadata: { floorId: String(floorId), fromZoneId, toZoneId: zoneId },
    request,
  });

  await FloorLayout.updateOne({ floorId }, { $inc: { version: 1 } });

  return { rackId: String(rackId), position };
}

export async function removeRacksFromZone(
  floorId,
  zoneId,
  rackIds,
  layoutVersion,
  user = null,
  request = null
) {
  await assertLayoutVersion(floorId, layoutVersion);
  const ctx = await loadFloorContext(floorId);
  const zone = ctx.zoneById.get(zoneId);
  if (!zone) throw new Error('Zone not found');

  const results = [];

  for (const rackId of rackIds) {
    const doc = ctx.rackDocById.get(String(rackId));
    if (!doc) throw new Error(`Rack ${rackId} not found`);
    if (doc.position?.zoneId !== zoneId) {
      throw new Error(`Rack ${doc.code} is not assigned to this zone`);
    }

    await Location.findByIdAndUpdate(rackId, { $set: { position: null } });
    results.push({ rackId: String(rackId) });

    await logAudit({
      actorId: user?.userId,
      actorRole: user?.role,
      action: 'locator.rack_removed_from_zone',
      entityType: 'Location',
      entityId: rackId,
      before: doc.position,
      after: null,
      metadata: { floorId: String(floorId), zoneId, totalQty: aggregateRackStock(ctx.stockByRack.get(String(rackId)) || []).totalQty },
      request,
    });
  }

  await FloorLayout.updateOne({ floorId }, { $inc: { version: 1 } });

  return { removed: results };
}
