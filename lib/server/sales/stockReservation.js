import 'server-only';

import mongoose from 'mongoose';
import Stock from '@/lib/models/Stock';
import StockLedger from '@/lib/models/StockLedger';
import {
  appendLedgerEntry,
  runInTransaction,
} from '@/lib/server/inventory/stockLedgerService';
import { enrichStockRowsWithLocationPaths } from '@/lib/server/inventory/inventoryService';

/**
 * Stock Reservation
 *
 * Owns the stock side of the sales request lifecycle:
 * - approve  -> reserve (sellable goes down immediately)
 * - fulfil   -> sold history is written
 * - cancel   -> release (sellable comes back)
 * - reject   -> release (sellable comes back)
 *
 * Reservation happens at approve, not at fulfil, so two salespeople cannot
 * promise the same piece to two customers. That makes a release path
 * mandatory: any approved request that does not end in fulfilment must give
 * the stock back, or the pieces stay on the rack physically while the system
 * believes they are gone.
 *
 * Every request-driven ledger row carries the request number in `ref` so the
 * whole life of one request (reserve, release, fulfil) can be pulled with a
 * single indexed lookup. `remark` keeps the human-readable phrasing.
 */

/**
 * Spread `qty` across the product's sellable racks, largest rack first.
 *
 * Reservation used to take the entire qty out of one rack. When the request
 * exceeded that rack's holding, the rack went negative — and because the
 * Stock projection floors every rack at zero, the excess silently vanished
 * instead of failing. Splitting keeps every rack at or above zero, and a
 * genuine shortfall now throws instead of corrupting the count.
 */
async function allocateSellable(productId, qty, session) {
  const rows = await Stock.find({
    productId,
    statusBucket: 'sellable',
    qty: { $gt: 0 },
  })
    .sort({ qty: -1 })
    .session(session)
    .lean();

  const allocation = [];
  let remaining = qty;

  for (const row of rows) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, row.qty);
    allocation.push({ locationId: row.locationId, qty: take });
    remaining -= take;
  }

  if (remaining > 0) {
    throw new Error(`not enough sellable stock — short by ${remaining}`);
  }

  return allocation;
}

function rackCorrectionRemark(requestNumber) {
  return `Rack correction ${requestNumber}`;
}

/**
 * Ledger filter matching the sellable deductions a request made at approve.
 *
 * `reservation_hold` is the retired shape: it paired a negative sellable row
 * with a positive row in a `hold` bucket that no longer exists. Only the
 * sellable side ever counted towards stock, so only that side is matched.
 *
 * The request number is the discriminator, not the reason — legacy rows were
 * written with reason `manual_adjustment`. Rows approved before `ref` was
 * populated carry the number in `remark` only.
 */
export function reservationLedgerFilter(requestNumber) {
  return {
    type: { $in: ['adjustment_minus', 'reservation_hold'] },
    statusBucket: 'sellable',
    qty: { $lt: 0 },
    /**
     * A fulfilment correction that pulls more off a rack looks identical to a
     * reservation and carries the same `ref`. Excluding it keeps "what was
     * reserved" separate from "where it was actually picked".
     */
    remark: { $ne: rackCorrectionRemark(requestNumber) },
    $or: [{ ref: requestNumber }, { remark: `Reserve ${requestNumber}` }],
  };
}

/**
 * Which racks a request's stock was actually taken from, per product.
 *
 * Approve picks racks automatically, so this is the system's guess at where
 * the goods will come from. Fulfilment shows it back to the supervisor to
 * confirm or correct against what was physically pulled.
 *
 * Read before fulfilment, so no corrections or releases exist yet to net out:
 * a released request is cancelled or rejected and can no longer be fulfilled.
 */
export async function getReservationAllocation(requestNumber, session = null) {
  if (!requestNumber) return [];

  const query = StockLedger.find(reservationLedgerFilter(requestNumber)).select(
    'productId locationId qty'
  );
  if (session) query.session(session);
  const rows = await query.lean();

  const byProduct = new Map();
  for (const row of rows) {
    const productId = String(row.productId);
    const locationId = String(row.locationId);
    if (!byProduct.has(productId)) byProduct.set(productId, new Map());
    const locations = byProduct.get(productId);
    locations.set(locationId, (locations.get(locationId) || 0) + Math.abs(row.qty));
  }

  return [...byProduct.entries()].map(([productId, locations]) => ({
    productId,
    locations: [...locations.entries()].map(([locationId, qty]) => ({ locationId, qty })),
  }));
}

