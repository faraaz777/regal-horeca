import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { getItemsAtLocation } from '@/lib/server/inventory/locationTreeService';
import { isValidLocationId } from '@/lib/server/inventory/locationCrudService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/inventory/locations/:locationId/items
 *
 * Stock rows at a location (and descendants). Response is capped (see LOCATION_ITEMS_MAX).
 *
 * Permissions: inventory:read
 */
export async function GET(request, { params }) {
  const auth = await requireAuth(request, { permission: 'inventory:read' });
  if (auth.error) return auth.error;

  if (!isValidLocationId(params.locationId)) {
    return NextResponse.json({ error: 'Invalid location id' }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const data = await getItemsAtLocation(params.locationId);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Location items error:', error);
    const status = error.message === 'Location not found' ? 404 : 500;
    return NextResponse.json({ error: error.message || 'Failed to load items' }, { status });
  }
}
