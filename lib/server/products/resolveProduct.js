/**
 * resolveProduct
 *
 * Single chokepoint for parent/child variant inheritance. Every storefront read surface
 * (PDP, sitemap, cart, related products, ProductCard) goes through this helper so the
 * read-time merge logic lives in exactly one place.
 *
 * Inheritance rules (Pattern A — children store deltas, parent owns shared content):
 *   - Inherited from parent for children even when child has empty/falsy values:
 *       description, summary, specifications, faqs, testimonials, gallery,
 *       detailPhotos, usageAndCare, whyBuyFrom, colorVariants, filters, faqs,
 *       sizeChartUrl, brochureUrl, blogUrl, manufacturer, originalPrice,
 *       availableSizes, priceBySize, brandCategoryId, brandCategoryIds, isPremium.
 *   - Always taken from child (delta fields):
 *       _id, slug, title, productType, parentProductId, variationTheme,
 *       variationAttributes, visibleOnClient, showInCatalog, sku, barcode, hsnCode, price,
 *       status, heroImage (with parent fallback), createdAt, updatedAt.
 *   - heroImage is special: child may not have one (schema makes it optional for
 *     children); fall back to parent's heroImage.
 *
 * For parents we render the default child instead — visiting `/products/<parent-slug>`
 * should never show an empty/non-buyable carrier listing.
 */

import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/db/connect';
import Product from '@/lib/models/Product';
import { mongoChildOwnCatalogRowMatch } from '@/lib/utils/storefrontCatalogFilter';

const INHERITED_FIELDS = [
  'description',
  'summary',
  'specifications',
  'faqs',
  'testimonials',
  'gallery',
  'detailPhotos',
  'usageAndCare',
  'whyBuyFrom',
  'colorVariants',
  'filters',
  'sizeChartUrl',
  'brochureUrl',
  'blogUrl',
  'manufacturer',
  'originalPrice',
  'availableSizes',
  'priceBySize',
  'brandCategoryId',
  'brandCategoryIds',
  'isPremium',
  'tags',
  'frequentlyOrderedTogetherProductIds',
  'relatedProductIds',
];

function isEmptyish(value) {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object' && !mongoose.Types.ObjectId.isValid(value) && !value._bsontype) {
    // Treat plain empty objects as empty.
    return Object.keys(value).length === 0;
  }
  return false;
}

function plainObject(value) {
  if (!value) return null;
  if (typeof value.toObject === 'function') return value.toObject();
  return value;
}

async function findById(id) {
  if (!id) return null;
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return Product.findById(id).lean();
}

/**
 * Merge a child onto its parent. Child wins for everything except inherited fields,
 * where the parent wins when the child's value is empty/falsy.
 */
function mergeChildOnParent(parent, child) {
  const out = { ...plainObject(parent), ...plainObject(child) };

  INHERITED_FIELDS.forEach((field) => {
    const childValue = child?.[field];
    if (isEmptyish(childValue) && !isEmptyish(parent?.[field])) {
      out[field] = parent[field];
    }
  });

  if (isEmptyish(out.heroImage) && !isEmptyish(parent?.heroImage)) {
    out.heroImage = parent.heroImage;
  }

  // Preserve the child's identity for the consumer (PDP/cart/router) regardless of
  // which fields ended up coming from the parent.
  out._id = child._id;
  out.id = child._id;
  out.slug = child.slug;
  out.productType = 'child';
  out.parentProductId = parent?._id || null;
  out.parent = plainObject(parent) || null;
  return out;
}

/**
 * Resolve any product (id, doc, or lean object) into the shape callers should render.
 *
 * - 'standalone' → returned as-is.
 * - 'child'      → merged onto parent (parent fields fill empties).
 * - 'parent'     → returns the resolved default child (or first visible child) so the
 *                  storefront never renders the carrier directly. If no children
 *                  exist, returns the parent itself with productType normalized.
 */
export async function resolveProduct(productOrId) {
  if (!productOrId) return null;
  await connectToDatabase();

  let product = null;
  if (typeof productOrId === 'string' || mongoose.Types.ObjectId.isValid(productOrId)) {
    product = await findById(productOrId);
  } else if (typeof productOrId === 'object') {
    product = plainObject(productOrId);
  }

  if (!product) return null;

  const type = product.productType || 'standalone';

  if (type === 'standalone') {
    return product;
  }

  if (type === 'child') {
    const parent = await findById(product.parentProductId);
    if (!parent) return product;
    return mergeChildOnParent(parent, product);
  }

  // type === 'parent'
  let target = null;
  if (product.defaultChildProductId) {
    target = await findById(product.defaultChildProductId);
    if (target?.deletedAt) target = null;
  }
  if (!target) {
    target = await Product.findOne({
      parentProductId: product._id,
      deletedAt: null,
    })
      .sort({ createdAt: 1 })
      .lean();
  }
  if (!target) return product;
  return mergeChildOnParent(product, target);
}

/**
 * Slug entry-point used by getProductBySlug. Returns the resolved product plus a
 * `redirectTo` slug when the requested slug points at a parent (caller redirects).
 */
export async function resolveBySlug(slug) {
  if (!slug || typeof slug !== 'string') return null;
  await connectToDatabase();
  const raw = await Product.findOne({ slug: slug.trim(), deletedAt: null }).lean();
  if (!raw) return null;

  const type = raw.productType || 'standalone';

  if (type === 'parent') {
    const merged = await resolveProduct(raw);
    const redirectSlug = merged && merged.slug !== raw.slug ? merged.slug : null;
    return { product: merged, redirectTo: redirectSlug };
  }

  const merged = await resolveProduct(raw);
  return { product: merged, redirectTo: null };
}

/**
 * List a parent's children. Used by the PDP swatch picker, the admin children list,
 * and the storefront card to show variant counts.
 *
 * @param {boolean} [catalogVisibleOnly=false] - When true, only children opted into
 *        their own catalog card (rare — most callers want the full PDP sibling list).
 */
export async function getSiblingChildren(parentProductId, { catalogVisibleOnly = false } = {}) {
  if (!parentProductId) return [];
  await connectToDatabase();
  const filter = {
    parentProductId,
    deletedAt: null,
  };
  if (catalogVisibleOnly) {
    Object.assign(filter, mongoChildOwnCatalogRowMatch());
  }
  return Product.find(filter)
    .sort({ createdAt: 1 })
    .lean();
}
