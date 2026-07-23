import 'server-only';

import Location from '@/lib/models/Location';
import FloorLayout from '@/lib/models/FloorLayout';
import Stock from '@/lib/models/Stock';
import StockLedger from '@/lib/models/StockLedger';
import Product from '@/lib/models/Product';
import InventoryRule from '@/lib/models/InventoryRule';
import { LEGACY_LOCATION_LEVELS } from '@/lib/shared/inventoryConstants';
import {
  DEFAULT_COORDINATE_HEIGHT,
  DEFAULT_COORDINATE_WIDTH,
} from '@/lib/shared/floorLayoutConstants';
import { findContainingZoneId, rectCentre } from '@/lib/shared/canvasCoordinates';
import { clampRackInsideZone } from '@/lib/shared/rackPlacementUtils';
import {
  formatBranchFloorRackPath,
  formatBranchFloorRackPathCodesWithRackName,
} from '@/lib/shared/locationDisplay';
import { listCascadeRacks } from '@/lib/server/inventory/locationSelectService';
import { listAllLocations } from '@/lib/server/inventory/locationCrudService';
import {
  buildZoneSummariesDetailed,
  getCanvasDimensions,
  normaliseRackPosition,
  normaliseZones,
  validateRackInsideZone,
  validateZoneBounds,
  validateZoneNamesUnique,
} from '@/lib/server/inventory/locationZoneService';
import {
  removeFloorPlanFromStorage,
  uploadFloorPlanImage,
} from '@/lib/server/inventory/floorPlanImageService';
import { logAudit } from '@/lib/server/audit/logAudit';

export const DEFAULT_RACK_WIDTH = 120;
export const DEFAULT_RACK_HEIGHT = 80;

/**
 * sellableQty at a rack = physical pieces at that location (Stock snapshot).
 * productCount = distinct SKUs with qty > 0 — a fact, not fill %.
 */
function aggregateRackStock(stockRows) {
  let sellableQty = 0;
  const productIds = new Set();

  for (const row of stockRows || []) {
    if (row.statusBucket === 'sellable') {
      sellableQty += row.qty || 0;
      if (row.productId && (row.qty || 0) > 0) {
        productIds.add(String(row.productId));
      }
    }
  }

  return {
    sellableQty,
    holdQty: 0,
    scrapQty: 0,
    totalQty: sellableQty,
    productCount: productIds.size,
  };
}

/**
 * Locator presence only — empty vs has stock.
 * Does NOT use min-stock thresholds (those are product planning rules).
 */
export function deriveRackStockPresence({ sellableQty, productCount }) {
  const qty = Number(sellableQty) || 0;
  const skus = Number(productCount) || 0;
  return qty > 0 || skus > 0 ? 'has_stock' : 'empty';
}

/** @deprecated Prefer deriveRackStockPresence — no longer uses threshold. */
export function deriveRackStockStatus(agg) {
  return deriveRackStockPresence(agg);
}

function normalizePosition(position, coordinateWidth, coordinateHeight) {
  if (!position || position.x == null || position.y == null) return null;
  return normaliseRackPosition(
    {
      x: position.x,
      y: position.y,
      width: position.width ?? DEFAULT_RACK_WIDTH,
      height: position.height ?? DEFAULT_RACK_HEIGHT,
      rotation: position.rotation ?? 0,
      zoneId: position.zoneId ?? null,
      isPlaced: position.isPlaced !== false,
      xRatio: position.xRatio,
      yRatio: position.yRatio,
      widthRatio: position.widthRatio,
      heightRatio: position.heightRatio,
    },
    coordinateWidth,
    coordinateHeight
  );
}

