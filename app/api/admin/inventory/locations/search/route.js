import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { searchLocationsByQuery } from '@/lib/server/inventory/locationTreeService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/inventory/locations/search?q=
 *
 * Finds racks (or floors/branches) holding matching products by title/SKU/barcode,
 * and also matches location code/name. Returns a ranked primary hit for UI highlight.
 *
 * Permissions: inventory:read
 */
export async function GET(request) {
  const auth = await requireAuth(request, { permission: 'inventory:read' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const data = await searchLocationsByQuery(q);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Location search error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to search locations' },
      { status: 500 }
    );
  }
}
