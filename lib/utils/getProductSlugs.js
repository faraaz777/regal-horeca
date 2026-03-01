/**
 * Server-side: Fetch all product slugs for sitemap.
 */

import { connectToDatabase } from '@/lib/db/connect';
import Product from '@/lib/models/Product';

export async function getProductSlugs() {
  try {
    await connectToDatabase();
    const products = await Product.find(
      { status: { $ne: 'draft' } },
      { slug: 1, updatedAt: 1, heroImage: 1 }
    )
      .lean();
    return products.map((p) => ({
      slug: p.slug,
      lastModified: p.updatedAt,
      heroImage: p.heroImage || null,
    }));
  } catch (error) {
    console.error('getProductSlugs error:', error);
    return [];
  }
}
