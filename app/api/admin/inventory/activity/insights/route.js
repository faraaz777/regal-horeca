import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { canReadStockLedger } from '@/lib/shared/permissions';
import { getMovementInsights } from '@/lib/server/inventory/movementInsightsService';

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
    const data = await getMovementInsights({
      productId: searchParams.get('productId') || '',
      locationId: searchParams.get('locationId') || '',
      branchId: searchParams.get('branchId') || '',
      type: searchParams.get('type') || '',
      dateFrom: searchParams.get('dateFrom') || '',
      dateTo: searchParams.get('dateTo') || '',
      search: searchParams.get('search') || '',
      userId: searchParams.get('userId') || '',
      bucket: searchParams.get('bucket') || '',
      unit: searchParams.get('unit') || '',
      calendarMonth: searchParams.get('calendarMonth') || '',
      aging: searchParams.get('aging') || '',
    });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to load insights' },
      { status: 500 }
    );
  }
}
