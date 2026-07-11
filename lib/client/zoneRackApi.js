import { adminJson } from '@/lib/client/adminFetch';

export async function fetchZoneRackOptions(floorId, zoneId, { q = '', status = 'all', page = 1, limit = 50 } = {}) {
  const params = new URLSearchParams({ status, page: String(page), limit: String(limit) });
  if (q) params.set('q', q);
  return adminJson(
    `/api/admin/inventory/locations/${floorId}/zones/${zoneId}/racks?${params.toString()}`
  );
}

export async function assignRacksToZone(floorId, zoneId, { rackIds, layoutVersion }) {
  return adminJson(`/api/admin/inventory/locations/${floorId}/zones/${zoneId}/racks/assign`, {
    method: 'POST',
    body: JSON.stringify({ rackIds, layoutVersion }),
  });
}

export async function removeRacksFromZone(floorId, zoneId, { rackIds, layoutVersion }) {
  return adminJson(`/api/admin/inventory/locations/${floorId}/zones/${zoneId}/racks/remove`, {
    method: 'POST',
    body: JSON.stringify({ rackIds, layoutVersion }),
  });
}

export async function moveRackToZone(floorId, zoneId, { rackId, fromZoneId, layoutVersion }) {
  return adminJson(`/api/admin/inventory/locations/${floorId}/zones/${zoneId}/racks/move`, {
    method: 'POST',
    body: JSON.stringify({ rackId, fromZoneId, layoutVersion }),
  });
}
