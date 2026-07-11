import { adminFetch, adminJson } from '@/lib/client/adminFetch';

export async function updateFloorLayout(floorId, payload) {
  return adminJson(`/api/admin/inventory/locations/${floorId}/layout`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function uploadFloorPlanBackground(floorId, file, repositionMode = 'keep_proportional') {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('repositionMode', repositionMode);
  const res = await adminFetch(`/api/admin/inventory/locations/${floorId}/layout/background`, {
    method: 'POST',
    body: formData,
  });
  return res.json();
}

export async function removeFloorPlanBackground(floorId) {
  return adminJson(`/api/admin/inventory/locations/${floorId}/layout/background`, {
    method: 'DELETE',
  });
}

export async function publishFloorLayout(floorId) {
  return adminJson(`/api/admin/inventory/locations/${floorId}/layout/publish`, {
    method: 'POST',
  });
}
