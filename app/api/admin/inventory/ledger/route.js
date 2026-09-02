import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { canReadStockLedger } from '@/lib/shared/permissions';
import { listStockLedgerEntries } from '@/lib/server/inventory/ledgerListService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/inventory/ledger
 *
 * Paginated stock movement ledger (append-only).
 * Permissions: super_admin, inventory_manager
 */
export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  if (!canReadStockLedger(auth.session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const data = await listStockLedgerEntries({
      productId: searchParams.get('productId') || '',
      locationId: searchParams.get('locationId') || '',
      type: searchParams.get('type') || '',
      dateFrom: searchParams.get('dateFrom') || '',
      dateTo: searchParams.get('dateTo') || '',
      search: searchParams.get('search') || '',
      refExact: searchParams.get('refExact') || '',
      userId: searchParams.get('userId') || '',
      soldForUserId: searchParams.get('soldForUserId') || '',
      page,
      limit,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('Ledger list error:', error);
    return NextResponse.json({ error: error.message || 'Failed to load ledger' }, { status: 500 });
  }
}
