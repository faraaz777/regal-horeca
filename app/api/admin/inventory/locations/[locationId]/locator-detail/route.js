import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { getRackLocatorDetail } from '@/lib/server/inventory/locationLayoutService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/inventory/locations/:rackId/locator-detail
 */
export async function GET(request, { params }) {
  const auth = await requireAuth(request, { permission: 'inventory:read' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const detail = await getRackLocatorDetail(params.locationId);
    return NextResponse.json(detail);
  } catch (error) {
    const status = error.message === 'Rack not found' ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
