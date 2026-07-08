import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import {
  listCascadeBranches,
  listCascadeFloors,
  listCascadeRacks,
  resolveCascadeSelection,
} from '@/lib/server/inventory/locationSelectService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/inventory/locations/cascade
 *
 * Branch → Floor → Rack cascade (active inventory location model).
 */
export async function GET(request) {
  const auth = await requireAuth(request, { permission: 'inventory:read' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId') || '';
    const floorId = searchParams.get('floorId') || '';
    const locationId = searchParams.get('locationId') || '';
    const allowedIds = (searchParams.get('allowedIds') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (locationId) {
      const selection = await resolveCascadeSelection(locationId);
      return NextResponse.json({ selection });
    }

    if (floorId) {
      const racks = await listCascadeRacks(floorId, {
        allowedLocationIds: allowedIds.length ? allowedIds : undefined,
      });
      return NextResponse.json({ racks, floorId });
    }

    if (branchId) {
      const floors = await listCascadeFloors(branchId);
      return NextResponse.json({ floors, branchId });
    }

    const branches = await listCascadeBranches();
    return NextResponse.json({ branches });
  } catch (error) {
    console.error('Location cascade error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load locations' },
      { status: 400 }
    );
  }
}
