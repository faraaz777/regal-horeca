/**
 * Locator visual helpers — facts only (presence + counts), not fill % / capacity.
 */

/**
 * Reference-style tiles:
 * pale blue = has stock · light grey = empty
 * (find = amber, selected = solid blue — applied in RackUnit)
 */
export const RACK_PRESENCE_STYLES = {
  has_stock: {
    fill: 'bg-sky-100',
    border: 'border-sky-200',
    text: 'text-sky-800',
    label: 'Has stock',
  },
  empty: {
    fill: 'bg-gray-100',
    border: 'border-gray-200',
    text: 'text-gray-400',
    label: 'Empty',
  },
};

/** @deprecated Use RACK_PRESENCE_STYLES — kept as alias for any stray imports. */
export const RACK_STATUS_STYLES = RACK_PRESENCE_STYLES;

/**
 * Map rack DTO to presence style.
 * Ignores planning stockStatus (in_stock/low) — locator is not purchasing intelligence.
 */
export function getRackPresenceStyle(rackOrPresence) {
  if (rackOrPresence && typeof rackOrPresence === 'object') {
    const qty = Number(rackOrPresence.sellableQty ?? rackOrPresence.totalQty) || 0;
    const key =
      rackOrPresence.stockPresence ||
      (qty > 0 || rackOrPresence.hasStock ? 'has_stock' : 'empty');
    return RACK_PRESENCE_STYLES[key] || RACK_PRESENCE_STYLES.empty;
  }
  const key = rackOrPresence === 'has_stock' || rackOrPresence === 'in_stock' ? 'has_stock' : 'empty';
  return RACK_PRESENCE_STYLES[key] || RACK_PRESENCE_STYLES.empty;
}

/** @deprecated Use getRackPresenceStyle */
export function getRackStatusStyle(stockStatusOrRack) {
  if (stockStatusOrRack && typeof stockStatusOrRack === 'object') {
    return getRackPresenceStyle(stockStatusOrRack);
  }
  if (stockStatusOrRack === 'in_stock' || stockStatusOrRack === 'low' || stockStatusOrRack === 'has_stock') {
    return RACK_PRESENCE_STYLES.has_stock;
  }
  return RACK_PRESENCE_STYLES.empty;
}

export const DEFAULT_RACK_WIDTH = 120;
export const DEFAULT_RACK_HEIGHT = 80;

export function racksIntersectMarquee(rack, marquee) {
  const pos = rack.position;
  if (!pos) return false;
  const rx2 = pos.x + (pos.width || DEFAULT_RACK_WIDTH);
  const ry2 = pos.y + (pos.height || DEFAULT_RACK_HEIGHT);
  const mx2 = marquee.x + marquee.width;
  const my2 = marquee.y + marquee.height;
  return !(pos.x > mx2 || rx2 < marquee.x || pos.y > my2 || ry2 < marquee.y);
}

/**
 * Pack zone-assigned racks into a neat code-sorted grid inside the zone box
 * (reference ZONE A / ZONE B look). Returns canvas-absolute cells — display only;
 * does not write Location.position.
 *
 * @returns {Map<string, { x: number, y: number, width: number, height: number }>}
 */
export function layoutZoneRackGrid(zone, racks, options = {}) {
  const padding = options.padding ?? 8;
  const gutter = options.gutter ?? 6;
  const labelReserve = options.labelReserve ?? 20;
  const minCellW = options.minCellW ?? 28;
  const minCellH = options.minCellH ?? 24;

  const sorted = [...(racks || [])].sort((a, b) =>
    String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true })
  );
  const n = sorted.length;
  if (!n || !zone) return new Map();

  const usableW = Math.max(minCellW, (Number(zone.width) || 0) - padding * 2);
  const usableH = Math.max(minCellH, (Number(zone.height) || 0) - padding * 2 - labelReserve);

  let bestCols = 1;
  let bestScore = -1;
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const cellW = (usableW - gutter * (cols - 1)) / cols;
    const cellH = (usableH - gutter * (rows - 1)) / rows;
    if (cellW < minCellW || cellH < minCellH) continue;
    // Prefer larger cells that stay roughly square
    const aspect = Math.min(cellW / cellH, cellH / cellW);
    const score = Math.min(cellW, cellH) * aspect;
    if (score > bestScore) {
      bestScore = score;
      bestCols = cols;
    }
  }

  const cols = bestCols;
  const rows = Math.ceil(n / cols);
  const cellW = (usableW - gutter * (cols - 1)) / cols;
  const cellH = (usableH - gutter * (rows - 1)) / rows;

  const map = new Map();
  sorted.forEach((rack, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    map.set(String(rack._id), {
      x: Number(zone.x) + padding + col * (cellW + gutter),
      y: Number(zone.y) + padding + labelReserve + row * (cellH + gutter),
      width: cellW,
      height: cellH,
    });
  });
  return map;
}

/**
 * Build display positions for every zone-assigned rack on the floor.
 * Unzoned racks are omitted — use saved position for those.
 */
export function buildZoneRackDisplayPositions(zones, racks) {
  const byZone = new Map();
  for (const rack of racks || []) {
    const zoneId = rack.position?.zoneId;
    if (!zoneId) continue;
    if (!byZone.has(zoneId)) byZone.set(zoneId, []);
    byZone.get(zoneId).push(rack);
  }

  const result = new Map();
  for (const zone of zones || []) {
    const zoneRacks = byZone.get(zone.id) || [];
    if (!zoneRacks.length) continue;
    const layout = layoutZoneRackGrid(zone, zoneRacks);
    for (const [id, pos] of layout) {
      result.set(id, pos);
    }
  }
  return result;
}
