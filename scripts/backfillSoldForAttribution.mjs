/**
 * Credit historic request-driven sales to the salesman who raised them.
 *
 * Sold rows written before Sold For existed have no attribution, so reports
 * cannot say whose sale they were. Request-driven sales are recoverable: the
 * sold row carries the request number, and the request records its salesman.
 *
 * Manual Sold movements are NOT recoverable — nobody was ever asked. Those
 * stay blank and are reported as unmatched so the gap is visible rather than
 * guessed at.
 *
 * The salesman's name is taken from the request as it was recorded at submit
 * time, not from the user's current name, so the row reflects who they were
 * when the sale happened.
 *
 * REPORTS ONLY by default. Nothing is written until --apply is passed.
 *
 * Usage:
 *   node scripts/backfillSoldForAttribution.mjs
 *   node scripts/backfillSoldForAttribution.mjs --apply
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

const FULFILL_REMARK = /^Fulfill\s+(.+)$/;

/** Request number from `ref`, falling back to the older remark wording. */
function requestNumberOf(row) {
  if (row.ref) return String(row.ref).trim();
  const match = FULFILL_REMARK.exec(row.remark || '');
  return match ? match[1].trim() : null;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const ledger = db.collection('stockledgers');
  const requests = db.collection('inventoryrequests');

  /**
   * Only sold rows still missing attribution. Already-credited rows are left
   * alone so the script is safe to run more than once.
   */
  const unattributed = await ledger
    .find({
      type: 'sale_fulfill',
      $or: [{ soldForUserId: null }, { soldForUserId: { $exists: false } }],
    })
    .project({ ref: 1, remark: 1, qty: 1 })
    .toArray();

  if (unattributed.length === 0) {
    console.log('\nEvery sold row already has attribution. Nothing to do.\n');
    await mongoose.disconnect();
    return;
  }

  const byRequest = new Map();
  let manualRows = 0;
  let manualQty = 0;

  for (const row of unattributed) {
    const requestNumber = requestNumberOf(row);
    if (!requestNumber || !requestNumber.startsWith('SR-')) {
      manualRows += 1;
      manualQty += row.qty || 0;
      continue;
    }
    if (!byRequest.has(requestNumber)) {
      byRequest.set(requestNumber, { rows: 0, qty: 0 });
    }
    const bucket = byRequest.get(requestNumber);
    bucket.rows += 1;
    bucket.qty += row.qty || 0;
  }

  const requestDocs = await requests
    .find({ requestNumber: { $in: [...byRequest.keys()] } })
    .project({ requestNumber: 1, salesUserId: 1, salesUserName: 1 })
    .toArray();

  const requestByNumber = new Map(requestDocs.map((r) => [r.requestNumber, r]));

  const bySalesUser = new Map();
  const orphaned = [];

  for (const [requestNumber, bucket] of byRequest) {
    const request = requestByNumber.get(requestNumber);
    if (!request?.salesUserId) {
      orphaned.push({ requestNumber, ...bucket });
      continue;
    }

    const key = String(request.salesUserId);
    if (!bySalesUser.has(key)) {
      bySalesUser.set(key, {
        salesUserId: key,
        salesUserName: request.salesUserName || '(unnamed)',
        requests: [],
        rows: 0,
        qty: 0,
      });
    }
    const entry = bySalesUser.get(key);
    entry.requests.push(requestNumber);
    entry.rows += bucket.rows;
    entry.qty += bucket.qty;
  }

  console.log(`\n=== Sold For backfill ${apply ? '(APPLYING)' : '(REPORT ONLY)'} ===`);
  console.log(`\nSold rows without attribution: ${unattributed.length}`);

  if (bySalesUser.size === 0) {
    console.log('\nNone of them can be traced to a sales request.');
  } else {
    console.log('\nCan be credited:\n');
    for (const entry of [...bySalesUser.values()].sort((a, b) => b.qty - a.qty)) {
      console.log(
        `  ${entry.salesUserName}: ${entry.qty} pcs across ${entry.rows} row(s), ` +
          `${entry.requests.length} request(s)`
      );
    }
  }

  if (orphaned.length > 0) {
    console.log(
      `\nRequest number present but no matching request found (${orphaned.length}):\n` +
        orphaned.map((o) => `  ${o.requestNumber}: ${o.qty} pcs`).join('\n')
    );
  }

  if (manualRows > 0) {
    console.log(
      `\nManual Sold movements — no request to trace, will stay blank: ` +
        `${manualRows} row(s), ${manualQty} pcs`
    );
  }

  const reportPath = resolve(__dirname, `_sold-for-backfill-${Date.now()}.json`);
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        applied: apply,
        unattributedRows: unattributed.length,
        creditable: [...bySalesUser.values()],
        orphaned,
        manual: { rows: manualRows, qty: manualQty },
      },
      null,
      2
    )
  );
  console.log(`\nReport saved: ${reportPath}`);

  if (!apply) {
    console.log('\nNo database changes were made. Re-run with --apply to write.\n');
    await mongoose.disconnect();
    return;
  }

  let updated = 0;
  for (const entry of bySalesUser.values()) {
    for (const requestNumber of entry.requests) {
      /**
       * Matched the same way they were found, so a row whose number lives
       * only in the remark is still updated.
       */
      const result = await ledger.updateMany(
        {
          type: 'sale_fulfill',
          $or: [{ soldForUserId: null }, { soldForUserId: { $exists: false } }],
          $and: [
            {
              $or: [{ ref: requestNumber }, { remark: `Fulfill ${requestNumber}` }],
            },
          ],
        },
        {
          $set: {
            soldForUserId: new mongoose.Types.ObjectId(entry.salesUserId),
            soldForName: entry.salesUserName === '(unnamed)' ? '' : entry.salesUserName,
          },
        }
      );
      updated += result.modifiedCount;
    }
  }

  console.log(`\nCredited ${updated} sold row(s).\n`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