function serializeLayoutDoc(doc, zoneSummariesById = null) {
  if (!doc) return null;
  const bg = doc.backgroundImage || {};
  const zones = (doc.zones || []).map((z) => {
    const summaryEntry = zoneSummariesById?.get(z.id);
    return {
      ...z,
      summary: summaryEntry?.summary ?? null,
    };
  });
  return {
    backgroundImage: {
      url: bg.url || null,
      storageKey: bg.storageKey || null,
      originalWidth: bg.originalWidth ?? null,
      originalHeight: bg.originalHeight ?? null,
      aspectRatio: bg.aspectRatio ?? null,
      opacity: bg.opacity ?? 1,
      visible: bg.visible !== false,
      locked: bg.locked !== false,
    },
    canvas: {
      coordinateWidth: doc.canvas?.coordinateWidth ?? DEFAULT_COORDINATE_WIDTH,
      coordinateHeight: doc.canvas?.coordinateHeight ?? DEFAULT_COORDINATE_HEIGHT,
      gridEnabled: doc.canvas?.gridEnabled !== false,
      gridSize: doc.canvas?.gridSize ?? 20,
      snapEnabled: doc.canvas?.snapEnabled !== false,
      guidesEnabled: doc.canvas?.guidesEnabled !== false,
      rackPlacementRule: doc.canvas?.rackPlacementRule ?? 'allow_unzoned',
    },
    zones,
    version: doc.version ?? 1,
    status: doc.status ?? 'draft',
    updatedAt: doc.updatedAt,
    publishedAt: doc.publishedAt ?? null,
  };
}

async function getOrCreateFloorLayout(floorId, branchId, userId) {
  let doc = await FloorLayout.findOne({ floorId }).lean();
  if (doc) return doc;

  const created = await FloorLayout.create({
    floorId,
    branchId,
    createdBy: userId || undefined,
    updatedBy: userId || undefined,
  });
  return created.toObject();
}

function buildRackDto(rack, doc, stockAgg, byId, coordinateWidth, coordinateHeight) {
  const stockPresence = deriveRackStockPresence(stockAgg);
  return {
    _id: String(rack._id),
    code: rack.code,
    name: rack.name || '',
    displayPath: rack.displayPath || formatBranchFloorRackPath(String(rack._id), byId),
    displayPathShort: formatBranchFloorRackPathCodesWithRackName(String(rack._id), byId),
    sellableQty: stockAgg.sellableQty,
    holdQty: 0,
    scrapQty: 0,
    totalQty: stockAgg.totalQty,
    productCount: stockAgg.productCount || 0,
    hasStock: stockPresence === 'has_stock',
    stockPresence,
    /** @deprecated Prefer stockPresence — kept empty|has_stock for older clients */
    stockStatus: stockPresence,
    position: normalizePosition(doc?.position, coordinateWidth, coordinateHeight),
  };
}

function buildPositionPayload(input, existing, layoutDoc) {
  const { coordinateWidth, coordinateHeight } = getCanvasDimensions(layoutDoc);
  const zones = layoutDoc?.zones || [];
  const rule = layoutDoc?.canvas?.rackPlacementRule ?? 'allow_unzoned';

  const width = input.width ?? existing?.position?.width ?? DEFAULT_RACK_WIDTH;
  const height = input.height ?? existing?.position?.height ?? DEFAULT_RACK_HEIGHT;
  let x = input.x;
  let y = input.y;

  let zoneId = existing?.position?.zoneId ?? null;
  if (input.zoneId !== undefined) {
    zoneId = input.zoneId;
  }

  // Reposition within zone — never reassign zone from drag
  if (existing?.position?.zoneId && input.zoneId === undefined) {
    zoneId = existing.position.zoneId;
  } else if (!zoneId && input.allowZoneDetection) {
    zoneId = findContainingZoneId(rectCentre({ x, y, width, height }), zones);
  }

  if (zoneId) {
    const zone = zones.find((z) => z.id === zoneId);
    if (zone) {
      const clamped = clampRackInsideZone({ x, y, width, height, zoneId }, zone, width, height);
      x = clamped.x;
      y = clamped.y;
    }
  }

  const position = normaliseRackPosition(
    {
      x,
      y,
      width,
      height,
      rotation: input.rotation ?? existing?.position?.rotation ?? 0,
      zoneId,
      isPlaced: true,
    },
    coordinateWidth,
    coordinateHeight
  );

  validateRackInsideZone(position, zones, rule);
  return position;
}

