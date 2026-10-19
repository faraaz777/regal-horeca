/**
 * GET /api/admin/inventory/product-sheet/search?q=&brand=&color=&inventoryStatus=
 * GET /api/admin/inventory/product-sheet/search?brandsOnly=1
 *
 * Picker results: parent families and standalone SKUs only.
 * Filters narrow the picker. Sheet generation still uses explicit product ids.
 *
 * Permissions: inventory:read
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import {
  PRODUCT_SHEET_SEARCH_LIMIT,
  listProductSheetBrands,
  listProductSheetColors,
  searchProductSheetFamilies,
} from '@/lib/server/inventory/productStockSheetService';

export const dynamic = 'force-dynamic';

const INVENTORY_STATUSES = new Set(['all', 'in', 'out']);

export async function GET(request) {
  const auth = await requireAuth(request, { permission: 'inventory:read' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);

    if (searchParams.get('brandsOnly') === '1') {
      const [brands, colors] = await Promise.all([
        listProductSheetBrands(),
        listProductSheetColors(),
      ]);
      return NextResponse.json({ success: true, brands, colors });
    }

    const inventoryStatus = searchParams.get('inventoryStatus') || 'all';
    if (!INVENTORY_STATUSES.has(inventoryStatus)) {
      return NextResponse.json({ error: 'Invalid inventory status' }, { status: 400 });
    }

    const brand = String(searchParams.get('brand') || '').trim().slice(0, 120);
    const color = String(searchParams.get('color') || '').trim().slice(0, 80);
    const q = searchParams.get('q') || '';
    const results = await searchProductSheetFamilies(q, PRODUCT_SHEET_SEARCH_LIMIT, {
      brand,
      color,
      inventoryStatus,
    });
    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Product sheet search error:', error);
    return NextResponse.json({ error: error.message || 'Search failed' }, { status: 400 });
  }
}
