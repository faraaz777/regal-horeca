import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import {
  listAllLocations,
  createLocation,
} from '@/lib/server/inventory/locationCrudService';
import { listActiveVendors } from '@/lib/server/inventory/addToInventoryService';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireAuth(request, { permission: 'inventory:read' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const includeVendors = searchParams.get('vendors') === 'true';

    const payload = { locations: await listAllLocations() };

    if (includeVendors) {
      payload.vendors = await listActiveVendors();
    }

    return NextResponse.json(payload);
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
    const { code, name, level, parentLocationId } = body;

    if (!level) {
      return NextResponse.json({ error: 'Level is required' }, { status: 400 });
    }

    const location = await createLocation({
      code,
      name,
      level,
      parentLocationId: parentLocationId || null,
    });

    return NextResponse.json({ success: true, location }, { status: 201 });
  } catch (error) {
    if (error?.code === 11000) {
      return NextResponse.json({ error: 'Location code already exists under this parent' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
