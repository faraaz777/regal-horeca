/**
 * unsetProductIsPremium.mjs
 *
 * One-shot migration: remove unused `isPremium` from all product documents.
 * Storefront `status` (In Stock / Out of Stock / Pre-Order) is intentionally left alone.
 *
 * Flags:
 *   --dry-run   Audit counts only; no writes.
 *   --uri=...   Override MONGODB_URI.
 *
 * Usage:
 *   node scripts/unsetProductIsPremium.mjs --dry-run
 *   node scripts/unsetProductIsPremium.mjs
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
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    // Best effort
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const URI_FLAG = args.find((a) => a.startsWith('--uri='));
const URI = URI_FLAG ? URI_FLAG.replace('--uri=', '') : process.env.MONGODB_URI || '';

if (!URI) {
  console.error('MONGODB_URI is required (env var or --uri=...)');
  process.exit(1);
}

async function main() {
  await mongoose.connect(URI);
  const col = mongoose.connection.collection('products');

  const withField = await col.countDocuments({ isPremium: { $exists: true } });
  const premiumTrue = await col.countDocuments({ isPremium: true });
  const premiumFalse = await col.countDocuments({ isPremium: false });

  console.log('isPremium audit');
  console.log(`  documents with field: ${withField}`);
  console.log(`  isPremium === true:   ${premiumTrue}`);
  console.log(`  isPremium === false:  ${premiumFalse}`);

  if (premiumTrue > 0) {
    const samples = await col
      .find({ isPremium: true }, { projection: { title: 1, slug: 1, isPremium: 1 } })
      .limit(20)
      .toArray();
    console.log('  samples (isPremium true):');
    for (const doc of samples) {
      console.log(`    - ${doc.slug || doc._id} | ${doc.title || ''}`);
    }
  }

  if (DRY_RUN) {
    console.log('\nDry run — no writes. Re-run without --dry-run to $unset isPremium.');
    await mongoose.disconnect();
    return;
  }

  if (withField === 0) {
    console.log('\nNothing to unset.');
    await mongoose.disconnect();
    return;
  }

  /**
   * Drop the dead flag everywhere. True/false both go — Premium collection is retired.
   * Do not touch `status` (Usually Available / Pre-Order / SEO).
   */
  const result = await col.updateMany({ isPremium: { $exists: true } }, { $unset: { isPremium: '' } });
  console.log(`\nUnset isPremium on ${result.modifiedCount} document(s) (matched ${result.matchedCount}).`);

  const remaining = await col.countDocuments({ isPremium: { $exists: true } });
  console.log(`Remaining with isPremium: ${remaining}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