async function assertActiveRack(rackId) {
  const rack = await Location.findById(rackId).lean();
  if (!rack || !rack.isActive) {
    throw new Error('Rack not found');
  }
  if (rack.level !== 'rack') {
    throw new Error('Position updates apply to rack locations only');
  }
  if (LEGACY_LOCATION_LEVELS.includes(rack.level)) {
    throw new Error('Legacy locations cannot be placed on the locator');
  }
  return rack;
}

/**
 * All active racks under a floor with stock summary and canvas position.
 */
export async function getFloorLayout(floorId) {
  const floor = await Location.findById(floorId).lean();
  if (!floor || floor.level !== 'floor' || !floor.isActive) {
    throw new Error('Floor not found');
  }

  const allLocs = await listAllLocations();
  const byId = new Map(allLocs.map((l) => [String(l._id), l]));
  const branch = floor.parentLocationId ? byId.get(String(floor.parentLocationId)) : null;

  const layoutDoc = await getOrCreateFloorLayout(
    floorId,
    branch?._id || floor.parentLocationId,
    null
  );
  const { coordinateWidth, coordinateHeight } = getCanvasDimensions(layoutDoc);

  const cascadeRacks = await listCascadeRacks(floorId);
  const rackIds = cascadeRacks.map((r) => r._id);

  const [rackDocs, stocks] = await Promise.all([
    rackIds.length
      ? Location.find({ _id: { $in: rackIds }, level: 'rack', isActive: true }).lean()
      : [],
    rackIds.length
      ? Stock.find({
          locationId: { $in: rackIds },
          qty: { $gt: 0 },
          statusBucket: 'sellable',
        }).lean()
      : [],
  ]);

  const rackDocById = new Map(rackDocs.map((r) => [String(r._id), r]));
  const stockByRack = new Map();
  for (const row of stocks) {
    const rid = String(row.locationId);
    if (!stockByRack.has(rid)) stockByRack.set(rid, []);
    stockByRack.get(rid).push(row);
  }

  const placed = [];
  const unplaced = [];

  for (const rack of cascadeRacks) {
    const doc = rackDocById.get(String(rack._id));
    if (!doc) continue;

    const stockAgg = aggregateRackStock(stockByRack.get(String(rack._id)) || []);
    const dto = buildRackDto(
      rack,
      doc,
      stockAgg,
      byId,
      coordinateWidth,
      coordinateHeight
    );

    if (dto.position?.zoneId && dto.position.x != null) placed.push(dto);
    else unplaced.push(dto);
  }

  const allRacks = [...placed, ...unplaced];
  const totalQty = allRacks.reduce((sum, r) => sum + (r.totalQty || 0), 0);
  const totalProductCount = allRacks.reduce((sum, r) => sum + (r.productCount || 0), 0);

  const zoneSummaryList = buildZoneSummariesDetailed(layoutDoc.zones, placed, stockByRack);
  const zoneSummariesById = new Map(zoneSummaryList.map((s) => [s.zoneId, s]));

  return {
    floor: {
      _id: String(floor._id),
      code: floor.code,
      name: floor.name || '',
      displayPath: formatBranchFloorRackPath(String(floor._id), byId),
    },
    branch: branch
      ? { _id: String(branch._id), code: branch.code, name: branch.name || '' }
      : null,
    layout: serializeLayoutDoc(layoutDoc, zoneSummariesById),
    zoneSummaries: zoneSummaryList.map((s) => ({
      zoneId: s.zoneId,
      name: s.name,
      ...s.summary,
      emptyRackCount: s.summary.rackStatusCounts?.empty ?? 0,
      stockedRackCount: s.summary.rackStatusCounts?.hasStock ?? 0,
    })),
    racks: placed,
    unplacedRacks: unplaced,
    summary: {
      rackCount: allRacks.length,
      placedRackCount: placed.length,
      unplacedRackCount: unplaced.length,
      zoneCount: (layoutDoc.zones || []).length,
      totalQty,
      totalProductCount,
    },
  };
}

