import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import {
  locateProductOnFloor,
  searchProductsOnFloor,
} from '@/lib/server/inventory/locatorLocateService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/inventory/locations/:floorId/locate
 *
 * Floor-scoped find (Stock snapshot = truth):
 * - ?q= Dual Platter  → products on this floor matching search
 * - ?productId=…      → racks on this floor holding that product (+ layout x/y)
 *
 * Permissions: inventory:read
 */
export async function GET(request, { params }) {
  const auth = await requireAuth(request, { permission: 'inventory:read' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const floorId = params.locationId;
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId') || '';
    const q = searchParams.get('q') || '';
    const limit = searchParams.get('limit') || 20;

    if (productId) {
      const data = await locateProductOnFloor(floorId, productId);
      return NextResponse.json(data);
    }

    if (q.trim()) {
      const data = await searchProductsOnFloor(floorId, q, limit);
      return NextResponse.json(data);
    }

    return NextResponse.json(
      { error: 'Provide q= for floor search or productId= to locate' },
      { status: 400 }
    );
  } catch (error) {
    const status = error.message === 'Floor not found' || error.message === 'Product not found' ? 404 : 400;
    return NextResponse.json({ error: error.message || 'Locate failed' }, { status });
  }
}
