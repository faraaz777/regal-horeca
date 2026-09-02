/**
 * GET /api/admin/inventory/product-sheet/search?q=
 *
 * Picker results: parent families and standalone SKUs only.
 *
 * Permissions: inventory:read
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import {
  PRODUCT_SHEET_SEARCH_LIMIT,
  searchProductSheetFamilies,
} from '@/lib/server/inventory/productStockSheetService';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireAuth(request, { permission: 'inventory:read' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const results = await searchProductSheetFamilies(q, PRODUCT_SHEET_SEARCH_LIMIT);
    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Product sheet search error:', error);
    return NextResponse.json({ error: error.message || 'Search failed' }, { status: 400 });
  }
}
