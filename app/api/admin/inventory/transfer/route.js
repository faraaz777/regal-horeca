import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { transferStock } from '@/lib/server/inventory/inventoryService';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = await requireAuth(request, { permission: 'inventory:write' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const body = await request.json();
    const { productId, quantity, fromLocationId, toLocationId, note } = body;

    if (!productId || !toLocationId || !quantity) {
      return NextResponse.json(
        { error: 'productId, toLocationId, and quantity are required' },
        { status: 400 }
      );
    }

    const summary = await transferStock({
      productId,
      quantity: Number(quantity),
      fromLocationId: fromLocationId || null,
      toLocationId,
      note: note || '',
      userId: auth.session.userId,
    });

    return NextResponse.json({ success: true, stock: summary });
  } catch (error) {
    console.error('Stock transfer error:', error);
    return NextResponse.json({ error: error.message || 'Transfer failed' }, { status: 400 });
  }
}
