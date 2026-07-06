import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { getProductStockDetail } from '@/lib/server/inventory/inventoryService';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const auth = await requireAuth(request, { permission: 'inventory:read' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const data = await getProductStockDetail(params.productId);
    return NextResponse.json(data);
  } catch (error) {
    const status = error.message === 'Product not found' ? 404 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
