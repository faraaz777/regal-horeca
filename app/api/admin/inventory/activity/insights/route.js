import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { canReadStockLedger } from '@/lib/shared/permissions';
import { getActivityInsights } from '@/lib/server/inventory/stockActivityHubService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/inventory/activity/insights
 *
 * Lightweight movement insights for quick operations checks.
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
    const data = await getActivityInsights({
      productId: searchParams.get('productId') || '',
      locationId: searchParams.get('locationId') || '',
      type: searchParams.get('type') || '',
      dateFrom: searchParams.get('dateFrom') || '',
      dateTo: searchParams.get('dateTo') || '',
      search: searchParams.get('search') || '',
      refExact: searchParams.get('refExact') || '',
      userId: searchParams.get('userId') || '',
    });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to load insights' },
      { status: 500 }
    );
  }
}
