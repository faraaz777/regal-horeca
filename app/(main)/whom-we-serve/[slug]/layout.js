/**
 * Whom We Serve Layout
 * Server component: generateMetadata for dynamic category pages.
 */

import { WHOM_WE_SERVE_SLUGS, WHOM_WE_SERVE_META } from '@/lib/constants/whomWeServe';
import { SITE_CONFIG } from '@/lib/constants/seo';

export async function generateMetadata({ params }) {
  const slug = params?.slug;
  if (!slug || !WHOM_WE_SERVE_SLUGS.includes(slug)) {
    const meta = WHOM_WE_SERVE_META.restaurants;
    return {
      title: meta.title,
      description: meta.description,
      alternates: { canonical: '/whom-we-serve/restaurants' },
    };
  }

  const meta = WHOM_WE_SERVE_META[slug];
  if (!meta) {
    return {
      title: 'Whom We Serve | REGAL® HoReCa',
      description: 'Hospitality supplies for hotels, restaurants, cafés. REGAL® HoReCa Hyderabad.',
    };
  }

  return {
    title: `${meta.title} | REGAL® HoReCa`,
    description: meta.description,
    openGraph: {
      title: `${meta.title} | REGAL® HoReCa`,
      url: `${SITE_CONFIG.baseUrl}/whom-we-serve/${slug}`,
    },
    alternates: { canonical: `/whom-we-serve/${slug}` },
  };
}

export default function WhomWeServeLayout({ children }) {
  return children;
}
