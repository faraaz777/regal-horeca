import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { updateRackPosition } from '@/lib/server/inventory/locationLayoutService';
import { rackPositionSchema, formatZodError } from '@/lib/server/inventory/schemas';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/inventory/locations/:id/position
 */
export async function PATCH(request, { params }) {
  const auth = await requireAuth(request, { permission: 'locations:write' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const body = await request.json();
    const parsed = rackPositionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    const result = await updateRackPosition(params.locationId, parsed.data, auth.session, request);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const status = error.message === 'Rack not found' ? 404 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
