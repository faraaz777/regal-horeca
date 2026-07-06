import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { adjustStock } from '@/lib/server/inventory/inventoryService';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = await requireAuth(request, { permission: 'inventory:write' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const body = await request.json();
    const { productId, delta, locationId, note } = body;

    if (!productId || delta == null) {
      return NextResponse.json({ error: 'productId and delta are required' }, { status: 400 });
    }

    const summary = await adjustStock({
      productId,
      delta: Number(delta),
      locationId: locationId || null,
      note: note || '',
      userId: auth.session.userId,
      actorRole: auth.session.role,
      request,
    });

    return NextResponse.json({ success: true, stock: summary });
  } catch (error) {
    console.error('Stock adjust error:', error);
    return NextResponse.json({ error: error.message || 'Adjustment failed' }, { status: 400 });
  }
}
