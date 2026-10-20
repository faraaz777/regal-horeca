import 'server-only';

import mongoose from 'mongoose';
import { buildLocationIndexMaps } from '@/lib/server/inventory/locationSelectService';

function branchOf(locationId, byId) {
  let cursor = byId.get(String(locationId));
  let guard = 0;
  while (cursor && guard < 8) {
    if (cursor.level === 'branch') return cursor;
    cursor = cursor.parentLocationId ? byId.get(String(cursor.parentLocationId)) : null;
    guard += 1;
  }
  return null;
}

export function rackIdsForBranch(branchId, byId) {
  const ids = [];
  for (const loc of byId.values()) {
    if (loc.level !== 'rack' && loc.level !== 'shelf') continue;
    const branch = branchOf(loc._id, byId);
    if (branch && String(branch._id) === String(branchId)) ids.push(loc._id);
  }
  return ids;
}

export function branchName(branch) {
  if (!branch) return 'Unknown branch';
  return branch.name || branch.code || 'Branch';
}

/**
 * Rack filter wins. A branch expands to the racks under it.
 * An unknown branch matches nothing rather than the whole ledger.
 */
export async function ledgerLocationClause({ locationId = '', branchId = '' } = {}) {
  const byId = await buildLocationIndexMaps();
  if (locationId && mongoose.Types.ObjectId.isValid(String(locationId))) {
    return { clause: { locationId: new mongoose.Types.ObjectId(String(locationId)) }, byId };
  }
  if (branchId && mongoose.Types.ObjectId.isValid(String(branchId))) {
    const ids = rackIdsForBranch(branchId, byId).map((id) => new mongoose.Types.ObjectId(String(id)));
    return { clause: { locationId: { $in: ids } }, byId };
  }
  return { clause: null, byId };
}

export { branchOf };