async function assertActiveFloor(floorId) {
  const floor = await Location.findById(floorId).lean();
  if (!floor || floor.level !== 'floor' || !floor.isActive) {
    throw new Error('Floor not found');
  }
  return floor;
}

async function resolveFloorForRack(rackId) {
  const allLocs = await listAllLocations();
  const byId = new Map(allLocs.map((l) => [String(l._id), l]));
  let current = byId.get(String(rackId));
  if (!current) throw new Error('Rack not found');

  const seen = new Set();
  while (current) {
    if (seen.has(String(current._id))) break;
    seen.add(String(current._id));
    if (current.level === 'floor') return current;
    const parentId = current.parentLocationId;
    current = parentId ? byId.get(String(parentId)) : null;
  }
  throw new Error('Could not resolve floor for rack');
}

async function getLayoutDocForRack(rackId) {
  const floor = await resolveFloorForRack(rackId);
  const allLocs = await listAllLocations();
  const byId = new Map(allLocs.map((l) => [String(l._id), l]));
  const branch = floor.parentLocationId ? byId.get(String(floor.parentLocationId)) : null;
  const layoutDoc = await getOrCreateFloorLayout(
    floor._id,
    branch?._id || floor.parentLocationId,
    null
  );
  return { floor, layoutDoc };
}

export async function updateRackPosition(rackId, payload, user = null, request = null) {
  const rack = await assertActiveRack(rackId);
  const { layoutDoc } = await getLayoutDocForRack(rackId);
  const { coordinateWidth, coordinateHeight } = getCanvasDimensions(layoutDoc);

  const position = buildPositionPayload(payload, rack, layoutDoc);

  const updated = await Location.findByIdAndUpdate(
    rackId,
    { $set: { position } },
    { new: true }
  ).lean();

  await logAudit({
    actorId: user?.userId,
    actorRole: user?.role,
    action: 'locator.rack_moved',
    entityType: 'Location',
    entityId: rackId,
    before: rack.position,
    after: position,
    metadata: { floorId: String((await resolveFloorForRack(rackId))._id) },
    request,
  });

  return {
    _id: String(updated._id),
    position: normalizePosition(updated.position, coordinateWidth, coordinateHeight),
  };
}

export async function bulkUpdateRackPositions(positions, user = null, request = null) {
  const ids = positions.map((p) => p.id);
  const racks = await Location.find({ _id: { $in: ids }, level: 'rack', isActive: true }).lean();
  const rackById = new Map(racks.map((r) => [String(r._id), r]));

  if (racks.length !== positions.length) {
    throw new Error('One or more rack ids are invalid');
  }

  const floorIds = new Set();
  const layoutByFloor = new Map();

  for (const rack of racks) {
    const floor = await resolveFloorForRack(rack._id);
    floorIds.add(String(floor._id));
    if (floorIds.size > 1) {
      throw new Error('Bulk position updates must be on the same floor');
    }
    if (!layoutByFloor.has(String(floor._id))) {
      const allLocs = await listAllLocations();
      const byId = new Map(allLocs.map((l) => [String(l._id), l]));
      const branch = floor.parentLocationId ? byId.get(String(floor.parentLocationId)) : null;
      const layoutDoc = await getOrCreateFloorLayout(
        floor._id,
        branch?._id || floor.parentLocationId,
        null
      );
      layoutByFloor.set(String(floor._id), layoutDoc);
    }
  }

  const floorId = [...floorIds][0];
  const layoutDoc = layoutByFloor.get(floorId);
  const { coordinateWidth, coordinateHeight } = getCanvasDimensions(layoutDoc);

  const ops = positions.map((p) => {
    const existing = rackById.get(String(p.id));
    const position = buildPositionPayload(p, existing, layoutDoc);
    return {
      updateOne: {
        filter: { _id: p.id },
        update: { $set: { position } },
      },
    };
  });

  await Location.bulkWrite(ops);

  await logAudit({
    actorId: user?.userId,
    actorRole: user?.role,
    action: 'locator.rack_bulk_moved',
    entityType: 'FloorLayout',
    entityId: floorId,
    metadata: { rackCount: positions.length },
    request,
  });

  return {
    updated: positions.map((p) => {
      const existing = rackById.get(String(p.id));
      const position = buildPositionPayload(p, existing, layoutDoc);
      return {
        _id: p.id,
        position: normalizePosition(position, coordinateWidth, coordinateHeight),
      };
    }),
  };
}

