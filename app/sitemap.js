/**
 * Next.js Sitemap
 * Dynamically generates sitemap for all indexable pages.
 */

import { SITE_CONFIG } from '@/lib/constants/seo';
import { getProductSlugs } from '@/lib/utils/getProductSlugs';
import { WHOM_WE_SERVE_SLUGS } from '@/lib/constants/whomWeServe';

export default async function sitemap() {
  const baseUrl = SITE_CONFIG.baseUrl;

  // Static pages
  const staticPages = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/catalog`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/enquiry`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
  ];

  // Product pages
  let productPages = [];
  try {
    const slugs = await getProductSlugs();
    productPages = slugs.map(({ slug, lastModified }) => ({
      url: `${baseUrl}/products/${slug}`,
      lastModified: lastModified ? new Date(lastModified) : new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    }));
  } catch (e) {
    console.error('Sitemap: failed to fetch product slugs', e);
  }

  // Whom We Serve pages
  const whomWeServePages = WHOM_WE_SERVE_SLUGS.map((slug) => ({
    url: `${baseUrl}/whom-we-serve/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.75,
  }));

  return [...staticPages, ...productPages, ...whomWeServePages];
}
