import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import {
  removeFloorPlanBackground,
  uploadFloorPlanBackground,
} from '@/lib/server/inventory/locationLayoutService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/inventory/locations/:floorId/layout/background
 */
export async function POST(request, { params }) {
  const auth = await requireAuth(request, { permission: 'locations:write' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const formData = await request.formData();
    const file = formData.get('file');
    const repositionMode = formData.get('repositionMode') || 'keep_proportional';

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const layout = await uploadFloorPlanBackground(
      params.locationId,
      { file, buffer, repositionMode },
      auth.session,
      request
    );

    return NextResponse.json({ success: true, layout });
  } catch (error) {
    const status = error.message === 'Floor not found' ? 404 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}

/**
 * DELETE /api/admin/inventory/locations/:floorId/layout/background
 */
export async function DELETE(request, { params }) {
  const auth = await requireAuth(request, { permission: 'locations:write' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const layout = await removeFloorPlanBackground(params.locationId, auth.session, request);
    return NextResponse.json({ success: true, layout });
  } catch (error) {
    const status = error.message === 'Floor not found' ? 404 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
