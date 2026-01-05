/**
 * Catalog Page - Server Component
 * 
 * Product catalog with advanced filtering, search, and category navigation.
 * Features:
 * - Server-side data fetching with ISR caching
 * - Merged products + facets API call
 * - Shallow routing for filters (client component)
 */

import { Suspense } from 'react';
import { getCategoriesFlat } from '@/lib/utils/categories';
import CatalogContent from './CatalogContent';
import ProductCardSkeleton from '@/components/ProductCardSkeleton';

const ITEMS_PER_PAGE = 24;

// Enable ISR - revalidate every 5 minutes
export const revalidate = 300;

async function fetchCatalogData(searchParamsObj) {
  // Build API params - searchParams is an object in server components
  const params = new URLSearchParams();
  const category = searchParamsObj?.category;
  const business = searchParamsObj?.business;
  const search = searchParamsObj?.search;
  const priceMin = searchParamsObj?.priceMin;
  const priceMax = searchParamsObj?.priceMax;
  const colors = searchParamsObj?.colors;
  const brands = searchParamsObj?.brands;
  const filters = searchParamsObj?.filters;
  const sortBy = searchParamsObj?.sortBy || 'newest';
  const page = searchParamsObj?.page || '1';

  if (category) params.set('category', category);
  if (business) params.set('business', business);
  if (search) params.set('search', search);
  if (priceMin) params.set('priceMin', priceMin);
  if (priceMax) params.set('priceMax', priceMax);
  if (colors) params.set('colors', colors);
  if (brands) params.set('brands', brands);
  if (filters) params.set('filters', filters);
  if (sortBy && sortBy !== 'newest') params.set('sortBy', sortBy);
  params.set('page', page);
  params.set('limit', String(ITEMS_PER_PAGE));
  params.set('includeFacets', 'true'); // Request facets in same call

  try {
    // For server-side fetch in Next.js, construct absolute URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    
    // Fetch products + facets in one API call
    const response = await fetch(`${baseUrl}/api/products?${params.toString()}`, {
      next: { revalidate: 300 }, // ISR cache for 5 minutes
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const data = await response.json();

    return {
      products: data.products || [],
      facets: data.facets || null,
      pagination: data.pagination || { total: 0, page: 1, totalPages: 1 },
    };
  } catch (error) {
    console.error('Error fetching catalog data:', error);
    return {
      products: [],
      facets: null,
      pagination: { total: 0, page: 1, totalPages: 1 },
    };
  }
}

export default async function CatalogPage({ searchParams }) {
  // Fetch categories and catalog data in parallel
  const [categories, catalogData] = await Promise.all([
    getCategoriesFlat(),
    fetchCatalogData(searchParams),
  ]);

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
      <CatalogContent
        initialProducts={catalogData.products}
        initialFacets={catalogData.facets}
        initialPagination={catalogData.pagination}
        categories={categories}
        isLoading={false}
      />
    </Suspense>
  );
}
