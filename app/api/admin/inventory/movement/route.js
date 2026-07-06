import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { recordStockMovement } from '@/lib/server/inventory/inventoryService';
import { MOVEMENT_REASONS, ADD_MOVEMENT_REASONS, STATUS_BUCKETS } from '@/lib/shared/inventoryConstants';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = await requireAuth(request, { permission: 'inventory:write' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const body = await request.json();
    const {
      productId,
      action,
      quantity,
      statusBucket,
      fromBucket,
      toBucket,
      reason,
      remark,
      ref,
      locationId,
      fromLocationId,
      toLocationId,
    } = body;

    if (!productId || !action) {
      return NextResponse.json(
        { error: 'productId and action are required' },
        { status: 400 }
      );
    }

    if (!['add', 'minus', 'status_change', 'transfer'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (reason) {
      const allowedReasons = action === 'add' ? ADD_MOVEMENT_REASONS : MOVEMENT_REASONS;
      if (!allowedReasons.includes(reason)) {
        return NextResponse.json({ error: 'Invalid reason' }, { status: 400 });
      }
    }

    if (statusBucket && !STATUS_BUCKETS.includes(statusBucket)) {
      return NextResponse.json({ error: 'Invalid status bucket' }, { status: 400 });
    }

    const stock = await recordStockMovement({
      productId,
      action,
      quantity: Number(quantity),
      statusBucket: statusBucket || 'sellable',
      fromBucket: fromBucket || 'sellable',
      toBucket: toBucket || 'sellable',
      reason: reason || 'manual_adjustment',
      remark: remark || '',
      ref: ref || '',
      locationId: locationId || null,
      fromLocationId: fromLocationId || null,
      toLocationId: toLocationId || null,
      userId: auth.session.userId,
      actorRole: auth.session.role,
      request,
    });

    return NextResponse.json({ success: true, stock });
  } catch (error) {
    console.error('Stock movement error:', error);
    return NextResponse.json({ error: error.message || 'Movement failed' }, { status: 400 });
  }
}
