/**
 * Server-side: Fetch product by slug for SEO metadata and structured data.
 * Uses direct DB access for build-time and server-side rendering.
 * Uses cache() to dedupe when called from generateMetadata + layout.
 */

import { cache } from 'react';
import { connectToDatabase } from '@/lib/db/connect';
import Product from '@/lib/models/Product';

export const getProductBySlug = cache(async (slug) => {
  if (!slug || typeof slug !== 'string') return null;
  try {
    await connectToDatabase();
    const product = await Product.findOne({ slug: slug.trim() })
      .select('title slug summary description heroImage gallery price sku brand status categoryId categoryIds')
      .populate('categoryId', 'name slug')
      .lean();
    return product;
  } catch (error) {
    console.error('getProductBySlug error:', error);
    return null;
  }
});
