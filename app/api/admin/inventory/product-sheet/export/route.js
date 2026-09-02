/**
 * POST /api/admin/inventory/product-sheet/export
 *
 * Excel download of the product-family stock sheet.
 *
 * Permissions: inventory:read
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import {
  buildProductStockSheet,
  buildProductStockSheetWorkbook,
} from '@/lib/server/inventory/productStockSheetService';

export const runtime = 'nodejs';
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
    if (!sheet.groups.length) {
      return NextResponse.json({ error: 'No products found for this selection' }, { status: 404 });
    }

    const workbook = await buildProductStockSheetWorkbook(sheet);
    const buffer = await workbook.xlsx.writeBuffer();
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `product-stock-sheet-${stamp}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const status = error.status || 400;
    console.error('Product sheet export error:', error);
    return NextResponse.json({ error: error.message || 'Export failed' }, { status });
  }
}
