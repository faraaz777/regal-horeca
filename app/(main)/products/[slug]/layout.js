/**
 * Product Detail Layout
 * Server component: generateMetadata + JSON-LD for product pages.
 * Meta tags are aligned for Open Graph and Twitter so cards always show image + text.
 */

import { getProductBySlug } from '@/lib/utils/getProductBySlug';
import { generateBreadcrumbSchema, generateProductSchema } from '@/lib/utils/structuredData';
import { getProductOgImageUrl } from '@/lib/utils/ogImage';
import { SITE_CONFIG } from '@/lib/constants/seo';
import { stripHtml } from '@/lib/utils/html';

/** Shared title/description for product cards (consistent across OG and Twitter). */
function productCardMeta(product) {
  const title = product.title || 'Product';
  const raw = product.summary || product.description || '';
  const plain = stripHtml(raw).slice(0, 160);
  const description =
    plain ||
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
  // Canonical points to the resolved slug (`redirectTo` is set when this slug is a
  // parent carrier). Children point to themselves; standalones point to themselves.
  const canonicalSlug = product.redirectTo || slug;
  const canonicalUrl = `${SITE_CONFIG.baseUrl}/products/${canonicalSlug}`;

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
  const breadcrumbSchema = (() => {
    if (!product) return null;
    const items = [
      { name: 'Home', url: '/' },
      { name: 'Products', url: '/catalog' },
      ...(Array.isArray(product.categoryPath)
        ? product.categoryPath
            .filter(Boolean)
            .map((c) => ({
              name: c.name,
              url: c.slug ? `/catalog?category=${c.slug}` : '/catalog',
            }))
        : []),
      { name: product.title, url: product.slug ? `/products/${product.slug}` : undefined },
    ];
    return generateBreadcrumbSchema(items);
  })();

  return (
    <>
      {productSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
        />
      )}
      {breadcrumbSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        />
      )}
      {children}
    </>
  );
}
