/**
 * Catalog Page
 * 
 * Product catalog with advanced filtering, search, and category navigation.
 * Features:
 * - Context-aware faceted navigation
 * - URL state management for all filters
 * - Backend facets API integration
 * - Filter counts and disabled states
 * - Active filter chips
 * - Pagination support
 */

import { Suspense } from 'react';
import { headers } from 'next/headers';
import CatalogPageClient from './CatalogPageClient';
import ProductCardSkeleton from '@/components/ProductCardSkeleton';

// Server component wrapper that fetches initial data
export default async function CatalogPage({ searchParams }) {
  // Fetch initial data server-side for instant loading
  let initialProductsData = null;
  let initialFacetsData = null;

  try {
    // Get base URL for server-side fetch
    const headersList = headers();
    const host = headersList.get('host') || 'localhost:3000';
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

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
        cache: 'force-cache',
        next: { revalidate: 60 }, // Cache for 1 minute
      }).catch(() => null),
      fetch(`${baseUrl}/api/products/facets?${facetsParams.toString()}`, {
        cache: 'force-cache',
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
