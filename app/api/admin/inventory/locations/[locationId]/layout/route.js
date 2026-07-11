import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { getFloorLayout, updateFloorLayout } from '@/lib/server/inventory/locationLayoutService';
import { floorLayoutUpdateSchema, formatZodError } from '@/lib/server/inventory/schemas';

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

/**
 * PATCH /api/admin/inventory/locations/:floorId/layout
 */
export async function PATCH(request, { params }) {
  const auth = await requireAuth(request, { permission: 'locations:write' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const body = await request.json();
    const parsed = floorLayoutUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    const layout = await updateFloorLayout(
      params.locationId,
      parsed.data,
      auth.session,
      request
    );
    return NextResponse.json({ success: true, layout });
  } catch (error) {
    if (error.code === 'LAYOUT_CONFLICT') {
      return NextResponse.json(
        { error: error.message, currentVersion: error.currentVersion },
        { status: 409 }
      );
    }
    const status = error.message === 'Floor not found' ? 404 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
