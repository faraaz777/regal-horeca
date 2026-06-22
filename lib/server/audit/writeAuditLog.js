import 'server-only';

import AuditLog from '@/lib/server/models/AuditLog';

export async function writeAuditLog({
  userId,
  action,
  entityType = '',
  entityId = null,
  before = null,
  after = null,
  request = null,
}) {
  try {
    await AuditLog.create({
      userId: userId || undefined,
      action,
      entityType,
      entityId,
      before,
      after,
      ip: request?.headers?.get('x-forwarded-for')?.split(',')[0]?.trim() || '',
      userAgent: request?.headers?.get('user-agent') || '',
    });
  } catch (err) {
    console.error('AuditLog write failed:', err.message);
  }
}
