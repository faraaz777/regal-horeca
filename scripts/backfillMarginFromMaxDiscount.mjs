/**
 * backfillMarginFromMaxDiscount.mjs
 *
 * Sales now uses Product.marginPrice as the salesman floor.
 * A few SKUs created via the old inventory shortcut may have
 * maxDiscountPercent set and an empty margin.
 *
 * This script copies that leftover % into marginPrice:
 *   marginPrice = sellingPrice × (1 − maxDiscountPercent / 100)
 *
 * Only updates rows where maxDiscountPercent > 0 AND marginPrice is 0/missing.
 * Does not overwrite a margin already set on Add/Edit Product.
 * Respects moneyInPaise so inventory-created paise SKUs stay in paise.
 *
 * Flags:
 *   --dry-run   Log only
 *   --uri=...   Override MONGODB_URI
 *
 * Usage:
 *   node scripts/backfillMarginFromMaxDiscount.mjs --dry-run
 *   node scripts/backfillMarginFromMaxDiscount.mjs
 */

import path from 'node:path';
import fs from 'node:fs';
import mongoose from 'mongoose';

function loadEnvFile(name) {
  try {
    const p = path.resolve(process.cwd(), name);
    if (!fs.existsSync(p)) return;
    const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    /* ignore */
  }
}

function parseArgs(argv) {
  const opts = { dryRun: false, uri: null };
  for (const arg of argv) {
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg.startsWith('--uri=')) opts.uri = arg.slice(6);
  }
  return opts;
}

function sellingAmount(doc) {
  const selling = Number(doc.sellingPrice || 0);
  if (selling > 0) return selling;
  return Number(doc.price || 0);
}

async function main() {
  loadEnvFile('.env.local');
  loadEnvFile('.env');
  const opts = parseArgs(process.argv.slice(2));
  const uri = opts.uri || process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI required');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const products = mongoose.connection.db.collection('products');

  const query = {
    maxDiscountPercent: { $gt: 0 },
    $or: [
      { marginPrice: { $exists: false } },
      { marginPrice: null },
      { marginPrice: 0 },
      { marginPrice: '' },
    ],
  };

  const rows = await products
    .find(query)
    .project({
      title: 1,
      sku: 1,
      sellingPrice: 1,
      price: 1,
      maxDiscountPercent: 1,
      marginPrice: 1,
      moneyInPaise: 1,
    })
    .toArray();

  console.log(`Candidates (maxDiscountPercent > 0, empty margin): ${rows.length}`);
  console.log(opts.dryRun ? 'DRY RUN — no writes' : 'WRITING…');

  let updated = 0;
  let skipped = 0;

  for (const doc of rows) {
    const selling = sellingAmount(doc);
    const maxDisc = Number(doc.maxDiscountPercent) || 0;
    if (!(selling > 0) || !(maxDisc > 0)) {
      skipped += 1;
      console.log(`SKIP ${doc.sku || doc._id} — missing selling price`);
      continue;
    }

    const marginPrice = Math.round(selling * (1 - maxDisc / 100));
    console.log(
      `${opts.dryRun ? 'WOULD UPDATE' : 'UPDATE'} ${doc.sku || doc._id} "${doc.title || ''}" ` +
        `maxDiscount=${maxDisc}% selling=${selling} → marginPrice=${marginPrice}` +
        `${doc.moneyInPaise ? ' (paise)' : ''}`
    );

    if (!opts.dryRun) {
      await products.updateOne(
        { _id: doc._id },
        { $set: { marginPrice } }
      );
    }
    updated += 1;
  }

  console.log(`Updated: ${updated}; skipped: ${skipped}`);
  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
