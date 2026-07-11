import { pointInRect, rectCentre } from '@/lib/client/canvasCoordinateUtils';

export function findContainingZone(point, zones) {
  if (!zones?.length) return null;
  const visible = zones.filter((z) => !z.hidden);
  const sorted = [...visible].sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0));
  return sorted.find((z) => pointInRect(point, z)) || null;
}

export function findZoneForRack(rackPosition, zones) {
  if (!rackPosition) return null;
  const centre = rectCentre(rackPosition);
  return findContainingZone(centre, zones);
}

export function countRacksInZone(zoneId, racks) {
  if (!zoneId) return 0;
  return (racks || []).filter((r) => r.position?.zoneId === zoneId).length;
}

export function zoneLabel(zone, rackCount) {
  const name = zone.name || zone.code || 'Zone';
  const count = rackCount ?? 0;
  return `${name} · ${count} rack${count === 1 ? '' : 's'}`;
}

export function generateZoneId() {
  return `zone_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function nextZoneName(existingZones) {
  const used = new Set((existingZones || []).map((z) => z.name?.toLowerCase()));
  for (let i = 0; i < 702; i += 1) {
    const letter = String.fromCharCode(65 + (i % 26));
    const suffix = i >= 26 ? String(Math.floor(i / 26)) : '';
    const name = `Zone ${letter}${suffix}`;
    if (!used.has(name.toLowerCase())) return name;
  }
  return `Zone ${Date.now()}`;
}

export function racksOutsideZone(zone, racks) {
  return (racks || []).filter((r) => {
    if (r.position?.zoneId !== zone.id) return false;
    const centre = rectCentre(r.position);
    return !pointInRect(centre, zone);
  });
}
