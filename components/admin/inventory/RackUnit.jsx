'use client';

import { memo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  DEFAULT_RACK_HEIGHT,
  DEFAULT_RACK_WIDTH,
  getHeatmapIntensity,
  getRackStatusStyle,
  heatmapFillClass,
} from '@/lib/client/locatorUtils';
import { formatRackDisplayName } from '@/lib/shared/locationDisplay';

function RackTooltip({ rack }) {
  return (
    <div className="pointer-events-none absolute left-1/2 bottom-full mb-2 -translate-x-1/2 z-50 hidden group-hover:block">
      <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg min-w-[160px] max-w-[240px]">
        <p className="font-mono font-semibold truncate">{formatRackDisplayName(rack)}</p>
        <p className="text-gray-300 mt-1">
          {rack.sellableQty > 0 && <span>{rack.sellableQty} Sellable</span>}
          {rack.holdQty > 0 && (
            <span>
              {rack.sellableQty > 0 ? ' · ' : ''}
              {rack.holdQty} Hold
            </span>
          )}
          {rack.scrapQty > 0 && (
            <span>
              {rack.sellableQty > 0 || rack.holdQty > 0 ? ' · ' : ''}
              {rack.scrapQty} Scrap
            </span>
          )}
          {rack.totalQty === 0 && <span>Empty</span>}
        </p>
      </div>
    </div>
  );
}

function RackUnit({
  rack,
  selected,
  editMode,
  heatmapMode,
  maxTotalQty,
  highlighted,
  onSelect,
}) {
  const pos = rack.position || { x: 0, y: 0, width: DEFAULT_RACK_WIDTH, height: DEFAULT_RACK_HEIGHT };
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: rack._id,
    disabled: !editMode,
    data: { type: 'placed', rack },
  });

  const statusStyle = getRackStatusStyle(rack.stockStatus);
  const heatIntensity = getHeatmapIntensity(rack, maxTotalQty);
  const fillClass = heatmapMode ? heatmapFillClass(heatIntensity) : statusStyle.fill;

  const style = {
    position: 'absolute',
    left: pos.x,
    top: pos.y,
    width: pos.width || DEFAULT_RACK_WIDTH,
    height: pos.height || DEFAULT_RACK_HEIGHT,
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    zIndex: isDragging || selected ? 30 : 10,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group rack-unit ${editMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
      onClick={(e) => onSelect?.(rack._id, e)}
      {...(editMode ? { ...listeners, ...attributes } : {})}
    >
      <div
        className={`relative h-full w-full rounded-lg border-2 shadow-sm flex flex-col items-center justify-center px-1 text-center transition-shadow ${fillClass} ${heatmapMode ? 'border-slate-400' : statusStyle.border} ${selected ? 'ring-2 ring-emerald-500 ring-offset-2' : ''} ${highlighted ? 'ring-2 ring-sky-500 ring-offset-2 animate-pulse' : ''} ${isDragging ? 'opacity-80 shadow-lg' : ''}`}
      >
        <RackTooltip rack={rack} />
        <span className={`text-[10px] font-bold leading-tight truncate w-full ${heatmapMode ? 'text-gray-900' : statusStyle.text}`}>
          {rack.code}
        </span>
        {rack.name ? (
          <span className="text-[9px] leading-tight truncate w-full text-gray-800/90">{rack.name}</span>
        ) : null}
        <span className="text-[9px] font-semibold mt-0.5 text-gray-800/80">{rack.sellableQty || 0}</span>
      </div>
    </div>
  );
}

export default memo(RackUnit);
