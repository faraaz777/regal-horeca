import 'server-only';

/**
 * Server-side: Fetch product by slug for SEO metadata and structured data.
 * Uses direct DB access for build-time and server-side rendering.
 * Uses cache() to dedupe when called from generateMetadata + layout.
 *
 * Parent/child variants:
 * - Parent slug requests are transparently redirected to the parent's default-child
 *   slug via the `redirectTo` field on the returned product (caller is responsible
 *   for issuing the redirect).
 * - Children inherit description/specs/gallery/etc. from their parent through
 *   `resolveBySlug`.
 */

import { cache } from 'react';
import { connectToDatabase } from '@/lib/db/connect';
import Product from '@/lib/models/Product';
import Category from '@/lib/models/Category';
import { resolveBySlug, getSiblingChildren } from '@/lib/server/products/resolveProduct';

/**
 * Get category path (hierarchy) for breadcrumbs
 */
const getCategoryPath = cache(async (categoryId) => {
  if (!categoryId) return [];

  try {
    const path = [];
    // Handle both ObjectId and populated object
    const id = categoryId._id || categoryId;
    let current = await Category.findById(id).select('name slug parent level').lean();

    while (current) {
      path.unshift({ name: current.name, slug: current.slug, level: current.level });
      if (current.parent) {
        current = await Category.findById(current.parent).select('name slug parent level').lean();
      } else {
        break;
      }
    }

    return path;
  } catch (error) {
    console.error('getCategoryPath error:', error);
    return [];
  }
});

export const getProductBySlug = cache(async (slug) => {
  if (!slug || typeof slug !== 'string') return null;
  try {
    await connectToDatabase();
    const resolved = await resolveBySlug(slug);
    if (!resolved?.product) return null;
    const product = resolved.product;

    if (product.categoryId) {
      const categoryPath = await getCategoryPath(product.categoryId);
      product.categoryPath = categoryPath;
    }

    if (resolved.redirectTo) {
      product.redirectTo = resolved.redirectTo;
    }

    return product;
  } catch (error) {
    console.error('getProductBySlug error:', error);
    return null;
  }
});

/**
 * Full product by slug for SSR product pages (SEO).
 * Returns all fields needed for product detail: specs, colorVariants, relatedProductIds, etc.
 * Uses cache() so layout and page can share the same fetch.
 */
export const getFullProductBySlug = cache(async (slug) => {
  if (!slug || typeof slug !== 'string') return null;
  try {
    await connectToDatabase();
    const resolved = await resolveBySlug(slug);
    if (!resolved?.product) return null;
    const product = resolved.product;

    // Populate references that resolveBySlug returned as ObjectIds.
    // We populate against the resolved product (which is the merged child for variants).
    const sourceId = product._id;
    if (sourceId) {
      const populated = await Product.findById(sourceId)
        .populate('categoryId', 'name slug level')
        .populate('categoryIds', 'name slug level')
        .populate({
          path: 'relatedProductIds',
          match: { deletedAt: null },
          select: 'title slug heroImage price',
        })
        .populate({
          path: 'frequentlyOrderedTogetherProductIds',
          match: { deletedAt: null },
          select: 'title slug heroImage price',
        })
        .lean();
      if (populated) {
        // Take populated relations from the source row, but keep merged content fields
        // (description, specs, gallery, etc.) from the resolved product.
        product.categoryId = populated.categoryId || product.categoryId;
        product.categoryIds = populated.categoryIds || product.categoryIds;
        // Children inherit related/frequently-ordered from parent — pull those off
        // the parent doc when the populated row (the child) has none.
        product.relatedProductIds = populated.relatedProductIds?.length
          ? populated.relatedProductIds
          : product.relatedProductIds;
        product.frequentlyOrderedTogetherProductIds = populated.frequentlyOrderedTogetherProductIds?.length
          ? populated.frequentlyOrderedTogetherProductIds
          : product.frequentlyOrderedTogetherProductIds;
      }
    }

    if (product.categoryId) {
      const categoryPath = await getCategoryPath(product.categoryId);
      product.categoryPath = categoryPath;
    }

    // PDP: all non-deleted siblings (catalog visibility is separate via visibleOnClient).
    if (product.parentProductId) {
      product.children = await getSiblingChildren(product.parentProductId, { visibleOnly: false });
    }

    if (resolved.redirectTo) {
      product.redirectTo = resolved.redirectTo;
    }

    return product;
  } catch (error) {
    console.error('getFullProductBySlug error:', error);
    return null;
  }
});
