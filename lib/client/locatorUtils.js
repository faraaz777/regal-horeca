/** Rack status colors aligned with /admin/inventory stock badges. */

export const RACK_STATUS_STYLES = {
  in_stock: {
    fill: 'bg-emerald-500',
    border: 'border-emerald-600',
    text: 'text-emerald-950',
    label: 'In stock',
  },
  low: {
    fill: 'bg-amber-400',
    border: 'border-amber-600',
    text: 'text-amber-950',
    label: 'Low',
  },
  out: {
    fill: 'bg-gray-300',
    border: 'border-gray-400',
    text: 'text-gray-700',
    label: 'Empty',
  },
  hold: {
    fill: 'bg-orange-400',
    border: 'border-orange-600',
    text: 'text-orange-950',
    label: 'Hold',
  },
  scrap: {
    fill: 'bg-red-400',
    border: 'border-red-600',
    text: 'text-red-950',
    label: 'Scrap',
  },
};

export function getRackStatusStyle(stockStatus) {
  return RACK_STATUS_STYLES[stockStatus] || RACK_STATUS_STYLES.out;
}

/**
 * Heatmap intensity 0–1.
 * Uses true fill % (qty ÷ capacity) when the rack has a capacity;
 * otherwise falls back to relative total qty on the floor.
 */
export function getHeatmapIntensity(rackOrQty, maxTotalQty) {
  if (rackOrQty && typeof rackOrQty === 'object') {
    const { fillPct, totalQty } = rackOrQty;
    if (fillPct != null) return Math.min(1, Math.max(0, fillPct));
    if (!maxTotalQty || maxTotalQty <= 0) return 0;
    return Math.min(1, Math.max(0, (totalQty || 0) / maxTotalQty));
  }
  if (!maxTotalQty || maxTotalQty <= 0) return 0;
  return Math.min(1, Math.max(0, (rackOrQty || 0) / maxTotalQty));
}

export function heatmapFillClass(intensity) {
  if (intensity <= 0) return 'bg-slate-200';
  if (intensity < 0.25) return 'bg-sky-200';
  if (intensity < 0.5) return 'bg-sky-400';
  if (intensity < 0.75) return 'bg-blue-500';
  return 'bg-indigo-700';
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
