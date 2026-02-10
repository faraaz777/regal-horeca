/**
 * Product Detail Layout
 * Server component: generateMetadata + JSON-LD for product pages.
 */

import { getProductBySlug } from '@/lib/utils/getProductBySlug';
import { generateProductSchema, generateBreadcrumbSchema } from '@/lib/utils/structuredData';
import { SITE_CONFIG } from '@/lib/constants/seo';

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

  const title = product.title || 'Product';
  const description = (product.summary || '').slice(0, 160) || `${title} - Commercial kitchen equipment. REGAL® HoReCa Hyderabad.`;
  const ogImage = product.heroImage?.startsWith('http') ? product.heroImage : `${SITE_CONFIG.baseUrl}${product.heroImage || ''}`;

  return {
    title: `${title} | REGAL® HoReCa Hyderabad`,
    description: `${description} In stock. Enquiry for bulk orders.`,
    openGraph: {
      title: `${title} | REGAL® HoReCa`,
      description,
      url: `${SITE_CONFIG.baseUrl}/products/${slug}`,
      images: ogImage ? [{ url: ogImage, alt: title }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | REGAL® HoReCa`,
    },
    alternates: { canonical: `/products/${slug}` },
  };
}

export default async function ProductLayout({ params, children }) {
  const slug = params?.slug;
  const product = await getProductBySlug(slug);
  const productSchema = product ? generateProductSchema(product) : null;
  const breadcrumbSchema = product
    ? generateBreadcrumbSchema([
        { name: 'Home', url: '/' },
        { name: 'Catalog', url: '/catalog' },
        { name: product.title, url: `/products/${slug}` },
      ])
    : null;

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
