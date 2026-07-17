import 'server-only';

import mongoose from 'mongoose';
import Stock from '@/lib/models/Stock';
import {
  appendLedgerEntry,
  runInTransaction,
} from '@/lib/server/inventory/stockLedgerService';

async function pickSellableLocation(productId, session) {
  const rows = await Stock.find({
    productId,
    statusBucket: 'sellable',
    qty: { $gt: 0 },
  })
    .sort({ qty: -1 })
    .session(session)
    .lean();

  if (rows.length === 0) return null;
  return rows[0].locationId;
}

/**
 * Soft-commit sellable stock for an approved request: deduct sellable immediately.
 * Hold bucket no longer exists — reservation is a negative sellable movement.
 */
export async function reserveLineStock({ productId, qty, userId, requestNumber }) {
  if (!qty || qty <= 0) return { skipped: true };

  return runInTransaction(async (session) => {
    const locationId = await pickSellableLocation(productId, session);
    if (!locationId) {
      throw new Error('No sellable stock location found for reservation');
    }

    await appendLedgerEntry(
      {
        productId: new mongoose.Types.ObjectId(String(productId)),
        locationId,
        type: 'adjustment_minus',
        statusBucket: 'sellable',
        qty: -qty,
        reason: 'sold',
        remark: `Reserve ${requestNumber}`,
        performedBy: new mongoose.Types.ObjectId(String(userId)),
      },
      session
    );

    return { locationId: String(locationId), qty };
  });
}

/**
 * Mark reserved qty as sold history (sellable already deducted on approve).
 */
export async function fulfillLineStock({ productId, qty, userId, requestNumber }) {
  if (!qty || qty <= 0) return { skipped: true };

  return runInTransaction(async (session) => {
    const locationId = await pickSellableLocation(productId, session);

    // Prefer a sellable location for sold history anchoring; fall back to any stocked rack.
    let loc = locationId;
    if (!loc) {
      const any = await Stock.find({ productId, qty: { $gt: 0 } })
        .sort({ qty: -1 })
        .session(session)
        .lean();
      loc = any[0]?.locationId;
    }
    if (!loc) {
      throw new Error('No stock location found to record sale');
    }

    await appendLedgerEntry(
      {
        productId: new mongoose.Types.ObjectId(String(productId)),
        locationId: loc,
        type: 'sale_fulfill',
        statusBucket: 'sold',
        qty,
        reason: 'sold',
        remark: `Fulfill ${requestNumber}`,
        performedBy: new mongoose.Types.ObjectId(String(userId)),
      },
      session
    );

    return { locationId: String(loc), qty };
  });
}
