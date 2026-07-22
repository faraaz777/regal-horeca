/**
 * @typedef {import('@/lib/shared/locationTypes').CascadeBranchesResponse} CascadeBranchesResponse
 * @typedef {import('@/lib/shared/locationTypes').CascadeFloorsResponse} CascadeFloorsResponse
 * @typedef {import('@/lib/shared/locationTypes').CascadeRacksResponse} CascadeRacksResponse
 * @typedef {import('@/lib/shared/locationTypes').CascadeResolveResponse} CascadeResolveResponse
 * @typedef {import('@/lib/shared/locationTypes').LocationSelection} LocationSelection
 */

import { adminJson } from '@/lib/client/adminFetch';

export { cascadeRacksSwrKey } from '@/lib/client/cascadeRacksSwrKey';

/** @returns {Promise<CascadeBranchesResponse>} */
export function fetchCascadeBranches() {
  return adminJson('/api/admin/inventory/locations/cascade');
}

/** @returns {Promise<CascadeFloorsResponse>} */
export function fetchCascadeFloors(branchId) {
  return adminJson(
    `/api/admin/inventory/locations/cascade?branchId=${encodeURIComponent(branchId)}`
  );
}

/** @returns {Promise<CascadeRacksResponse>} */
export function fetchCascadeRacks(floorId, allowedRackIds = []) {
  const params = new URLSearchParams({ floorId });
  if (allowedRackIds.length) {
    params.set('allowedIds', allowedRackIds.join(','));
  }
  return adminJson(`/api/admin/inventory/locations/cascade?${params}`);
}

/** @returns {Promise<CascadeResolveResponse>} */
export function resolveCascadeLocation(locationId) {
  return adminJson(
    `/api/admin/inventory/locations/cascade?locationId=${encodeURIComponent(locationId)}`
  );
}

/**
 * @param {LocationSelection|null|undefined} selection
 * @param {{ required?: boolean }} [options]
 */
export function validateLocationSelectionClient(selection, { required = true } = {}) {
  if (!required) return { valid: true };
  if (!selection?.branchId || !selection?.floorId || !selection?.rackId) {
    return { valid: false, error: 'Select branch, floor, and rack' };
  }
  if (!selection.locationId) {
    return { valid: false, error: 'Select a rack' };
  }
  return { valid: true };
}
