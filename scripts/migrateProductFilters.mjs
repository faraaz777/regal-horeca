/**
 * migrateProductFilters.mjs
 *
 * One-shot migration: legacy `filters` stored as a plain object
 * `{ material: [], color: [], ... }` -> array form `[{ key, values[] }, ...]`
 * aligned with POST/PUT normalization and facet queries.
 *
 * Flags:
 *   --dry-run   Log matches and planned writes; no DB updates.
 *   --limit=N   Process at most N documents.
 *   --uri=...   Override MONGODB_URI.
 *
 * Usage:
 *   node scripts/migrateProductFilters.mjs --dry-run
 *   node scripts/migrateProductFilters.mjs
 */

import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import { normalizeFilterValues } from '../lib/shared/normalizeFilterValue.js';

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
const LIMIT_FLAG = args.find((a) => a.startsWith('--limit='));
const URI = URI_FLAG ? URI_FLAG.replace('--uri=', '') : (process.env.MONGODB_URI || '');
const LIMIT = LIMIT_FLAG ? parseInt(LIMIT_FLAG.replace('--limit=', ''), 10) : Infinity;

if (!URI) {
  console.error('MONGODB_URI is required (env var or --uri=...)');
  process.exit(1);
}

const ProductModulePath = pathToFileURL(path.resolve(process.cwd(), 'lib/models/Product.js')).href;

/** Same rules as lib/server/products/normalizeProductInput.js `normalizeFiltersField` */
function legacyObjectToFilterArray(filters) {
  if (!filters || typeof filters !== 'object') return [];
  const oldFilters = filters;
  const out = [];
  if (oldFilters.material && Array.isArray(oldFilters.material) && oldFilters.material.length > 0) {
    out.push({ key: 'Material', values: normalizeFilterValues(oldFilters.material) });
  }
  if (oldFilters.size && Array.isArray(oldFilters.size) && oldFilters.size.length > 0) {
    out.push({ key: 'Size', values: normalizeFilterValues(oldFilters.size) });
  }
  if (oldFilters.color && Array.isArray(oldFilters.color) && oldFilters.color.length > 0) {
    out.push({ key: 'Color', values: normalizeFilterValues(oldFilters.color) });
  }
  if (oldFilters.usage && Array.isArray(oldFilters.usage) && oldFilters.usage.length > 0) {
    out.push({ key: 'Usage', values: normalizeFilterValues(oldFilters.usage) });
  }
  Object.keys(oldFilters).forEach((key) => {
    if (['material', 'size', 'color', 'usage'].includes(key.toLowerCase())) return;
    if (Array.isArray(oldFilters[key]) && oldFilters[key].length > 0) {
      out.push({
        key: key.charAt(0).toUpperCase() + key.slice(1),
        values: normalizeFilterValues(oldFilters[key]),
      });
    }
  });
  return out;
}

async function main() {
  const { default: Product } = await import(ProductModulePath);

  await mongoose.connect(URI, { autoIndex: false });
  console.log(`[migrate-product-filters] Connected. dryRun=${DRY_RUN}`);

  const query = {
    filters: { $exists: true, $type: 'object' },
  };

  const total = await Product.countDocuments(query);
  console.log(`[migrate-product-filters] Documents with object-shaped filters: ${total}`);

  let updated = 0;
  const cursor = Product.find(query).select('_id slug filters').cursor();

  for await (const doc of cursor) {
    if (updated >= LIMIT) break;

    const next = legacyObjectToFilterArray(doc.filters);
    console.log(
      `[migrate-product-filters] ${doc.slug || doc._id}  keys=${Object.keys(doc.filters || {}).length}  -> ${next.length} filter row(s)`
    );

    if (!DRY_RUN) {
      await Product.updateOne({ _id: doc._id }, { $set: { filters: next } });
    }
    updated += 1;
  }

  console.log(`[migrate-product-filters] Done. ${DRY_RUN ? 'Would update' : 'Updated'} ${updated} document(s).`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
