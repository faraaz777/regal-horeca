'use client';

import { memo, useCallback, useRef } from 'react';
import { zoneLabel } from '@/lib/client/zoneUtils';

/**
 * Zone chrome only — border + label. Racks are drawn as boxes on the canvas
 * (auto-grid), not via hover popups.
 */
function ZoneUnit({
  zone,
  selected,
  editMode,
  activeTool,
  summary,
  zoom,
  onSelect,
  onInteractionStart,
  onChange,
  onChangeEnd,
  dimmed,
  highlighted,
}) {
  const latestRef = useRef(zone);
  latestRef.current = zone;
  const dragMoved = useRef(false);
  const historyPushed = useRef(false);

  const canEditZone = editMode && activeTool === 'select' && !zone.locked;
  const rackCount = summary?.rackCount ?? 0;

  const handleMouseDown = useCallback(
    (e) => {
      if (!canEditZone) return;
      // Let rack tiles receive clicks; only drag from empty zone chrome
      if (e.target.closest?.('.rack-unit')) return;
      e.stopPropagation();
      dragMoved.current = false;
      historyPushed.current = false;

      const startX = e.clientX;
      const startY = e.clientY;
      const origin = { x: zone.x, y: zone.y };

      const onMove = (ev) => {
        const dx = (ev.clientX - startX) / zoom;
        const dy = (ev.clientY - startY) / zoom;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
          if (!historyPushed.current) {
            historyPushed.current = true;
            onInteractionStart?.();
          }
          dragMoved.current = true;
        }
        const next = { ...zone, x: Math.max(0, origin.x + dx), y: Math.max(0, origin.y + dy) };
        latestRef.current = next;
        onChange?.(next);
      };

      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        if (dragMoved.current) onChangeEnd?.(latestRef.current);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [canEditZone, onChange, onChangeEnd, onInteractionStart, zone, zoom]
  );

  const handleResizeMouseDown = useCallback(
    (e) => {
      if (!canEditZone) return;
      e.stopPropagation();
      historyPushed.current = false;
      const startX = e.clientX;
      const startY = e.clientY;
      const origin = { width: zone.width, height: zone.height };

      const onMove = (ev) => {
        const dw = (ev.clientX - startX) / zoom;
        const dh = (ev.clientY - startY) / zoom;
        if (!historyPushed.current) {
          historyPushed.current = true;
          onInteractionStart?.();
        }
        const next = {
          ...zone,
          width: Math.max(40, origin.width + dw),
          height: Math.max(40, origin.height + dh),
        };
        latestRef.current = next;
        onChange?.(next);
      };

      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        onChangeEnd?.(latestRef.current);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [canEditZone, onChange, onChangeEnd, onInteractionStart, zone, zoom]
  );

  const handleClick = useCallback(
    (e) => {
      if (e.target.closest?.('.rack-unit')) return;
      e.stopPropagation();
      if (dragMoved.current) return;
      onSelect?.(zone.id);
    },
    [onSelect, zone.id]
  );

  if (zone.hidden) return null;

  const label = zoneLabel(zone, rackCount);

  return (
    <div
      className={`absolute zone-unit ${canEditZone ? 'cursor-move' : 'cursor-pointer'} ${dimmed ? 'opacity-40' : ''}`}
      style={{
        left: zone.x,
        top: zone.y,
        width: zone.width,
        height: zone.height,
        zIndex: highlighted || selected ? 8 : zone.zIndex ?? 2,
        // Racks sit above (z≥10); empty chrome / label area still receives zone clicks
        pointerEvents: 'auto',
      }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      {/*
        Light zone frame only — racks paint as sibling boxes above this chrome.
        pointer-events-none so View-mode clicks reach rack tiles underneath/through.
      */}
      <div
        className={`absolute inset-0 rounded-lg border pointer-events-none transition-all duration-150 ${
          selected ? 'ring-2 ring-blue-500 ring-offset-1' : ''
        } ${highlighted ? 'ring-2 ring-sky-500 ring-offset-1' : ''}`}
        style={{
          backgroundColor: 'transparent',
          borderColor: zone.stroke || 'rgba(148, 163, 184, 0.7)',
        }}
      />

      <div className="absolute top-1 left-1 max-w-[calc(100%-8px)] px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 pointer-events-none whitespace-nowrap overflow-hidden text-ellipsis">
        {label}
      </div>

      {selected && canEditZone && (
        <div
          className="absolute bottom-0 right-0 w-3 h-3 bg-blue-600 border border-white rounded-sm cursor-se-resize z-50"
          onMouseDown={handleResizeMouseDown}
        />
      )}
    </div>
  );
}

export default memo(ZoneUnit);
