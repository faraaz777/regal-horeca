/**
 * migrateVariantsToChildren.mjs
 *
 * Idempotent migration that converts every legacy product with embedded `variants[]`
 * into a parent product + N standalone child products (the new Pattern A model).
 *
 * Behavior:
 * - Each candidate row is matched against the `legacyParentVariantId` index so a
 *   second run is a no-op (children already exist for that variant).
 * - The original row is promoted to `productType: 'parent'`, `visibleOnClient: false`.
 * - `variationTheme` is inferred from which variant fields actually carry values.
 * - The first `isDefault` variant (or the first row) becomes `defaultChildProductId`.
 * - Optional `--purge-embedded` removes the `variants[]` array from the parent after
 *   the children exist, freeing up storage.
 *
 * Flags:
 *   --dry-run         Print the plan, don't write.
 *   --purge-embedded  After migration, unset parent.variants and parent.priceBySize.
 *   --limit=N         Process at most N candidate parents (handy in dev).
 *   --uri=...         Override MONGODB_URI.
 *
 * Usage:
 *   node scripts/migrateVariantsToChildren.mjs --dry-run
 *   node scripts/migrateVariantsToChildren.mjs
 *   node scripts/migrateVariantsToChildren.mjs --purge-embedded
 */

import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import mongoose from 'mongoose';

// Lightweight .env loader — avoids adding `dotenv` as a dep just for one script.
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
    // Best effort.
  }
}
loadEnvFile('.env.local');
loadEnvFile('.env');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const PURGE = args.includes('--purge-embedded');
const URI_FLAG = args.find((a) => a.startsWith('--uri='));
const LIMIT_FLAG = args.find((a) => a.startsWith('--limit='));
const URI = URI_FLAG ? URI_FLAG.replace('--uri=', '') : (process.env.MONGODB_URI || '');
const LIMIT = LIMIT_FLAG ? parseInt(LIMIT_FLAG.replace('--limit=', ''), 10) : Infinity;

if (!URI) {
  console.error('MONGODB_URI is required (env var or --uri=...)');
  process.exit(1);
}

const ProductModulePath = pathToFileURL(
  path.resolve(process.cwd(), 'lib/models/Product.js')
).href;

function inferVariationTheme(rows) {
  const keys = ['size', 'color', 'weight', 'unitCount'];
  const set = new Set();
  rows.forEach((r) => {
    keys.forEach((k) => {
      if (String(r?.[k] ?? '').trim()) set.add(k);
    });
  });
  return Array.from(set);
}

function deriveChildTitle(parentTitle, attrs) {
  const tail = ['size', 'color', 'weight', 'unitCount']
    .map((k) => attrs[k])
    .filter(Boolean)
    .join(' / ');
  if (!tail) return parentTitle;
  return `${parentTitle} - ${tail}`;
}

