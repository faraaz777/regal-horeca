/**
 * POST /api/admin/inventory/product-sheet
 *
 * Builds a product-family stock sheet for selected parent/standalone (or child) IDs.
 *
 * Permissions: inventory:read
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { buildProductStockSheet } from '@/lib/server/inventory/productStockSheetService';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = await requireAuth(request, { permission: 'inventory:read' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const body = await request.json().catch(() => ({}));
    const productIds = Array.isArray(body.productIds) ? body.productIds : [];

    if (!productIds.length) {
      return NextResponse.json({ error: 'Select at least one product' }, { status: 400 });
    }

    const sheet = await buildProductStockSheet(productIds);
    return NextResponse.json({ success: true, ...sheet });
  } catch (error) {
    const status = error.status || 400;
    console.error('Product stock sheet error:', error);
    return NextResponse.json({ error: error.message || 'Failed to build sheet' }, { status });
  }
}
