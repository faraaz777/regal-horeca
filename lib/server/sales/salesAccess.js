import 'server-only';

import mongoose from 'mongoose';
import { hasPermission } from '@/lib/shared/permissions';

export function isSalesStaff(session) {
  return session?.role === 'sales';
}

export function canSuperviseInventory(session) {
  return hasPermission(session?.role, 'inventory:requests:approve');
}

/** Sales users only see their own sessions, buckets, and requests. */
export function buildSalesOwnerQuery(session, field = 'salesUserId') {
  if (!isSalesStaff(session)) return {};
  if (!mongoose.Types.ObjectId.isValid(session.userId)) {
    return { [field]: null };
  }
  return { [field]: new mongoose.Types.ObjectId(session.userId) };
}

export function assertOwnsResource(session, doc, field = 'salesUserId') {
  if (!isSalesStaff(session)) return true;
  const ownerId = doc?.[field]?.toString?.() || String(doc?.[field] || '');
  return ownerId === String(session.userId);
}
