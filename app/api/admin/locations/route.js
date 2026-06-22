import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import Location from '@/lib/models/Location';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import {
  listAllLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  locationHasStock,
} from '@/lib/server/inventory/locationCrudService';
import { canDeleteLocation } from '@/lib/shared/permissions';

export const dynamic = 'force-dynamic';

/** Legacy route — delegates to inventory location CRUD. */
export async function GET(request) {
  const auth = await requireAuth(request, { permission: 'inventory:read' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const locations = await listAllLocations();
    return NextResponse.json({ locations });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await requireAuth(request, { permission: 'inventory:write' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const body = await request.json();
    const location = await createLocation({
      code: body.code,
      name: body.name,
      level: body.level || 'shelf',
      parentLocationId: body.parentLocationId || null,
    });
    return NextResponse.json({ success: true, location }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
