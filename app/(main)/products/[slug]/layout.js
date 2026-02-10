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
  
  // Ensure absolute URL for image (required for WhatsApp)
  let ogImage = product.heroImage;
  if (ogImage && !ogImage.startsWith('http')) {
    ogImage = `${SITE_CONFIG.baseUrl}${ogImage.startsWith('/') ? ogImage : '/' + ogImage}`;
  }
  
  const canonicalUrl = `${SITE_CONFIG.baseUrl}/products/${slug}`;

  return {
    title: `${title} | REGAL® HoReCa Hyderabad`,
    description,
    openGraph: {
      title: `${title} | REGAL® HoReCa`,
      description,
      url: canonicalUrl,
      siteName: 'REGAL® HoReCa', // Required for WhatsApp
      images: ogImage ? [{ 
        url: ogImage, 
        alt: title,
        width: 1200, // WhatsApp prefers 1200x630
        height: 630
      }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | REGAL® HoReCa`,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
    alternates: { canonical: canonicalUrl },
  };
}

export default async function ProductLayout({ params, children }) {
  const slug = params?.slug;
  const product = await getProductBySlug(slug);
  const productSchema = product ? generateProductSchema(product) : null;
  
  // Build breadcrumb items with actual category hierarchy
  const breadcrumbItems = [{ name: 'Home', url: '/' }];
  
  if (product?.categoryPath && product.categoryPath.length > 0) {
    // Add category hierarchy to breadcrumbs
    product.categoryPath.forEach((cat) => {
      breadcrumbItems.push({ name: cat.name, url: `/catalog?category=${cat.slug}` });
    });
  } else {
    // Fallback to Catalog if no category path
    breadcrumbItems.push({ name: 'Catalog', url: '/catalog' });
  }
  
  // Add product as last item
  if (product) {
    breadcrumbItems.push({ name: product.title, url: `/products/${slug}` });
  }
  
  const breadcrumbSchema = product ? generateBreadcrumbSchema(breadcrumbItems) : null;

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
