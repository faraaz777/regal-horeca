'use client';

import { memo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  DEFAULT_RACK_HEIGHT,
  DEFAULT_RACK_WIDTH,
  getRackPresenceStyle,
} from '@/lib/client/locatorUtils';

/**
 * Locator rack tile — reference-style box with centered code.
 * Pale blue = stock · grey = empty · amber = find · solid blue = selected.
 * displayPosition overrides layout for zone auto-grid (display only).
 */
function RackUnit({
  rack,
  selected,
  editMode,
  highlighted,
  dimmed,
  displayPosition,
  onSelect,
}) {
  const stored = rack.position || {};
  const pos = displayPosition || {
    x: stored.x ?? 0,
    y: stored.y ?? 0,
    width: stored.width || DEFAULT_RACK_WIDTH,
    height: stored.height || DEFAULT_RACK_HEIGHT,
  };

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: rack._id,
    disabled: !editMode,
    data: { type: 'placed', rack },
  });

  const presence = getRackPresenceStyle(rack);
  const qty = Number(rack.sellableQty ?? rack.totalQty) || 0;
  const skus = Number(rack.productCount ?? rack.distinctProductCount) || 0;
  const titleBits = [
    rack.code,
    rack.name && rack.name !== rack.code ? rack.name : null,
    qty > 0 ? `${skus} SKU · ${qty.toLocaleString()} pcs` : 'Empty',
  ].filter(Boolean);

  let fill = presence.fill;
  let border = presence.border;
  let text = presence.text;
  let extra = '';

  if (selected) {
    fill = 'bg-sky-600';
    border = 'border-sky-700';
    text = 'text-white';
    extra = 'shadow-md';
  } else if (highlighted) {
    fill = 'bg-amber-100';
    border = 'border-amber-300';
    text = 'text-amber-800';
    extra = 'shadow-sm';
  }

  const style = {
    position: 'absolute',
    left: pos.x,
    top: pos.y,
    width: pos.width || DEFAULT_RACK_WIDTH,
    height: pos.height || DEFAULT_RACK_HEIGHT,
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    zIndex: isDragging || selected || highlighted ? 30 : 10,
    pointerEvents: 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      title={titleBits.join(' · ')}
      className={`rack-unit ${editMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(rack._id, e);
      }}
      {...(editMode ? { ...listeners, ...attributes } : {})}
    >
      <div
        className={`relative h-full w-full rounded-xl border flex items-center justify-center px-0.5 text-center transition-all duration-150 ${fill} ${border} ${text} ${extra} ${dimmed ? 'opacity-35' : ''} ${isDragging ? 'opacity-80 shadow-lg' : ''}`}
      >
        <span className="text-[11px] font-semibold leading-none truncate w-full px-0.5">
          {rack.code}
        </span>
      </div>
    </div>
  );
}

export default memo(RackUnit);
