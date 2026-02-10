/**
 * Catalog Page
 * 
 * Product catalog with advanced filtering, search, and category navigation.
 */

import { Suspense } from 'react';
import { SITE_CONFIG } from '@/lib/constants/seo';

// Uses searchParams - must be dynamic (cannot be statically generated)
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Product Catalog - Commercial Kitchen Equipment',
  description: 'Browse REGAL® HoReCa product catalog. Tableware, kitchenware, barware, hotel & restaurant supplies. Hyderabad.',
  openGraph: {
    title: 'Product Catalog | REGAL® HoReCa Hyderabad',
    url: `${SITE_CONFIG.baseUrl}/catalog`,
  },
  alternates: { canonical: '/catalog' },
};
import CatalogPageClient from './CatalogPageClient';
import ProductCardSkeleton from '@/components/ProductCardSkeleton';

// Server component wrapper that fetches initial data
export default async function CatalogPage({ searchParams }) {
  // Fetch initial data server-side for instant loading
  let initialProductsData = null;
  let initialFacetsData = null;

  try {
    // Get base URL from environment variable (required for static/ISR build)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL 
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    // Build query params from searchParams
    const productsParams = new URLSearchParams();
  const facetsParams = new URLSearchParams();
    
    if (searchParams?.category) {
      productsParams.set('category', searchParams.category);
      facetsParams.set('category', searchParams.category);
    }
    if (searchParams?.business) {
      productsParams.set('business', searchParams.business);
      facetsParams.set('business', searchParams.business);
    }
    if (searchParams?.search) {
      productsParams.set('search', searchParams.search);
      facetsParams.set('search', searchParams.search);
    }
    if (searchParams?.priceMin) productsParams.set('priceMin', searchParams.priceMin);
    if (searchParams?.priceMax) productsParams.set('priceMax', searchParams.priceMax);
    if (searchParams?.colors) productsParams.set('colors', searchParams.colors);
    if (searchParams?.brands) productsParams.set('brands', searchParams.brands);
    if (searchParams?.filters) productsParams.set('filters', searchParams.filters);
    if (searchParams?.sortBy) productsParams.set('sortBy', searchParams.sortBy);
    productsParams.set('page', searchParams?.page || '1');
    productsParams.set('limit', '24');

    // Fetch products and facets in parallel (server-side)
    const [productsResponse, facetsResponse] = await Promise.all([
      fetch(`${baseUrl}/api/products?${productsParams.toString()}`, {
        next: { revalidate: 60 }, // Cache for 1 minute
      }).catch(() => null),
      fetch(`${baseUrl}/api/products/facets?${facetsParams.toString()}`, {
        next: { revalidate: 60 }, // Cache for 1 minute
      }).catch(() => null),
    ]);

    // Parse responses
    if (productsResponse) {
      const productsData = await productsResponse.json().catch(() => null);
      if (productsData?.success) {
        initialProductsData = productsData;
      }
    }

    if (facetsResponse) {
      const facetsData = await facetsResponse.json().catch(() => null);
      if (facetsData?.success) {
        initialFacetsData = facetsData;
      }
    }
  } catch (error) {
    console.error('Error fetching initial catalog data:', error);
    // Continue with null - client-side will fetch
  }

  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <ProductCardSkeleton key={`skeleton-${index}`} />
          ))}
        </div>
      </div>
    }>
      <CatalogPageClient 
        initialProductsData={initialProductsData}
        initialFacetsData={initialFacetsData}
      />
    </Suspense>
  );
}
