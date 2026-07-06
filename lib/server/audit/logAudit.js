import 'server-only';

import AuditLog from '@/lib/server/models/AuditLog';

/**
 * Append-only system audit log.
 * Call from every mutating service — never rely on the UI to log.
 */
export async function logAudit({
  actorId,
  actorRole = '',
  action,
  entityType = '',
  entityId = null,
  before = null,
  after = null,
  metadata = null,
  request = null,
}) {
  try {
    await AuditLog.create({
      userId: actorId || undefined,
      actorRole: actorRole || '',
      action,
      entityType,
      entityId,
      before,
      after,
      metadata,
      ip: request?.headers?.get('x-forwarded-for')?.split(',')[0]?.trim() || '',
      userAgent: request?.headers?.get('user-agent') || '',
    });
  } catch (err) {
    console.error('AuditLog write failed:', err.message);
  }
}
