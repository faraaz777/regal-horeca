/**
 * Catalog Page
 * 
 * Product catalog with advanced filtering, search, and category navigation.
 */

import { Suspense } from 'react';
import { SITE_CONFIG } from '@/lib/constants/seo';
import { queryProducts } from '@/lib/server/products/queryProducts';
import { queryProductFacets } from '@/lib/server/products/queryFacets';

// ISR: revalidate every 60s so catalog can be cached at edge between requests
export const revalidate = 60;

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
    // Compute products + facets directly (no self-HTTP).
    const category = searchParams?.category;
    const business = searchParams?.business;
    const search = searchParams?.search;

    const page = searchParams?.page || '1';
    const limit = 24;

    const [productsResult, facetsResult] = await Promise.all([
      queryProducts({
        categorySlug: category,
        businessSlug: business,
        searchQuery: search,
        priceMin: searchParams?.priceMin,
        priceMax: searchParams?.priceMax,
        colorsParam: searchParams?.colors,
        brandsParam: searchParams?.brands,
        filtersParam: searchParams?.filters,
        sortBy: searchParams?.sortBy || 'newest',
        page,
        limit,
        includePopulates: true,
      }),
      queryProductFacets({
        categorySlug: category,
        businessSlug: business,
        searchQuery: search,
      }),
    ]);

    // Serialize for Client Components boundary (convert ObjectIds, Dates, etc. to plain JSON)
    const safeProductsResult = JSON.parse(JSON.stringify(productsResult));
    const safeFacetsResult = JSON.parse(JSON.stringify(facetsResult));

    initialProductsData = {
      success: true,
      products: safeProductsResult.products,
      pagination: safeProductsResult.pagination,
      total: safeProductsResult.pagination.total,
      skip: (safeProductsResult.pagination.page - 1) * safeProductsResult.pagination.limit,
    };

    initialFacetsData = {
      success: true,
      facets: safeFacetsResult,
    };
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
