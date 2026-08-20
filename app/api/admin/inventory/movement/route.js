import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import {
  recordStockMovement,
  recordBatchStockMinus,
  recordBatchStockAdd,
} from '@/lib/server/inventory/inventoryService';
import {
  MOVEMENT_REASONS,
  ADD_MOVEMENT_REASONS,
  MINUS_MOVEMENT_REASONS,
  MAX_MOVEMENT_LINES,
  MAX_MOVEMENT_REMARK_LENGTH,
  MAX_MOVEMENT_REF_LENGTH,
} from '@/lib/shared/inventoryConstants';
import { resolveSoldForUser } from '@/lib/server/users/userService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/inventory/movement
 *
 * Posts add, minus (batch lines supported), or transfer.
 * Caps batch size and remark/ref length to keep payloads bounded.
 *
 * Permissions: inventory:write
 */
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
      reason,
      locationId,
      fromLocationId,
      toLocationId,
      lines,
    } = body;

    const remark = String(body.remark || '');
    const ref = String(body.ref || '');

    if (!productId || !action) {
      return NextResponse.json(
        { error: 'productId and action are required' },
        { status: 400 }
      );
    }

    if (!['add', 'minus', 'transfer'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (remark.length > MAX_MOVEMENT_REMARK_LENGTH) {
      return NextResponse.json(
        { error: `Remark must be ${MAX_MOVEMENT_REMARK_LENGTH} characters or fewer` },
        { status: 400 }
      );
    }

    if (ref.length > MAX_MOVEMENT_REF_LENGTH) {
      return NextResponse.json(
        { error: `Reference must be ${MAX_MOVEMENT_REF_LENGTH} characters or fewer` },
        { status: 400 }
      );
    }

    if (Array.isArray(lines) && lines.length > MAX_MOVEMENT_LINES) {
      return NextResponse.json(
        { error: `At most ${MAX_MOVEMENT_LINES} locations per movement` },
        { status: 400 }
      );
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

    /**
     * A Sold movement has to say whose sale it is, so reports can separate the
     * staff member credited with the sale from whoever keyed it in. The other
     * minus reasons — manual adjustment, showroom, other — are not sales and
     * are never asked.
     */
    let soldFor = null;
    if (action === 'minus' && (reason || 'sold') === 'sold') {
      try {
        soldFor = await resolveSoldForUser(body.soldForUserId);
      } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    }

    if (
      action === 'minus' &&
      Array.isArray(lines) &&
      lines.length > 0
    ) {
      const stock = await recordBatchStockMinus({
        productId,
        lines,
        reason: reason || 'sold',
        remark,
        ref,
        soldFor,
        userId: auth.session.userId,
        actorRole: auth.session.role,
        request,
      });
      return NextResponse.json({ success: true, stock });
    }

    if (
      action === 'add' &&
      Array.isArray(lines) &&
      lines.length > 0
    ) {
      const stock = await recordBatchStockAdd({
        productId,
        lines,
        reason: reason || 'purchase',
        remark,
        ref,
        userId: auth.session.userId,
        actorRole: auth.session.role,
        request,
      });
      return NextResponse.json({ success: true, stock });
    }

    // Physical movements always on-hand (sellable). Dead stock is a product tag only.
    const effectiveBucket = 'sellable';

    const stock = await recordStockMovement({
      productId,
      action,
      quantity: Number(quantity),
      statusBucket: effectiveBucket,
      reason: reason || (action === 'minus' ? 'sold' : 'manual_adjustment'),
      remark: remark || '',
      ref: ref || '',
      soldFor,
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
