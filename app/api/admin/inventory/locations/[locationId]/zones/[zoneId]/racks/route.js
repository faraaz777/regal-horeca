import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { getZoneRackOptions } from '@/lib/server/inventory/locationZoneRackService';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const auth = await requireAuth(request, { permission: 'inventory:read' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const status = searchParams.get('status') || 'all';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    const result = await getZoneRackOptions(params.locationId, params.zoneId, {
      search: q,
      status,
      page,
      limit,
    });
    return NextResponse.json(result);
  } catch (error) {
    const status = error.message === 'Zone not found' ? 404 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
