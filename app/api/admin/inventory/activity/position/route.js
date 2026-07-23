import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { canReadStockLedger } from '@/lib/shared/permissions';
import { listStockPosition } from '@/lib/server/inventory/stockActivityHubService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/inventory/activity/position
 *
 * Stock Position (snapshot truth): where stock exists now by product and rack.
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

    const data = await listStockPosition({
      locationId: searchParams.get('locationId') || '',
      productId: searchParams.get('productId') || '',
      search: searchParams.get('search') || '',
      page,
      limit,
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to load stock position' },
      { status: 500 }
    );
  }
}