/** Sellable qty currently sitting at one rack, inside the caller's session. */
async function sellableQtyAt(productId, locationId, session) {
  const rows = await Stock.find({
    productId,
    locationId,
    statusBucket: 'sellable',
  })
    .session(session)
    .lean();

  return rows.reduce((total, row) => total + (row.qty || 0), 0);
}

/**
 * Anchor sold history to a rack that currently holds the product.
 *
 * Only used when the caller supplies no rack information and the request has
 * no reservation to fall back on. Sold rows only ever add to the `sold`
 * bucket, so this choice cannot push a rack negative — it only decides which
 * rack the sale is reported against.
 */
async function pickSoldAnchorLocation(productId, session) {
  const sellable = await Stock.find({
    productId,
    statusBucket: 'sellable',
    qty: { $gt: 0 },
  })
    .sort({ qty: -1 })
    .session(session)
    .lean();

  if (sellable.length > 0) return sellable[0].locationId;

  const anyStocked = await Stock.find({ productId, qty: { $gt: 0 } })
    .sort({ qty: -1 })
    .session(session)
    .lean();

  if (anyStocked.length === 0) {
    throw new Error('no stock location found to record the sale against');
  }

  return anyStocked[0].locationId;
}

/**
 * Names the failing product so the supervisor sees which line blocked the
 * whole request rather than a bare stock error.
 */
function decorateLineError(err, line) {
  const error = new Error(
    line.productTitle ? `${line.productTitle}: ${err.message}` : err.message
  );
  error.productId = String(line.productId);
  return error;
}

function toObjectId(value) {
  return new mongoose.Types.ObjectId(String(value));
}

/**
 * Reserve every approved line in ONE transaction.
 *
 * Each line used to reserve in its own transaction inside a loop, so a
 * failure part-way through left the earlier lines already deducted while the
 * request stayed `submitted`. Approving again then deducted those lines a
 * second time. All-or-nothing removes that entire class of double deduction.
 */
export async function reserveRequestLines({ requestNumber, userId, lines = [] }) {
  const payable = lines.filter((line) => Number(line.qty) > 0);
  if (payable.length === 0) return { reserved: [] };

  return runInTransaction(async (session) => {
    const reserved = [];

    for (const line of payable) {
      try {
        const allocation = await allocateSellable(
          line.productId,
          Number(line.qty),
          session
        );

        for (const slice of allocation) {
          await appendLedgerEntry(
            {
              productId: toObjectId(line.productId),
              locationId: slice.locationId,
              type: 'adjustment_minus',
              statusBucket: 'sellable',
              qty: -slice.qty,
              reason: 'sold',
              remark: `Reserve ${requestNumber}`,
              ref: requestNumber,
              performedBy: toObjectId(userId),
            },
            session
          );
        }

        reserved.push({ productId: String(line.productId), allocation });
      } catch (err) {
        throw decorateLineError(err, line);
      }
    }

    return { reserved };
  });
}

/**
 * Racks a fulfilled line should be recorded against, in preference order:
 *
 * 1. What the supervisor confirmed on screen — they physically pulled it.
 * 2. What approve reserved, when the caller sends no racks. Keeps older
 *    clients working and is still more accurate than a single guess.
 * 3. Handled by the caller: a single anchor rack, for requests that have no
 *    reservation rows at all.
 */
function resolveFulfilLocations(line, reservedLocations) {
  const confirmed = (line.locations || []).filter((l) => Number(l.qty) > 0);
  if (confirmed.length > 0) {
    return confirmed.map((l) => ({
      locationId: String(l.locationId),
      qty: Number(l.qty),
    }));
  }
  return reservedLocations.map((l) => ({ locationId: String(l.locationId), qty: l.qty }));
}

