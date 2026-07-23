'use client';

import { memo } from 'react';
import ZoneUnit from '@/components/admin/inventory/locator/ZoneUnit';

function ZoneLayer({
  zones,
  selectedZoneId,
  editMode,
  activeTool,
  highlightZoneIds,
  zoom,
  onSelectZone,
  onZoneInteractionStart,
  onZoneChange,
  onZoneChangeEnd,
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
          summary={zone.summary}
          zoom={zoom}
          highlighted={highlightZoneIds?.has(zone.id)}
          dimmed={highlightZoneIds?.size > 0 && !highlightZoneIds.has(zone.id)}
          onSelect={onSelectZone}
          onInteractionStart={onZoneInteractionStart}
          onChange={onZoneChange}
          onChangeEnd={onZoneChangeEnd}
        />
      ))}
    </>
  );
}

export default memo(ZoneLayer);
