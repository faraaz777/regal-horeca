import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { canReadAuditLog } from '@/lib/shared/permissions';
import {
  listAuditLogEntries,
  listDistinctAuditActions,
  listDistinctAuditEntityTypes,
} from '@/lib/server/audit/auditListService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/audit
 *
 * Paginated system audit log. super_admin only.
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
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const includeFilters = searchParams.get('filters') === '1';

    const data = await listAuditLogEntries({
      actorId: searchParams.get('actorId') || '',
      action: searchParams.get('action') || '',
      entityType: searchParams.get('entityType') || '',
      entityId: searchParams.get('entityId') || '',
      dateFrom: searchParams.get('dateFrom') || '',
      dateTo: searchParams.get('dateTo') || '',
      search: searchParams.get('search') || '',
      page,
      limit,
    });

    if (includeFilters) {
      const [actions, entityTypes] = await Promise.all([
        listDistinctAuditActions(),
        listDistinctAuditEntityTypes(),
      ]);
      return NextResponse.json({ ...data, filters: { actions, entityTypes } });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Audit list error:', error);
    return NextResponse.json({ error: error.message || 'Failed to load audit log' }, { status: 500 });
  }
}