/**
 * Record the sale for every fulfilled line in ONE transaction.
 *
 * Sellable was already deducted at approve, so fulfilment must NOT deduct
 * again — doing that by hand afterwards is what double-counted stock. It only
 * writes the sold history, plus a correction when the goods actually came off
 * a different rack than approve guessed.
 *
 * Corrections are the difference only: confirming approve's guess unchanged
 * writes no correction rows at all. Give-backs are applied before take-mores
 * so stock returned to one rack is available to the rack that needs it.
 *
 * `soldFor` credits the sale to the salesman who raised the request, rather
 * than the inventory staff who pressed the button. It lands on the sold rows
 * only — a rack correction is stock bookkeeping, not part of the sale.
 */
export async function fulfillRequestLines({
  requestNumber,
  userId,
  lines = [],
  soldFor = null,
}) {
  const payable = lines.filter((line) => Number(line.qty) > 0);
  if (payable.length === 0) return { fulfilled: [], corrections: [] };

  return runInTransaction(async (session) => {
    const reservedByProduct = new Map(
      (await getReservationAllocation(requestNumber, session)).map((entry) => [
        entry.productId,
        entry.locations,
      ])
    );

    const fulfilled = [];
    const corrections = [];

    for (const line of payable) {
      try {
        const productId = String(line.productId);
        const reserved = reservedByProduct.get(productId) || [];
        let allocation = resolveFulfilLocations(line, reserved);

        if (allocation.length === 0) {
          const anchor = await pickSoldAnchorLocation(line.productId, session);
          allocation = [{ locationId: String(anchor), qty: Number(line.qty) }];
        }

        const reservedMap = new Map(reserved.map((l) => [String(l.locationId), l.qty]));
        const confirmedMap = new Map(allocation.map((l) => [l.locationId, l.qty]));

        const diffs = [...new Set([...reservedMap.keys(), ...confirmedMap.keys()])]
          .map((locationId) => ({
            locationId,
            diff: (confirmedMap.get(locationId) || 0) - (reservedMap.get(locationId) || 0),
          }))
          .filter((entry) => entry.diff !== 0)
          .sort((a, b) => a.diff - b.diff);

        for (const { locationId, diff } of diffs) {
          if (diff > 0) {
            const available = await sellableQtyAt(line.productId, locationId, session);
            if (diff > available) {
              throw new Error(
                `a rack was assigned ${diff} more than it holds (${available} available)`
              );
            }
          }

          await appendLedgerEntry(
            {
              productId: toObjectId(productId),
              locationId: toObjectId(locationId),
              type: diff > 0 ? 'adjustment_minus' : 'adjustment_add',
              statusBucket: 'sellable',
              qty: -diff,
              reason: diff > 0 ? 'sold' : 'manual_adjustment',
              remark: rackCorrectionRemark(requestNumber),
              ref: requestNumber,
              performedBy: toObjectId(userId),
            },
            session
          );

          corrections.push({ productId, locationId, qty: -diff });
        }

        for (const slice of allocation) {
          await appendLedgerEntry(
            {
              productId: toObjectId(productId),
              locationId: toObjectId(slice.locationId),
              type: 'sale_fulfill',
              statusBucket: 'sold',
              qty: slice.qty,
              reason: 'sold',
              remark: `Fulfill ${requestNumber}`,
              ref: requestNumber,
              performedBy: toObjectId(userId),
              soldForUserId: soldFor?.userId ? toObjectId(soldFor.userId) : null,
              soldForName: soldFor?.name || '',
            },
            session
          );

          fulfilled.push({ productId, locationId: slice.locationId, qty: slice.qty });
        }
      } catch (err) {
        throw decorateLineError(err, line);
      }
    }

    return { fulfilled, corrections };
  });
}

/**
 * Give back the sellable stock a request reserved at approve time.
 *
 * The ledger is append-only, so nothing is deleted: each reservation row is
 * mirrored by a positive `sales_return` row at the same rack. Both the
 * original deduction and its reversal stay visible in the movement history.
 *
 * Reversing the actual reservation rows — rather than re-deriving quantities
 * from the request — means the stock returns to exactly the racks it left,
 * even when a line was split across several racks.
 */
