import 'server-only';

import mongoose from 'mongoose';
import AuditLog from '@/lib/server/models/AuditLog';

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Paginated system audit log with filters.
 */
export async function listAuditLogEntries({
  actorId = '',
  action = '',
  entityType = '',
  entityId = '',
  dateFrom = '',
  dateTo = '',
  search = '',
  page = 1,
  limit = 50,
}) {
  const query = {};

  if (actorId) {
    query.userId = new mongoose.Types.ObjectId(String(actorId));
  }

  if (action) {
    query.action = action;
  }

  if (entityType) {
    query.entityType = entityType;
  }

  if (entityId) {
    query.entityId = entityId;
  }

  const from = parseDate(dateFrom);
  const to = parseDate(dateTo);
  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = from;
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }

  if (search.trim()) {
    const re = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [{ action: re }, { entityType: re }];
  }

  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const skip = (Math.max(page, 1) - 1) * safeLimit;

  const [items, total] = await Promise.all([
    AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .populate('userId', 'name email role')
      .lean(),
    AuditLog.countDocuments(query),
  ]);

  const normalized = items.map((row) => ({
    _id: row._id,
    actorId: row.userId?._id || row.userId,
    actorName: row.userId?.name || '—',
    actorEmail: row.userId?.email || '',
    actorRole: row.actorRole || row.userId?.role || '',
    action: row.action,
    entityType: row.entityType || '',
    entityId: row.entityId,
    before: row.before,
    after: row.after,
    metadata: row.metadata,
    ip: row.ip || '',
    createdAt: row.createdAt,
  }));

  return {
    items: normalized,
    pagination: {
      page: Math.max(page, 1),
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit) || 1,
    },
  };
}

export async function listDistinctAuditActions() {
  return AuditLog.distinct('action').then((actions) => actions.sort());
}

export async function listDistinctAuditEntityTypes() {
  return AuditLog.distinct('entityType').then((types) => types.filter(Boolean).sort());
}

export function auditRowsToCsv(items) {
  const header = [
    'Timestamp',
    'Actor',
    'Role',
    'Action',
    'Entity type',
    'Entity ID',
    'IP',
    'Before',
    'After',
    'Metadata',
  ];

  const lines = [header.join(',')];

  for (const row of items) {
    const cols = [
      row.createdAt ? new Date(row.createdAt).toISOString() : '',
      row.actorName || '',
      row.actorRole || '',
      row.action || '',
      row.entityType || '',
      row.entityId != null ? String(row.entityId) : '',
      row.ip || '',
      row.before != null ? JSON.stringify(row.before) : '',
      row.after != null ? JSON.stringify(row.after) : '',
      row.metadata != null ? JSON.stringify(row.metadata) : '',
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
    lines.push(cols.join(','));
  }

  return lines.join('\n');
}
