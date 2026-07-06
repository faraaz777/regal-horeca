import 'server-only';

import { logAudit } from '@/lib/server/audit/logAudit';

/** @deprecated Prefer logAudit — kept for existing call sites. */
export async function writeAuditLog({
  userId,
  actorRole = '',
  action,
  entityType = '',
  entityId = null,
  before = null,
  after = null,
  metadata = null,
  request = null,
}) {
  return logAudit({
    actorId: userId,
    actorRole,
    action,
    entityType,
    entityId,
    before,
    after,
    metadata,
    request,
  });
}