export async function updateFloorLayout(floorId, payload, user = null, request = null) {
  const floor = await assertActiveFloor(floorId);
  const allLocs = await listAllLocations();
  const byId = new Map(allLocs.map((l) => [String(l._id), l]));
  const branch = floor.parentLocationId ? byId.get(String(floor.parentLocationId)) : null;

  const existing = await FloorLayout.findOne({ floorId }).lean();
  if (!existing) {
    await getOrCreateFloorLayout(floorId, branch?._id || floor.parentLocationId, user?.userId);
  }

  const doc = await FloorLayout.findOne({ floorId });
  if (!doc) throw new Error('Floor layout not found');

  if (payload.expectedVersion != null && doc.version !== payload.expectedVersion) {
    const err = new Error('Layout version conflict');
    err.code = 'LAYOUT_CONFLICT';
    err.currentVersion = doc.version;
    throw err;
  }

  const before = doc.toObject();

  if (payload.canvas) {
    doc.canvas = { ...doc.canvas.toObject?.() || doc.canvas, ...payload.canvas };
  }

  if (payload.backgroundImage) {
    doc.backgroundImage = {
      ...doc.backgroundImage.toObject?.() || doc.backgroundImage,
      ...payload.backgroundImage,
    };
  }

  const { coordinateWidth, coordinateHeight } = getCanvasDimensions(doc);

  if (payload.zones) {
    validateZoneNamesUnique(payload.zones);
    const zones = normaliseZones(payload.zones, coordinateWidth, coordinateHeight);
    validateZoneBounds(zones, coordinateWidth, coordinateHeight);
    doc.zones = zones;
  }

  doc.version = (doc.version || 1) + 1;
  doc.status = 'draft';
  if (user?.userId) doc.updatedBy = user.userId;
  await doc.save();

  await logAudit({
    actorId: user?.userId,
    actorRole: user?.role,
    action: 'locator.layout_updated',
    entityType: 'FloorLayout',
    entityId: String(doc._id),
    before: { version: before.version, zones: before.zones?.length },
    after: { version: doc.version, zones: doc.zones?.length },
    metadata: { floorId: String(floorId) },
    request,
  });

  return serializeLayoutDoc(doc.toObject());
}

function scalePosition(position, scaleX, scaleY, coordinateWidth, coordinateHeight) {
  if (!position || position.x == null) return null;
  const scaled = {
    ...position,
    x: position.x * scaleX,
    y: position.y * scaleY,
    width: (position.width ?? DEFAULT_RACK_WIDTH) * scaleX,
    height: (position.height ?? DEFAULT_RACK_HEIGHT) * scaleY,
  };
  return normaliseRackPosition(scaled, coordinateWidth, coordinateHeight);
}