export async function releaseRequestReservations({ requestNumber, userId }) {
  if (!requestNumber) return { released: [], alreadyReleased: false };

  return runInTransaction(async (session) => {
    /**
     * Guards against a double release if cancel and reject race, or if a
     * caller retries after failing part-way through its own bookkeeping.
     */
    const existingRelease = await StockLedger.countDocuments({
      type: 'adjustment_add',
      reason: 'sales_return',
      ref: requestNumber,
    }).session(session);

    if (existingRelease > 0) {
      return { released: [], alreadyReleased: true };
    }

    const reservations = await StockLedger.find(reservationLedgerFilter(requestNumber))
      .session(session)
      .lean();

    const released = [];

    for (const row of reservations) {
      const qty = Math.abs(row.qty);
      if (qty === 0) continue;

      await appendLedgerEntry(
        {
          productId: row.productId,
          locationId: row.locationId,
          type: 'adjustment_add',
          statusBucket: 'sellable',
          qty,
          reason: 'sales_return',
          remark: `Release ${requestNumber}`,
          ref: requestNumber,
          performedBy: toObjectId(userId),
        },
        session
      );

      released.push({
        productId: String(row.productId),
        locationId: String(row.locationId),
        qty,
      });
    }

    return { released, alreadyReleased: false };
  });
}

/**
 * Rack picture for the fulfilment screen, one entry per approved line.
 *
 * Because approve already removed the goods, a rack that gave up its whole
 * holding now reads zero available while still carrying the reservation. Both
 * numbers are returned so the screen can show what is reserved where, and cap
 * each rack at what it holds plus what it already owes this request.
 */
export async function getFulfilmentRackPlan({ requestNumber, lines = [] }) {
  const payable = lines.filter((line) => Number(line.approvedQty) > 0);
  if (payable.length === 0) return [];

  const allocation = await getReservationAllocation(requestNumber);
  const reservedByProduct = new Map(allocation.map((e) => [e.productId, e.locations]));

  const stockRows = await Stock.find({
    productId: { $in: payable.map((line) => toObjectId(line.productId)) },
    statusBucket: 'sellable',
  })
    .select('productId locationId qty statusBucket')
    .lean();

  /**
   * Racks emptied by the reservation have no stock row left, but the pieces
   * are still assigned to them — they must appear or the supervisor cannot
   * move that quantity onto the rack it actually came from.
   */
  const seen = new Set(stockRows.map((r) => `${r.productId}|${r.locationId}`));
  const placeholders = [];
  for (const line of payable) {
    const productId = String(line.productId);
    for (const loc of reservedByProduct.get(productId) || []) {
      const key = `${productId}|${loc.locationId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      placeholders.push({
        productId: toObjectId(productId),
        locationId: toObjectId(loc.locationId),
        qty: 0,
        statusBucket: 'sellable',
      });
    }
  }

  /** Single enrich call for every line — `listAllLocations` is uncached. */
  const enriched = await enrichStockRowsWithLocationPaths([...stockRows, ...placeholders]);

  const rowsByProduct = new Map();
  for (const row of enriched) {
    const productId = String(row.productId);
    if (!rowsByProduct.has(productId)) rowsByProduct.set(productId, []);
    rowsByProduct.get(productId).push(row);
  }

  return payable.map((line) => {
    const productId = String(line.productId);
    const reserved = reservedByProduct.get(productId) || [];
    const reservedByLocation = new Map(reserved.map((l) => [String(l.locationId), l.qty]));

    const racks = (rowsByProduct.get(productId) || [])
      .map((row) => {
        const locationId = String(row.locationId);
        const available = row.qty || 0;
        const reservedQty = reservedByLocation.get(locationId) || 0;
        return {
          locationId,
          locationCode: row.locationCode || '',
          locationName: row.locationName || '',
          locationPath: row.locationPath || '',
          locationCodePath: row.locationCodePath || '',
          available,
          reservedQty,
          maxQty: available + reservedQty,
        };
      })
      .filter((rack) => rack.maxQty > 0)
      .sort((a, b) => b.maxQty - a.maxQty);

    return {
      lineId: String(line.lineId),
      productId,
      productTitle: line.productTitle || '',
      approvedQty: Number(line.approvedQty),
      reserved: reserved.map((l) => ({ locationId: String(l.locationId), qty: l.qty })),
      racks,
    };
  });
}
