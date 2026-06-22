import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { changeStockCondition } from '@/lib/server/inventory/inventoryService';
import { STOCK_CONDITIONS } from '@/lib/models/InventoryStock';

export const dynamic = 'force-dynamic';

export async function PATCH(request) {
  const auth = await requireAuth(request, { permission: 'inventory:write' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const body = await request.json();
    const { productId, condition, locationId, note } = body;

    if (!productId || !condition) {
      return NextResponse.json({ error: 'productId and condition are required' }, { status: 400 });
    }

    if (!STOCK_CONDITIONS.includes(condition)) {
      return NextResponse.json({ error: 'Invalid condition' }, { status: 400 });
    }

    const summary = await changeStockCondition({
      productId,
      condition,
      locationId: locationId || null,
      userId: auth.session.userId,
      note: note || '',
    });

    return NextResponse.json({ success: true, stock: summary });
  } catch (error) {
    console.error('Condition change error:', error);
    return NextResponse.json({ error: error.message || 'Condition update failed' }, { status: 400 });
  }
}
