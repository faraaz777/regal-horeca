import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { getFloorLayout } from '@/lib/server/inventory/locationLayoutService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/inventory/locations/:floorId/layout
 * Floor plan data for all racks under the selected floor.
 */
export async function GET(request, { params }) {
  const auth = await requireAuth(request, { permission: 'inventory:read' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const layout = await getFloorLayout(params.locationId);
    return NextResponse.json(layout);
  } catch (error) {
    const status = error.message === 'Floor not found' ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
