/**
 * Admin Brands API Route
 *
 * Uncached flat brand list for admin menu builder and legacy UI.
 *
 * GET /api/admin/brands - Flat list (no-store)
 * GET /api/admin/brands?tree=true - Tree (no-store)
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import Brand from '@/lib/models/Brand';
import { assertAdmin } from '@/lib/server/auth/adminApiGuard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function GET(request) {
  const authError = await assertAdmin(request);
  if (authError) return authError;

  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const asTree = searchParams.get('tree') === 'true';
    const level = searchParams.get('level');
    const parentId = searchParams.get('parent');

    if (asTree) {
      const tree = await Brand.buildTree();
      const plainTree = JSON.parse(JSON.stringify(tree));
      return NextResponse.json(
        { success: true, brands: plainTree },
        { headers: NO_STORE_HEADERS }
      );
    }

    const query = {};
    if (level) query.level = level;
    if (parentId !== null && parentId !== undefined) {
      query.parent = parentId === 'null' ? null : parentId;
    }

    const brands = await Brand.find(query)
      .populate('parent', 'name slug level')
      .sort({ sortOrder: 1, name: 1 })
      .lean();

    return NextResponse.json(
      { success: true, brands },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error('Error fetching admin brands:', error);
    return NextResponse.json(
      { error: 'Failed to fetch brands', details: error.message },
      { status: 500 }
    );
  }
}
