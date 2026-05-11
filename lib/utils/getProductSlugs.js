/**
 * Server-side: Fetch all product slugs for sitemap.
 *
 * Excludes parent variant carriers (productType === 'parent') because their slugs
 * 301-redirect to the default child slug — keeping them in the sitemap would
 * create duplicate-content/redirect-chain warnings in Search Console.
 *
 * Hidden children (visibleOnClient === false) are also excluded so admins can
 * stage variants without having Google index them.
 */

import { connectToDatabase } from '@/lib/db/connect';
import Product from '@/lib/models/Product';

export async function getProductSlugs() {
  try {
    await connectToDatabase();
    const products = await Product.find(
      {
        status: { $ne: 'draft' },
        deletedAt: null,
        productType: { $ne: 'parent' },
        $or: [{ productType: { $ne: 'child' } }, { visibleOnClient: true }],
      },
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
