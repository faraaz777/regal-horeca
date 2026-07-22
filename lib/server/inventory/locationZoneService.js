import 'server-only';

import {
  clampRectToCanvas,
  findContainingZoneId,
  normaliseRect,
  pointInRect,
  rectCentre,
} from '@/lib/shared/canvasCoordinates';
import {
  DEFAULT_COORDINATE_HEIGHT,
  DEFAULT_COORDINATE_WIDTH,
} from '@/lib/shared/floorLayoutConstants';

export function getCanvasDimensions(layoutDoc) {
  const canvas = layoutDoc?.canvas || {};
  return {
    coordinateWidth: canvas.coordinateWidth || DEFAULT_COORDINATE_WIDTH,
    coordinateHeight: canvas.coordinateHeight || DEFAULT_COORDINATE_HEIGHT,
  };
}

export function normaliseZones(zones, coordinateWidth, coordinateHeight) {
  return (zones || []).map((z) => {
    const rect = normaliseRect(
      clampRectToCanvas(
        {
          x: z.x,
          y: z.y,
          width: z.width,
          height: z.height,
          rotation: z.rotation ?? 0,
        },
        coordinateWidth,
        coordinateHeight
      ),
      coordinateWidth,
      coordinateHeight
    );
    return { ...z, ...rect };
  });
}

export function validateZoneNamesUnique(zones) {
  const seen = new Set();
  for (const z of zones || []) {
    const key = (z.name || '').trim().toLowerCase();
    if (!key) throw new Error('Zone name is required');
    if (seen.has(key)) throw new Error(`Duplicate zone name: ${z.name}`);
    seen.add(key);
  }
}

export function validateZoneBounds(zones, coordinateWidth, coordinateHeight) {
  for (const z of zones || []) {
    if (!Number.isFinite(z.x) || !Number.isFinite(z.y)) {
      throw new Error(`Invalid coordinates for zone ${z.name}`);
    }
    if (z.width <= 0 || z.height <= 0) {
      throw new Error(`Zone ${z.name} must have positive width and height`);
    }
    const clamped = clampRectToCanvas(z, coordinateWidth, coordinateHeight);
    if (clamped.x !== z.x || clamped.y !== z.y) {
      throw new Error(`Zone ${z.name} extends outside the canvas bounds`);
    }
  }
}

export function validateRackInsideZone(position, zones, rule) {
  if (rule === 'allow_unzoned') return;

  const centre = rectCentre(position);
  const zoneId = position.zoneId || findContainingZoneId(centre, zones);

  if (!zoneId) {
    throw new Error('Rack must be placed inside a zone');
  }

  const zone = zones.find((z) => z.id === zoneId);
  if (!zone) {
    throw new Error('Referenced zone does not exist on this floor');
  }

  if (!pointInRect(centre, zone)) {
    throw new Error('Rack centre must be inside the assigned zone');
  }
}

export function buildZoneSummaries(zones, racks, stockByRack = null) {
  return buildZoneSummariesDetailed(zones, racks, stockByRack).map((entry) => ({
    zoneId: entry.zoneId,
    name: entry.name,
    ...entry.summary,
    lowStockRackCount: entry.summary.rackStatusCounts?.low ?? 0,
    emptyRackCount: entry.summary.rackStatusCounts?.empty ?? 0,
    capacity: entry.summary.totalCapacity,
  }));
}

export function buildZoneSummariesDetailed(zones, racks, stockByRack = null) {
  return (zones || []).map((z) => {
    const inZone = (racks || []).filter((r) => r.position?.zoneId === z.id);
    const totalQty = inZone.reduce((sum, r) => sum + (r.totalQty || 0), 0);
    const totalCapacity = inZone.reduce((sum, r) => sum + (r.capacity || 0), 0);

    const rackStatusCounts = {
      inStock: 0,
      low: 0,
      out: 0,
      empty: 0,
    };

    /** sellable = physical qty in zone. */
    const stockStatusQty = { sellable: 0 };
    const productIds = new Set();

    for (const r of inZone) {
      const st = r.stockStatus || 'out';
      if (st === 'in_stock') rackStatusCounts.inStock += 1;
      else if (st === 'low') rackStatusCounts.low += 1;
      else if (st === 'out') rackStatusCounts.empty += 1;

      stockStatusQty.sellable += r.totalQty || r.sellableQty || 0;

      if (stockByRack) {
        const rows = stockByRack.get(String(r._id)) || [];
        for (const row of rows) {
          if (row.statusBucket === 'sold') continue;
          productIds.add(String(row.productId));
        }
      }
    }

    return {
      zoneId: z.id,
      name: z.name,
      summary: {
        rackCount: inZone.length,
        distinctProductCount: productIds.size,
        totalQty,
        totalCapacity: totalCapacity || null,
        utilisationPercent:
          totalCapacity > 0 ? Math.min(100, Math.round((totalQty / totalCapacity) * 100)) : null,
        rackStatusCounts,
        stockStatusQty,
      },
    };
  });
}

export function normaliseRackPosition(position, coordinateWidth, coordinateHeight) {
  if (!position || position.x == null || position.y == null) return null;

  const base = {
    x: position.x,
    y: position.y,
    width: position.width,
    height: position.height,
    rotation: position.rotation ?? 0,
    zoneId: position.zoneId ?? null,
    isPlaced: position.isPlaced !== false,
  };

  const withRatios = normaliseRect(base, coordinateWidth, coordinateHeight);
  return {
    ...base,
    xRatio: position.xRatio ?? withRatios.xRatio,
    yRatio: position.yRatio ?? withRatios.yRatio,
    widthRatio: position.widthRatio ?? withRatios.widthRatio,
    heightRatio: position.heightRatio ?? withRatios.heightRatio,
  };
}
