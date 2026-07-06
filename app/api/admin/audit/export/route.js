import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { canReadAuditLog } from '@/lib/shared/permissions';
import { listAuditLogEntries, auditRowsToCsv } from '@/lib/server/audit/auditListService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/audit/export
 *
 * Export audit log as CSV or Excel. super_admin only.
 */
export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  if (!canReadAuditLog(auth.session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get('format') || 'csv').toLowerCase();

    const filters = {
      actorId: searchParams.get('actorId') || '',
      action: searchParams.get('action') || '',
      entityType: searchParams.get('entityType') || '',
      entityId: searchParams.get('entityId') || '',
      dateFrom: searchParams.get('dateFrom') || '',
      dateTo: searchParams.get('dateTo') || '',
      search: searchParams.get('search') || '',
      page: 1,
      limit: 5000,
    };

    const data = await listAuditLogEntries(filters);
    const stamp = new Date().toISOString().slice(0, 10);

    if (format === 'xlsx' || format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Audit log');
      ws.columns = [
        { header: 'Timestamp', key: 'ts', width: 22 },
        { header: 'Actor', key: 'actor', width: 22 },
        { header: 'Role', key: 'role', width: 18 },
        { header: 'Action', key: 'action', width: 28 },
        { header: 'Entity type', key: 'entityType', width: 16 },
        { header: 'Entity ID', key: 'entityId', width: 26 },
        { header: 'IP', key: 'ip', width: 16 },
        { header: 'Before', key: 'before', width: 40 },
        { header: 'After', key: 'after', width: 40 },
      ];

      for (const row of data.items) {
        ws.addRow({
          ts: row.createdAt ? new Date(row.createdAt).toLocaleString('en-IN') : '',
          actor: row.actorName || '',
          role: row.actorRole || '',
          action: row.action || '',
          entityType: row.entityType || '',
          entityId: row.entityId != null ? String(row.entityId) : '',
          ip: row.ip || '',
          before: row.before != null ? JSON.stringify(row.before) : '',
          after: row.after != null ? JSON.stringify(row.after) : '',
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      return new NextResponse(buffer, {
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="audit-log-${stamp}.xlsx"`,
        },
      });
    }

    const csv = auditRowsToCsv(data.items);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit-log-${stamp}.csv"`,
      },
    });
  } catch (error) {
    console.error('Audit export error:', error);
    return NextResponse.json({ error: error.message || 'Export failed' }, { status: 500 });
  }
}
