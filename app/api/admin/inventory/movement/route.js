import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { recordStockMovement } from '@/lib/server/inventory/inventoryService';
import {
  MOVEMENT_REASONS,
  ADD_MOVEMENT_REASONS,
  MINUS_MOVEMENT_REASONS,
  INTAKE_STATUS_BUCKETS,
} from '@/lib/shared/inventoryConstants';

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

    if (!['add', 'minus', 'transfer'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (reason) {
      const allowedReasons =
        action === 'add'
          ? ADD_MOVEMENT_REASONS
          : action === 'minus'
            ? MINUS_MOVEMENT_REASONS
            : MOVEMENT_REASONS;
      if (!allowedReasons.includes(reason)) {
        return NextResponse.json({ error: 'Invalid reason' }, { status: 400 });
      }
    }

    // Add: sellable | dead_stock. Minus/transfer: always sellable.
    let effectiveBucket = 'sellable';
    if (action === 'add') {
      effectiveBucket = statusBucket || 'sellable';
      if (!INTAKE_STATUS_BUCKETS.includes(effectiveBucket)) {
        return NextResponse.json(
          { error: 'Add stock must be sellable or dead_stock' },
          { status: 400 }
        );
      }
    }

    const stock = await recordStockMovement({
      productId,
      action,
      quantity: Number(quantity),
      statusBucket: effectiveBucket,
      reason: reason || (action === 'minus' ? 'sold' : 'manual_adjustment'),
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
