/**
 * Report sellable stock that a sales request took out and never gave back.
 *
 * READ ONLY. This script writes nothing to the database. It prints a report
 * and saves a JSON copy next to itself for review.
 *
 * Two kinds of loss are detected, both caused by approve deducting sellable
 * stock while nothing ever reversed it:
 *
 *   1. NEVER RELEASED — the request was cancelled or rejected after approval.
 *      The pieces are still on the rack physically, but the system believes
 *      they are gone.
 *
 *   2. OVER RESERVED — more stock was deducted than the request approved.
 *      This is the fingerprint of a failed approve that was retried: the
 *      lines that succeeded the first time were deducted a second time.
 *
 * Reservation rows are matched by request number, which lives in `ref` on
 * newer rows and only in `remark` on older ones.
 *
 * Usage:
 *   node scripts/reportLostReservedStock.mjs
 */

import mongoose from 'mongoose';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const envPath = resolve(__dirname, '../.env.local');
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const RESERVE_REMARK = /^Reserve\s+(.+)$/;
const RACK_CORRECTION_REMARK = /^Rack correction\s+/;

/** Request number from `ref`, falling back to the older remark wording. */
function requestNumberOf(row) {
  if (row.ref) return row.ref;
  const match = RESERVE_REMARK.exec(row.remark || '');
  return match ? match[1].trim() : null;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const names = (await db.listCollections().toArray()).map((c) => c.name);
  for (const required of ['stockledgers', 'inventoryrequests']) {
    if (!names.includes(required)) {
      console.error(`Collection "${required}" not found. Nothing to report.`);
      await mongoose.disconnect();
      process.exit(1);
    }
  }

  const ledger = db.collection('stockledgers');
  const requests = db.collection('inventoryrequests');
  const products = db.collection('products');

  /**
   * `reservation_hold` is the retired reservation shape. It wrote the same
   * negative sellable row plus a positive row in a `hold` bucket that no
   * longer counts, so only the sellable side matters here.
   *
   * Reason is deliberately not filtered — legacy rows used
   * `manual_adjustment`. The request number carried in ref/remark is what
   * separates a reservation from an ordinary manual removal.
   */
  const reservations = await ledger
    .find({
      type: { $in: ['adjustment_minus', 'reservation_hold'] },
      statusBucket: 'sellable',
      qty: { $lt: 0 },
      /**
       * Fulfilment writes the same shape with the same request number when the
       * goods came off a different rack than approve picked. That is a pick
       * correction, not stock still being held.
       */
      remark: { $not: RACK_CORRECTION_REMARK },
    })
    .project({ productId: 1, locationId: 1, qty: 1, ref: 1, remark: 1, createdAt: 1 })
    .toArray();

  /**
   * Manual Sold movements share the same shape as a reservation, so anything
   * without a recoverable request number is skipped rather than guessed at.
   */
  const byRequest = new Map();
  for (const row of reservations) {
    const requestNumber = requestNumberOf(row);
    if (!requestNumber || !requestNumber.startsWith('SR-')) continue;
    if (!byRequest.has(requestNumber)) byRequest.set(requestNumber, []);
    byRequest.get(requestNumber).push(row);
  }

  if (byRequest.size === 0) {
    console.log('No request-linked reservations found. Nothing to report.');
    await mongoose.disconnect();
    return;
  }

  const requestNumbers = [...byRequest.keys()];

  const requestDocs = await requests
    .find({ requestNumber: { $in: requestNumbers } })
    .project({ requestNumber: 1, status: 1, salesUserName: 1, lines: 1, reviewedAt: 1, fulfilledAt: 1 })
    .toArray();
  const requestByNumber = new Map(requestDocs.map((r) => [r.requestNumber, r]));

  const releaseRows = await ledger
    .find({ type: 'adjustment_add', reason: 'sales_return', ref: { $in: requestNumbers } })
    .project({ ref: 1, qty: 1 })
    .toArray();
  const releasedByRequest = new Map();
  for (const row of releaseRows) {
    releasedByRequest.set(row.ref, (releasedByRequest.get(row.ref) || 0) + Math.abs(row.qty));
  }

  const neverReleased = [];
  const overReserved = [];
  const stillHeld = [];

  for (const [requestNumber, rows] of byRequest) {
    const doc = requestByNumber.get(requestNumber);
    if (!doc) continue;

    const reservedQty = sum(rows.map((r) => Math.abs(r.qty)));
    const releasedQty = releasedByRequest.get(requestNumber) || 0;
    const approvedQty = sum((doc.lines || []).map((l) => l.approvedQty || 0));

    if (['cancelled', 'rejected'].includes(doc.status) && releasedQty === 0) {
      neverReleased.push({
        requestNumber,
        status: doc.status,
        salesUser: doc.salesUserName || '',
        reservedQty,
        productIds: [...new Set(rows.map((r) => String(r.productId)))],
        firstReservedAt: rows.map((r) => r.createdAt).sort()[0],
      });
    }

    /**
     * Not a loss — an approved request is meant to be holding stock. Listed
     * because a request left open for months holds stock indefinitely, and
     * these are the ones a release would act on if they were closed.
     */
    if (['approved', 'partially_approved'].includes(doc.status)) {
      stillHeld.push({
        requestNumber,
        status: doc.status,
        salesUser: doc.salesUserName || '',
        reservedQty,
        productIds: [...new Set(rows.map((r) => String(r.productId)))],
        firstReservedAt: rows.map((r) => r.createdAt).sort()[0],
      });
    }

    if (reservedQty > approvedQty + releasedQty) {
      overReserved.push({
        requestNumber,
        status: doc.status,
        salesUser: doc.salesUserName || '',
        reservedQty,
        approvedQty,
        releasedQty,
        excessQty: reservedQty - approvedQty - releasedQty,
        productIds: [...new Set(rows.map((r) => String(r.productId)))],
      });
    }
  }

  const allProductIds = [
    ...new Set([
      ...neverReleased.flatMap((r) => r.productIds),
      ...overReserved.flatMap((r) => r.productIds),
      ...stillHeld.flatMap((r) => r.productIds),
    ]),
  ].map((id) => new mongoose.Types.ObjectId(id));

  const productDocs = allProductIds.length
    ? await products
        .find({ _id: { $in: allProductIds } })
        .project({ title: 1, sku: 1 })
        .toArray()
    : [];
  const productById = new Map(
    productDocs.map((p) => [String(p._id), `${p.title || 'Untitled'} (${p.sku || 'no sku'})`])
  );

  const describe = (ids) => ids.map((id) => productById.get(id) || id);

  console.log('\n=== Stock reserved and never returned ===');
  if (neverReleased.length === 0) {
    console.log('None. Nothing was lost to cancelled or rejected approvals.');
  } else {
    for (const row of neverReleased) {
      console.log(
        `\n${row.requestNumber}  [${row.status}]  ${row.salesUser}` +
          `\n  missing from sellable: ${row.reservedQty}` +
          `\n  reserved on: ${row.firstReservedAt ? new Date(row.firstReservedAt).toISOString() : 'unknown'}` +
          `\n  products: ${describe(row.productIds).join(', ')}`
      );
    }
    console.log(
      `\nTotal pieces missing from sellable: ${sum(neverReleased.map((r) => r.reservedQty))}` +
        ` across ${neverReleased.length} request(s).`
    );
  }

  console.log('\n=== Deducted more than was approved (retried approve) ===');
  if (overReserved.length === 0) {
    console.log('None. No request deducted more than it approved.');
  } else {
    for (const row of overReserved) {
      console.log(
        `\n${row.requestNumber}  [${row.status}]  ${row.salesUser}` +
          `\n  deducted ${row.reservedQty}, approved ${row.approvedQty}, released ${row.releasedQty}` +
          `\n  excess: ${row.excessQty}` +
          `\n  products: ${describe(row.productIds).join(', ')}`
      );
    }
    console.log(
      `\nTotal excess pieces deducted: ${sum(overReserved.map((r) => r.excessQty))}` +
        ` across ${overReserved.length} request(s).`
    );
  }

  console.log('\n=== Still held by an open request (not a loss) ===');
  if (stillHeld.length === 0) {
    console.log('None. No approved request is holding stock.');
  } else {
    for (const row of stillHeld) {
      console.log(
        `\n${row.requestNumber}  [${row.status}]  ${row.salesUser}` +
          `\n  held out of sellable: ${row.reservedQty}` +
          `\n  reserved on: ${row.firstReservedAt ? new Date(row.firstReservedAt).toISOString() : 'unknown'}` +
          `\n  products: ${describe(row.productIds).join(', ')}`
      );
    }
    console.log(
      `\nTotal pieces held by open requests: ${sum(stillHeld.map((r) => r.reservedQty))}` +
        ` across ${stillHeld.length} request(s).`
    );
  }

  const reportPath = resolve(__dirname, `_lost-reserved-stock-${Date.now()}.json`);
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        requestsScanned: byRequest.size,
        neverReleased,
        overReserved,
        stillHeld,
      },
      null,
      2
    )
  );

  console.log(`\nScanned ${byRequest.size} request(s) with reservations.`);
  console.log(`Report saved: ${reportPath}`);
  console.log('No database changes were made.\n');

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
