/**
 * Next.js Robots.txt
 */

import { SITE_CONFIG } from '@/lib/constants/seo';

export default function robots() {
  const baseUrl = SITE_CONFIG.baseUrl;

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/admin',
          '/wishlist',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
