'use client';

import { memo, useCallback, useRef, useState, useEffect } from 'react';
import { zoneLabel } from '@/lib/client/zoneUtils';
import ZoneHoverSummary from '@/components/admin/inventory/locator/ZoneHoverSummary';

const HOVER_DELAY_MS = 200;

function ZoneUnit({
  zone,
  selected,
  editMode,
  activeTool,
  heatmapMode,
  summary,
  zoom,
  onSelect,
  onInteractionStart,
  onChange,
  onChangeEnd,
  dimmed,
  suppressHover,
}) {
  const latestRef = useRef(zone);
  latestRef.current = zone;
  const dragMoved = useRef(false);
  const historyPushed = useRef(false);
  const hoverTimer = useRef(null);
  const [hovered, setHovered] = useState(false);

  const canEditZone = editMode && activeTool === 'select' && !zone.locked;
  const rackCount = summary?.rackCount ?? 0;

  useEffect(() => {
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    };
  }, []);

  const handleMouseEnter = () => {
    if (suppressHover) return;
    hoverTimer.current = setTimeout(() => setHovered(true), HOVER_DELAY_MS);
  };

  const handleMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setHovered(false);
  };

  const handleMouseDown = useCallback(
    (e) => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      setHovered(false);
      if (!canEditZone) return;
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
      e.stopPropagation();
      if (dragMoved.current) return;
      onSelect?.(zone.id);
    },
    [onSelect, zone.id]
  );

  if (zone.hidden) return null;

  const label = zoneLabel(zone, rackCount);
  const fillOpacity = heatmapMode
    ? Math.min(0.45, (zone.opacity ?? 1) * 0.7)
    : hovered
      ? Math.min(1, (zone.opacity ?? 1) + 0.08)
      : zone.opacity ?? 1;

  return (
    <div
      className={`absolute zone-unit ${canEditZone ? 'cursor-move' : 'cursor-pointer'} ${dimmed ? 'opacity-40' : ''}`}
      style={{
        left: zone.x,
        top: zone.y,
        width: zone.width,
        height: zone.height,
        zIndex: selected ? 8 : zone.zIndex ?? 2,
      }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className={`absolute inset-0 rounded-md border-2 transition-all duration-150 ${selected ? 'ring-2 ring-blue-500 ring-offset-1 shadow-md' : ''} ${hovered ? 'ring-1 ring-blue-400/70' : ''}`}
        style={{
          backgroundColor: zone.fill || 'rgba(59, 130, 246, 0.12)',
          borderColor: zone.stroke || 'rgba(37, 99, 235, 0.6)',
          opacity: fillOpacity,
        }}
      />

      {hovered && !suppressHover && !selected && (
        <ZoneHoverSummary zone={zone} summary={summary || zone.summary} />
      )}

      {/*
        Label lives inside the canvas zoom transform — do not counter-scale with 1/zoom,
        or it stays screen-sized and bulges when zoomed out.
      */}
      <div className="absolute top-1 left-1 max-w-[calc(100%-8px)] px-1.5 py-0.5 rounded bg-white/85 text-[10px] font-semibold text-gray-800 shadow-sm pointer-events-none whitespace-nowrap overflow-hidden text-ellipsis">
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
