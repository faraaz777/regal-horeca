/**
 * Server-side: Fetch product by slug for SEO metadata and structured data.
 * Uses direct DB access for build-time and server-side rendering.
 * Uses cache() to dedupe when called from generateMetadata + layout.
 */

import { cache } from 'react';
import { connectToDatabase } from '@/lib/db/connect';
import Product from '@/lib/models/Product';
import Category from '@/lib/models/Category';

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
    const product = await Product.findOne({ slug: slug.trim(), deletedAt: null })
      .select('title slug summary description heroImage gallery price sku brand status categoryId categoryIds')
      .populate('categoryId', 'name slug level')
      .lean();
    
    // Get category path for breadcrumbs if category exists
    if (product?.categoryId) {
      const categoryPath = await getCategoryPath(product.categoryId);
      product.categoryPath = categoryPath;
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
    const product = await Product.findOne({ slug: slug.trim(), deletedAt: null })
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
    if (!product) return null;
    if (product.categoryId) {
      const categoryPath = await getCategoryPath(product.categoryId);
      product.categoryPath = categoryPath;
    }
    return product;
  } catch (error) {
    console.error('getFullProductBySlug error:', error);
    return null;
  }
});