export async function uploadFloorPlanBackground(
  floorId,
  { file, buffer, repositionMode = 'keep_proportional' },
  user = null,
  request = null
) {
  const floor = await assertActiveFloor(floorId);
  const allLocs = await listAllLocations();
  const byId = new Map(allLocs.map((l) => [String(l._id), l]));
  const branch = floor.parentLocationId ? byId.get(String(floor.parentLocationId)) : null;

  let doc = await FloorLayout.findOne({ floorId });
  if (!doc) {
    await getOrCreateFloorLayout(floorId, branch?._id || floor.parentLocationId, user?.userId);
    doc = await FloorLayout.findOne({ floorId });
  }

  const oldBg = doc.backgroundImage?.url ? { ...doc.backgroundImage.toObject?.() || doc.backgroundImage } : null;
  const oldDims = getCanvasDimensions(doc);

  const uploaded = await uploadFloorPlanImage({ floorId, file, buffer });

  if (oldBg?.url) {
    await removeFloorPlanFromStorage(oldBg);
  }

  doc.backgroundImage = uploaded;
  doc.canvas.coordinateWidth = uploaded.originalWidth;
  doc.canvas.coordinateHeight = uploaded.originalHeight;

  if (repositionMode === 'keep_proportional' && oldDims.coordinateWidth && oldDims.coordinateHeight) {
    const scaleX = uploaded.originalWidth / oldDims.coordinateWidth;
    const scaleY = uploaded.originalHeight / oldDims.coordinateHeight;

    doc.zones = normaliseZones(
      (doc.zones || []).map((z) => ({
        ...z.toObject?.() || z,
        x: z.x * scaleX,
        y: z.y * scaleY,
        width: z.width * scaleX,
        height: z.height * scaleY,
      })),
      uploaded.originalWidth,
      uploaded.originalHeight
    );

    const cascadeRacks = await listCascadeRacks(floorId);
    const rackIds = cascadeRacks.map((r) => r._id);
    const rackDocs = rackIds.length
      ? await Location.find({ _id: { $in: rackIds }, level: 'rack', isActive: true }).lean()
      : [];

    const ops = rackDocs
      .filter((r) => r.position?.x != null)
      .map((r) => ({
        updateOne: {
          filter: { _id: r._id },
          update: {
            $set: {
              position: scalePosition(
                r.position,
                scaleX,
                scaleY,
                uploaded.originalWidth,
                uploaded.originalHeight
              ),
            },
          },
        },
      }));

    if (ops.length) await Location.bulkWrite(ops);
  } else if (repositionMode === 'reset') {
    doc.zones = [];
    const cascadeRacks = await listCascadeRacks(floorId);
    const rackIds = cascadeRacks.map((r) => r._id);
    if (rackIds.length) {
      await Location.updateMany(
        { _id: { $in: rackIds }, level: 'rack' },
        { $set: { position: null } }
      );
    }
  }

  doc.version = (doc.version || 1) + 1;
  doc.status = 'draft';
  if (user?.userId) doc.updatedBy = user.userId;
  await doc.save();

  await logAudit({
    actorId: user?.userId,
    actorRole: user?.role,
    action: oldBg ? 'locator.background_replaced' : 'locator.background_uploaded',
    entityType: 'FloorLayout',
    entityId: String(doc._id),
    before: oldBg,
    after: uploaded,
    metadata: { floorId: String(floorId), repositionMode },
    request,
  });

  return serializeLayoutDoc(doc.toObject());
}

export async function removeFloorPlanBackground(floorId, user = null, request = null) {
  const floor = await assertActiveFloor(floorId);
  const doc = await FloorLayout.findOne({ floorId });
  if (!doc) throw new Error('Floor layout not found');

  const oldBg = doc.backgroundImage?.url ? { ...doc.backgroundImage.toObject?.() || doc.backgroundImage } : null;
  if (!oldBg?.url) {
    return serializeLayoutDoc(doc.toObject());
  }

  await removeFloorPlanFromStorage(oldBg);

  doc.backgroundImage = {
    url: null,
    storageKey: null,
    originalWidth: null,
    originalHeight: null,
    aspectRatio: null,
    opacity: 1,
    visible: true,
    locked: true,
  };
  doc.version = (doc.version || 1) + 1;
  doc.status = 'draft';
  if (user?.userId) doc.updatedBy = user.userId;
  await doc.save();

  await logAudit({
    actorId: user?.userId,
    actorRole: user?.role,
    action: 'locator.background_removed',
    entityType: 'FloorLayout',
    entityId: String(doc._id),
    before: oldBg,
    after: null,
    metadata: { floorId: String(floor._id) },
    request,
  });

  return serializeLayoutDoc(doc.toObject());
}

