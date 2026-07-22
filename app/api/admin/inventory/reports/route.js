import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import {
  getSellableStockReport,
  getDeadStockReport,
  getSoldMovementReport,
} from '@/lib/server/inventory/inventoryReportsService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/inventory/reports?type=sellable|dead_stock|sold
 *
 * sellable = sellableQty at locations
 * dead_stock = products with InventoryRule.deadStockMarked (+ sellableQty)
 * sold = sale fulfillment ledger history
 */
export async function GET(request) {
  const auth = await requireAuth(request, { permission: 'inventory:read' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'sellable';
    const search = searchParams.get('search') || '';
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 50));
    const from = searchParams.get('from') || '';
    const to = searchParams.get('to') || '';

    let data;
    if (type === 'dead_stock') {
      data = await getDeadStockReport({ search, page, limit });
    } else if (type === 'sold') {
      data = await getSoldMovementReport({ search, from, to, page, limit });
    } else {
      data = await getSellableStockReport({ search, page, limit });
    }

    return NextResponse.json({ success: true, type, ...data });
  } catch (error) {
    console.error('Inventory report error:', error);
    return NextResponse.json({ error: error.message || 'Report failed' }, { status: 400 });
  }
}
