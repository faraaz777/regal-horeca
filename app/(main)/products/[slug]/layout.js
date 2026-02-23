/**
 * Product Detail Layout
 * Server component: generateMetadata + JSON-LD for product pages.
 * Meta tags are aligned for Open Graph and Twitter so cards always show image + text.
 */

import { getProductBySlug } from '@/lib/utils/getProductBySlug';
import { generateProductSchema } from '@/lib/utils/structuredData';
import { getProductOgImageUrl } from '@/lib/utils/ogImage';
import { SITE_CONFIG } from '@/lib/constants/seo';

/** Shared title/description for product cards (consistent across OG and Twitter). */
function productCardMeta(product) {
  const title = product.title || 'Product';
  const description =
    (product.summary || '').slice(0, 160) ||
    `${title} - Commercial kitchen equipment. REGAL® HoReCa Hyderabad.`;
  const cardTitle = `${title} | REGAL® HoReCa`;
  return { title: cardTitle, description };
}

export async function generateMetadata({ params }) {
  const slug = params?.slug;
  if (!slug) return { title: 'Product Not Found' };

  const product = await getProductBySlug(slug);
  if (!product) {
    return {
      title: 'Product Not Found',
      robots: { index: false },
    };
  }

  const { title: cardTitle, description } = productCardMeta(product);
  const canonicalUrl = `${SITE_CONFIG.baseUrl}/products/${slug}`;

  // Single source for image URL: correct construction + fallback (heroImage → gallery → og-default → favicon)
  const ogImageUrl = getProductOgImageUrl(product, SITE_CONFIG);

  const openGraphImages = [
    {
      url: ogImageUrl,
      alt: product.title || 'Product',
      width: 1200,
      height: 630,
    },
  ];

  return {
    title: `${product.title || 'Product'} | REGAL® HoReCa Hyderabad`,
    description,
    robots: { index: true, follow: true },
    openGraph: {
      type: 'website',
      title: cardTitle,
      description,
      url: canonicalUrl,
      siteName: 'REGAL® HoReCa',
      images: openGraphImages,
    },
    twitter: {
      card: 'summary_large_image',
      title: cardTitle,
      description,
      images: [ogImageUrl],
      creator: SITE_CONFIG.twitterHandle ?? undefined,
    },
    alternates: { canonical: canonicalUrl },
  };
}

export default async function ProductLayout({ params, children }) {
  const slug = params?.slug;
  const product = await getProductBySlug(slug);
  const productSchema = product ? generateProductSchema(product) : null;

  return (
    <>
      {productSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
        />
      )}
      {children}
    </>
  );
}
