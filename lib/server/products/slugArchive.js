import 'server-only';

import Product from '@/lib/models/Product';

const TRASH_MARKER = '--trashed--';

/**
 * Slug reserved for a soft-deleted row so the canonical URL can be reused by a new active product.
 */
export function buildArchivedSlug(slug, productId) {
  const base = String(slug || '').trim().toLowerCase();
  const id = String(productId || '').trim();
  if (!base || !id) return base;
  if (base.includes(TRASH_MARKER)) return base;
  return `${base}${TRASH_MARKER}${id}`;
}

export function isArchivedSlug(slug) {
  return String(slug || '').includes(TRASH_MARKER);
}

/**
 * Free a slug held only by soft-deleted products (legacy DB unique index on slug).
 */
export async function releaseSlugForActiveInsert(slug) {
  const normalized = String(slug || '').trim().toLowerCase();
  if (!normalized) return;

  const holders = await Product.find({
    slug: normalized,
    deletedAt: { $ne: null },
  })
    .select('_id slug previousSlug')
    .lean();

  for (const doc of holders) {
    const archived = buildArchivedSlug(doc.slug, doc._id);
    if (archived === doc.slug) continue;
    await Product.updateOne(
      { _id: doc._id },
      {
        $set: {
          slug: archived,
          previousSlug: doc.previousSlug || doc.slug,
        },
      }
    );
  }
}

/**
 * Move slug off the canonical URL when soft-deleting (keeps restore via previousSlug).
 */
export async function archiveSlugOnSoftDelete(product) {
  if (!product?._id) return;
  const current = String(product.slug || '').trim().toLowerCase();
  if (!current || isArchivedSlug(current)) return;

  const archived = buildArchivedSlug(current, product._id);
  product.previousSlug = current;
  product.slug = archived;
}

/**
 * Restore canonical slug when undeleting, if no active product owns it.
 */
export async function restoreCanonicalSlugOnUndelete(product) {
  const previous = String(product.previousSlug || '').trim().toLowerCase();
  if (!previous) return;

  const conflict = await Product.findOne({
    _id: { $ne: product._id },
    slug: previous,
    deletedAt: null,
  })
    .select('_id')
    .lean();

  if (conflict) return;

  product.slug = previous;
  product.previousSlug = undefined;
}
