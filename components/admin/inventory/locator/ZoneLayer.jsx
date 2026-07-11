'use client';

import { memo } from 'react';
import ZoneUnit from '@/components/admin/inventory/locator/ZoneUnit';

function ZoneLayer({
  zones,
  selectedZoneId,
  editMode,
  activeTool,
  heatmapMode,
  highlightZoneIds,
  zoom,
  onSelectZone,
  onZoneChange,
  onZoneChangeEnd,
  suppressHover,
}) {
  const sorted = [...(zones || [])].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

  return (
    <>
      {sorted.map((zone) => (
        <ZoneUnit
          key={zone.id}
          zone={zone}
          selected={selectedZoneId === zone.id}
          editMode={editMode}
          activeTool={activeTool}
          heatmapMode={heatmapMode}
          summary={zone.summary}
          zoom={zoom}
          dimmed={highlightZoneIds?.size > 0 && !highlightZoneIds.has(zone.id)}
          suppressHover={suppressHover}
          onSelect={onSelectZone}
          onChange={onZoneChange}
          onChangeEnd={onZoneChangeEnd}
        />
      ))}
    </>
  );
}

export default memo(ZoneLayer);
