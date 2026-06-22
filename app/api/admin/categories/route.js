/**
 * Admin Categories API Route
 *
 * Uncached categories for admin UI (Add Product, Manage Categories).
 * Same response shape as GET /api/categories. Requires admin session cookie.
 *
 * GET /api/admin/categories?tree=true - Tree (no-store)
 * GET /api/admin/categories - Flat list (no-store)
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import Category from '@/lib/models/Category';
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
      const tree = await Category.buildTree();
      const plainTree = JSON.parse(JSON.stringify(tree));
      return NextResponse.json(
        { success: true, categories: plainTree },
        { headers: NO_STORE_HEADERS }
      );
    }

    const query = {};
    if (level) query.level = level;
    if (parentId !== null && parentId !== undefined) {
      if (parentId === 'null') {
        query.parent = null;
      } else {
        query.parent = parentId;
      }
    }

    const categories = await Category.find(query)
      .populate('parent', 'name slug level')
      .sort({ name: 1 })
      .lean();

    return NextResponse.json(
      { success: true, categories },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error('Error fetching admin categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories', details: error.message },
      { status: 500 }
    );
  }
}
