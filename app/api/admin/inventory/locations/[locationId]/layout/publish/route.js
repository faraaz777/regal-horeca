import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { publishFloorLayout } from '@/lib/server/inventory/locationLayoutService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/inventory/locations/:floorId/layout/publish
 */
export async function POST(request, { params }) {
  const auth = await requireAuth(request, { permission: 'locations:write' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const layout = await publishFloorLayout(params.locationId, auth.session, request);
    return NextResponse.json({ success: true, layout });
  } catch (error) {
    const status = error.message === 'Floor not found' ? 404 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
