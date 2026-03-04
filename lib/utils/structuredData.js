/**
 * JSON-LD Structured Data generators for SEO rich results.
 */

import { REGAL_NAP, REGAL_SOCIAL, SITE_CONFIG } from '@/lib/constants/seo';
import { toDirectSeoImageUrl } from '@/lib/utils/ogImage';
import { stripHtml } from '@/lib/utils/html';

/**
 * Strip common Markdown syntax for use in meta tags / schema descriptions.
 * Keeps human-readable text while removing formatting markers like **, *, _, #, links, and code fences.
 */
export function stripMarkdownForMeta(text) {
  if (!text || typeof text !== 'string') return '';
  
  let stripped = text;

  // Remove fenced code blocks ```...```
  stripped = stripped.replace(/```[\s\S]*?```/g, ' ');

  // Remove inline code `code`
  stripped = stripped.replace(/`([^`]+)`/g, '$1');

  // Images: ![alt](url) → alt (or blank if no alt)
  stripped = stripped.replace(/!\[([^\]]*)]\([^)]*\)/g, '$1');

  // Links: [text](url) → text
  stripped = stripped.replace(/\[([^\]]+)]\([^)]*\)/g, '$1');

  // Bold / italic: **text**, __text__, *text*, _text_
  stripped = stripped.replace(/(\*\*|__)(.*?)\1/g, '$2');
  stripped = stripped.replace(/(\*|_)(.*?)\1/g, '$2');

  // Headings: remove leading #, ##, etc.
  stripped = stripped.replace(/^\s{0,3}#{1,6}\s+/gm, '');

  // Collapse whitespace
  stripped = stripped.replace(/\s+/g, ' ').trim();

  return stripped;
}

/**
 * Organization + LocalBusiness schema (site-wide)
 */
export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'LocalBusiness'],
    name: REGAL_NAP.name,
    legalName: REGAL_NAP.legalName,
    url: SITE_CONFIG.baseUrl,
    logo: `${SITE_CONFIG.baseUrl}/favicon.ico`,
    description: SITE_CONFIG.defaultDescription,
    address: {
      '@type': 'PostalAddress',
      streetAddress: REGAL_NAP.address.street,
      addressLocality: REGAL_NAP.address.locality,
      addressRegion: REGAL_NAP.address.region,
      addressCountry: REGAL_NAP.address.country,
    },
    telephone: REGAL_NAP.phones[0],
    email: REGAL_NAP.email,
    sameAs: REGAL_SOCIAL,
    foundingDate: new Date().getFullYear() - REGAL_NAP.yearsInBusiness,
    areaServed: {
      '@type': 'Country',
      name: 'India',
    },
    priceRange: '$$',
  };
}

/**
 * WebSite schema with SearchAction (enables sitelinks search box)
 */
export function generateWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: REGAL_NAP.name,
    url: SITE_CONFIG.baseUrl,
    description: SITE_CONFIG.defaultDescription,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_CONFIG.baseUrl}/catalog?search={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
    publisher: {
      '@type': 'Organization',
      name: REGAL_NAP.name,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_CONFIG.baseUrl}/favicon.ico`,
      },
    },
  };
}

/**
 * Product schema for product pages
 */
export function generateProductSchema(product) {
  if (!product || !product.title) return null;
  const baseUrl = SITE_CONFIG.baseUrl;
  const image = product.heroImage || (product.gallery && product.gallery[0]);
  const imageUrl = image ? toDirectSeoImageUrl(image, baseUrl) : undefined;
  const rawDescription = product.summary || product.description || '';
  const description = stripHtml(rawDescription).slice(0, 500);

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description,
    url: `${baseUrl}/products/${product.slug}`,
    sku: product.sku || product.slug,
    brand: {
      '@type': 'Brand',
      name: product.brand || REGAL_NAP.name,
    },
  };

  // Add category if available (helps Google categorize products)
  if (product.categoryId) {
    const categoryName = typeof product.categoryId === 'object' 
      ? product.categoryId.name 
      : null;
    if (categoryName) {
      schema.category = categoryName;
    }
  }

  if (imageUrl) {
    schema.image = imageUrl;
  }

  if (product.price != null && product.price > 0) {
    schema.offers = {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: 'INR',
      availability: product.status === 'active' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: `${baseUrl}/products/${product.slug}`,
    };
  }

  return schema;
}

/**
 * Breadcrumb schema
 */
export function generateBreadcrumbSchema(items) {
  if (!items || items.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url ? `${SITE_CONFIG.baseUrl}${item.url}` : undefined,
    })),
  };
}

/**
 * FAQ schema
 */
export function generateFAQSchema(faqs) {
  if (!faqs || faqs.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}
