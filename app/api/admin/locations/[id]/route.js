import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { canDeleteLocation } from '@/lib/shared/permissions';
import {
  updateLocation,
  deleteLocation,
  locationHasStock,
  isValidLocationId,
} from '@/lib/server/inventory/locationCrudService';

export const dynamic = 'force-dynamic';

/**
 * Legacy locations API — same edit whitelist as inventory locations admin.
 * Kept because external callers may still hit this path; no in-repo UI uses it.
 */
function pickLocationEditFields(body) {
  if (!body || typeof body !== 'object') return {};
  const patch = {};
  if (body.code !== undefined) patch.code = body.code;
  if (body.name !== undefined) patch.name = body.name;
  return patch;
}

export async function DELETE(request, { params }) {
  const auth = await requireAuth(request, { permission: 'inventory:write' });
  if (auth.error) return auth.error;

  if (!isValidLocationId(params.id)) {
    return NextResponse.json({ error: 'Invalid location id' }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const hasStock = await locationHasStock(params.id);
    if (!canDeleteLocation(auth.session.role, { isEmpty: !hasStock })) {
      return NextResponse.json({ error: 'Not allowed to delete this location' }, { status: 403 });
    }
    await deleteLocation(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function PATCH(request, { params }) {
  const auth = await requireAuth(request, { permission: 'inventory:write' });
  if (auth.error) return auth.error;

  if (!isValidLocationId(params.id)) {
    return NextResponse.json({ error: 'Invalid location id' }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const body = await request.json();
    const patch = pickLocationEditFields(body);
    if (patch.code === undefined && patch.name === undefined) {
      return NextResponse.json(
        { error: 'Provide code and/or name to update' },
        { status: 400 }
      );
    }
    const location = await updateLocation(params.id, patch);
    return NextResponse.json({ success: true, location });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
