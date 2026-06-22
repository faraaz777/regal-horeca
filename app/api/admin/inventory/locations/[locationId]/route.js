import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { canDeleteLocation } from '@/lib/shared/permissions';
import {
  getLocationById,
  updateLocation,
  deleteLocation,
  locationHasStock,
} from '@/lib/server/inventory/locationCrudService';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const auth = await requireAuth(request, { permission: 'inventory:read' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const location = await getLocationById(params.locationId);
    return NextResponse.json({ location });
  } catch (error) {
    const status = error.message === 'Location not found' ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

export async function PATCH(request, { params }) {
  const auth = await requireAuth(request, { permission: 'inventory:write' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const body = await request.json();
    const location = await updateLocation(params.locationId, body);
    return NextResponse.json({ success: true, location });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(request, { params }) {
  const auth = await requireAuth(request, { permission: 'inventory:write' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const hasStock = await locationHasStock(params.locationId);
    if (!canDeleteLocation(auth.session.role, { isEmpty: !hasStock })) {
      return NextResponse.json(
        {
          error: hasStock
            ? 'Location has stock and cannot be deleted'
            : 'Not allowed to delete this location',
        },
        { status: 403 }
      );
    }

    await deleteLocation(params.locationId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