async function main() {
  const { default: Product } = await import(ProductModulePath);

  await mongoose.connect(URI, { autoIndex: false });
  console.log(`[migrate] Connected. mode=${DRY_RUN ? 'dry-run' : 'live'} purge=${PURGE}`);

  // Candidates = rows with embedded variants and no parent/child marker yet.
  const baseQuery = {
    deletedAt: null,
    productType: { $ne: 'child' },
    'variants.0': { $exists: true },
  };

  const total = await Product.countDocuments(baseQuery);
  console.log(`[migrate] Found ${total} parent candidate(s) with embedded variants.`);

  let processed = 0;
  let createdChildren = 0;
  let skippedExisting = 0;

  const cursor = Product.find(baseQuery).cursor();
  for await (const parent of cursor) {
    if (processed >= LIMIT) break;
    processed += 1;

    const variants = Array.isArray(parent.variants) ? parent.variants : [];
    if (variants.length === 0) continue;

    const variationTheme =
      Array.isArray(parent.variationTheme) && parent.variationTheme.length > 0
        ? parent.variationTheme
        : inferVariationTheme(variants);

    console.log(
      `\n[migrate] (${processed}/${total}) ${parent.slug}  variants=${variants.length}  theme=[${variationTheme.join(',')}]`
    );

    let defaultChildId = null;

    for (let i = 0; i < variants.length; i += 1) {
      const v = variants[i];
      const legacyId = String(v?.variantId || `${parent._id}::${i}`);

      // Idempotency: skip if a child for this legacy id already exists.
      const existing = await Product.findOne({
        parentProductId: parent._id,
        legacyParentVariantId: legacyId,
      }).lean();
      if (existing) {
        skippedExisting += 1;
        if (Boolean(v?.isDefault) && !defaultChildId) defaultChildId = existing._id;
        continue;
      }

      const variationAttributes = {
        size: String(v?.size || '').trim(),
        color: String(v?.color || '').trim(),
        weight: String(v?.weight || '').trim(),
        unitCount: String(v?.unitCount || '').trim(),
      };
      const title = deriveChildTitle(parent.title, variationAttributes);
      const slugBase = Product.buildChildSlugBase(
        { slug: parent.slug, variationTheme, variationAttributes: {} },
        variationAttributes
      );

      // Use a deterministic suffix from the legacy id so a re-run lands on the
      // same slug instead of creating a new variant.
      const candidateSlug = `${slugBase}-${String(legacyId).slice(-6).toLowerCase().replace(/[^a-z0-9]/g, '')}`;

      const childDoc = {
        title,
        slug: candidateSlug,
        productType: 'child',
        parentProductId: parent._id,
        variationTheme,
        variationAttributes,
        visibleOnClient: true,
        showInCatalog: true,
        categoryId: parent.categoryId || null,
        categoryIds: Array.isArray(parent.categoryIds) ? parent.categoryIds : [],
        brand: parent.brand || '',
        businessTypeSlugs: Array.isArray(parent.businessTypeSlugs) ? parent.businessTypeSlugs : [],
        sku: String(v?.sku || '').trim(),
        barcode: String(v?.barcode || '').trim(),
        hsnCode: String(v?.hsnCode || '').trim(),
        gstPercent: Number(v?.gstPercent || 0),
        mrp: Number(v?.mrp || 0),
        sellingPrice: Number(v?.sellingPrice || v?.price || 0),
        discountPercent: Number(v?.discountPercent || 0),
        marginPrice: Number(v?.marginPrice || 0),
        price: Number(v?.sellingPrice || v?.price || 0),
        heroImage:
          (Array.isArray(v?.images) ? v.images.find(Boolean) : '') ||
          parent.heroImage ||
          '',
        gallery: Array.isArray(v?.images) ? v.images.filter(Boolean) : [],
        status: parent.status || 'In Stock',
        legacyParentVariantId: legacyId,
      };

      console.log(
        `   - child: ${childDoc.slug}  attrs=${JSON.stringify(variationAttributes)}  sku=${childDoc.sku || '—'}`
      );

      if (!DRY_RUN) {
        const child = new Product(childDoc);
        child.searchBlob = Product.buildSearchBlob(parent, child);
        try {
          await child.save();
          createdChildren += 1;
          if (Boolean(v?.isDefault) && !defaultChildId) defaultChildId = child._id;
        } catch (err) {
          console.error(`   ! failed to save child ${childDoc.slug}: ${err.message}`);
        }
      }
    }

    if (!DRY_RUN) {
      const update = {
        productType: 'parent',
        visibleOnClient: false,
        variationTheme,
      };
      if (defaultChildId) update.defaultChildProductId = defaultChildId;
      if (PURGE) {
        update.variants = [];
        update.priceBySize = [];
      }
      await Product.updateOne({ _id: parent._id }, { $set: update });
    }
  }

  console.log(
    `\n[migrate] Done. parents=${processed} children_created=${createdChildren} skipped_existing=${skippedExisting}`
  );

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('[migrate] FATAL:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