export async function publishFloorLayout(floorId, user = null, request = null) {
  await assertActiveFloor(floorId);
  const doc = await FloorLayout.findOne({ floorId });
  if (!doc) throw new Error('Floor layout not found');

  const before = { status: doc.status, version: doc.version };
  doc.status = 'published';
  doc.publishedAt = new Date();
  if (user?.userId) {
    doc.publishedBy = user.userId;
    doc.updatedBy = user.userId;
  }
  await doc.save();

  await logAudit({
    actorId: user?.userId,
    actorRole: user?.role,
    action: 'locator.layout_published',
    entityType: 'FloorLayout',
    entityId: String(doc._id),
    before,
    after: { status: doc.status, version: doc.version },
    metadata: { floorId: String(floorId) },
    request,
  });

  return serializeLayoutDoc(doc.toObject());
}

/**
 * Rack detail for locator drawer — items at rack + last ledger movement.
 */
export async function getRackLocatorDetail(rackId) {
  const rack = await assertActiveRack(rackId);
  const allLocs = await listAllLocations();
  const byId = new Map(allLocs.map((l) => [String(l._id), l]));

  const stocks = await Stock.find({
    locationId: rackId,
    qty: { $gt: 0 },
    statusBucket: 'sellable',
  }).lean();
  const productIds = [...new Set(stocks.map((s) => String(s.productId)))];

  const [products, rules] = await Promise.all([
    productIds.length
      ? Product.find({ _id: { $in: productIds }, deletedAt: null })
          .select('title sku stockUnit')
          .lean()
      : [],
    productIds.length
      ? InventoryRule.find({ productId: { $in: productIds } })
          .select('productId deadStockMarked')
          .lean()
      : [],
  ]);
  const productById = new Map(products.map((p) => [String(p._id), p]));
  const deadMarkedByProduct = new Map(
    rules.map((r) => [String(r.productId), Boolean(r.deadStockMarked)])
  );

  /**
   * Merge ledger rows per product — on-hand only.
   * Dead stock is the product TAG, not a separate line.
   */
  const qtyByProduct = new Map();
  for (const row of stocks) {
    const pid = String(row.productId);
    qtyByProduct.set(pid, (qtyByProduct.get(pid) || 0) + (row.qty || 0));
  }

  const items = [...qtyByProduct.entries()]
    .map(([productId, qty]) => {
      const product = productById.get(productId);
      if (!product) return null;
      return {
        productId,
        title: product.title,
        sku: product.sku || '',
        stockUnit: product.stockUnit || 'Pcs',
        qty,
        isDeadStock: deadMarkedByProduct.get(productId) || false,
        statusBucket: 'sellable',
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.title.localeCompare(b.title));

  const lastLedger = await StockLedger.findOne({ locationId: rackId })
    .sort({ createdAt: -1 })
    .populate('productId', 'title sku')
    .populate('performedBy', 'name email')
    .lean();

  const stockAgg = aggregateRackStock(stocks);
  const stockPresence = deriveRackStockPresence(stockAgg);

  return {
    rack: {
      _id: String(rack._id),
      code: rack.code,
      name: rack.name || '',
      displayPath: formatBranchFloorRackPath(String(rack._id), byId),
      displayPathShort: formatBranchFloorRackPathCodesWithRackName(String(rack._id), byId),
      ...stockAgg,
      hasStock: stockPresence === 'has_stock',
      stockPresence,
      stockStatus: stockPresence,
    },
    items,
    lastMovement: lastLedger
      ? {
          _id: String(lastLedger._id),
          type: lastLedger.type,
          qty: lastLedger.qty,
          statusBucket: lastLedger.statusBucket,
          reason: lastLedger.reason || '',
          remark: lastLedger.remark || '',
          createdAt: lastLedger.createdAt,
          productTitle: lastLedger.productId?.title || '—',
          productSku: lastLedger.productId?.sku || '',
          performedByName: lastLedger.performedBy?.name || lastLedger.performedBy?.email || '—',
        }
      : null,
  };
}
