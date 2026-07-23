import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { canReadStockLedger } from '@/lib/shared/permissions';
import { listOperators } from '@/lib/server/inventory/stockActivityHubService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/inventory/activity/operators
 *
 * Operators grouped from stock ledger performers.
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
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const data = await listOperators({
      productId: searchParams.get('productId') || '',
      locationId: searchParams.get('locationId') || '',
      type: searchParams.get('type') || '',
      dateFrom: searchParams.get('dateFrom') || '',
      dateTo: searchParams.get('dateTo') || '',
      search: searchParams.get('search') || '',
      refExact: searchParams.get('refExact') || '',
      page,
      limit,
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to load operators' },
      { status: 500 }
    );
  }
}
