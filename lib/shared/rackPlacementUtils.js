/** Rack slot packing inside a zone — shared client + server. */

export const DEFAULT_RACK_PACK_PADDING = 12;
export const DEFAULT_RACK_PACK_GAP_X = 16;
export const DEFAULT_RACK_PACK_GAP_Y = 16;

export function rectsOverlap(a, b) {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

export function clampRackInsideZone(position, zone, rackWidth, rackHeight) {
  const width = position.width ?? rackWidth;
  const height = position.height ?? rackHeight;
  const x = Math.max(zone.x, Math.min(position.x, zone.x + zone.width - width));
  const y = Math.max(zone.y, Math.min(position.y, zone.y + zone.height - height));
  return { ...position, x, y, width, height, zoneId: zone.id };
}

/**
 * Fallback placement when the zone has no free visual slot.
 * Racks in zones are counted in the zone label, not drawn on the canvas.
 */
export function defaultRackPlacementInZone(zone, rackSize, index = 0) {
  const width = rackSize.width ?? 120;
  const height = rackSize.height ?? 80;
  const padding = DEFAULT_RACK_PACK_PADDING;
  return {
    x: zone.x + padding,
    y: zone.y + padding + index * 2,
    width,
    height,
  };
}

/**
 * Prefer a non-overlapping slot; fall back to default so assignment is never blocked.
 */
export function resolveRackPlacementInZone(zone, existingRacks, rackSize, index = 0, options = {}) {
  return (
    findNextRackPlacement(zone, existingRacks, rackSize, options) ||
    defaultRackPlacementInZone(zone, rackSize, index)
  );
}

/**
 * Find next non-overlapping slot inside a zone for a rack.
 * @returns {{ x, y, width, height } | null}
 */
export function findNextRackPlacement(zone, existingRacks, rackSize, options = {}) {
  const padding = options.padding ?? DEFAULT_RACK_PACK_PADDING;
  const gapX = options.gapX ?? DEFAULT_RACK_PACK_GAP_X;
  const gapY = options.gapY ?? DEFAULT_RACK_PACK_GAP_Y;
  const width = rackSize.width ?? 120;
  const height = rackSize.height ?? 80;

  const occupied = (existingRacks || [])
    .filter((r) => r.position?.zoneId === zone.id && r.position?.x != null)
    .map((r) => ({
      x: r.position.x,
      y: r.position.y,
      width: r.position.width ?? width,
      height: r.position.height ?? height,
    }));

  let y = zone.y + padding;
  while (y + height <= zone.y + zone.height - padding) {
    let x = zone.x + padding;
    while (x + width <= zone.x + zone.width - padding) {
      const candidate = { x, y, width, height };
      const overlaps = occupied.some((o) => rectsOverlap(candidate, o));
      if (!overlaps) return candidate;
      x += width + gapX;
    }
    y += height + gapY;
  }
  return null;
}
