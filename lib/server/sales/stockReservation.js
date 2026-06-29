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
 * Move qty from sellable → hold for an approved request line.
 */
export async function reserveLineStock({ productId, qty, userId, requestNumber }) {
  if (!qty || qty <= 0) return { skipped: true };

  return runInTransaction(async (session) => {
    const locationId = await pickSellableLocation(productId, session);
    if (!locationId) {
      throw new Error('No sellable stock location found for reservation');
    }

    const remark = `Reserve ${requestNumber}`;
    const base = {
      productId: new mongoose.Types.ObjectId(String(productId)),
      locationId,
      performedBy: new mongoose.Types.ObjectId(String(userId)),
      remark,
    };

    await appendLedgerEntry(
      { ...base, type: 'reservation_hold', statusBucket: 'sellable', qty: -qty },
      session
    );
    await appendLedgerEntry(
      { ...base, type: 'reservation_hold', statusBucket: 'hold', qty },
      session
    );

    return { locationId: String(locationId), qty };
  });
}

/**
 * Release hold qty on fulfill (sale completed).
 */
export async function fulfillLineStock({ productId, qty, userId, requestNumber }) {
  if (!qty || qty <= 0) return { skipped: true };

  return runInTransaction(async (session) => {
    const rows = await Stock.find({
      productId,
      statusBucket: 'hold',
      qty: { $gt: 0 },
    })
      .sort({ qty: -1 })
      .session(session)
      .lean();

    if (rows.length === 0) {
      throw new Error('No hold stock found to fulfill');
    }

    const locationId = rows[0].locationId;
    const remark = `Fulfill ${requestNumber}`;

    await appendLedgerEntry(
      {
        productId: new mongoose.Types.ObjectId(String(productId)),
        locationId,
        type: 'sale_fulfill',
        statusBucket: 'hold',
        qty: -qty,
        performedBy: new mongoose.Types.ObjectId(String(userId)),
        remark,
      },
      session
    );

    return { locationId: String(locationId), qty };
  });
}
