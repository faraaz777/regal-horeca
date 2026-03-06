/**
 * Products Facets API Route
 * 
 * Returns available filter options (facets) for products based on current filters.
 * This enables context-aware filtering - facets are calculated from the filtered product set.
 * 
 * GET /api/products/facets?category=...&business=...&search=...
 * 
 * Returns:
 * - colors: Available colors in current product set
 * - brands: Available brands in current product set
 * - filters: Dynamic filters (Material, Size, etc.) with counts - FROM ADMIN FORM ONLY
 * - priceRange: Min/max price in current product set
 * 
 * GOLDEN RULE:
 * - Filterable → lives in filters (for sidebar)
 * - Descriptive → lives in specifications (for product detail page only)
 * 
 * Specifications are NOT included in facets - they are for product detail page only.
 */

import { NextResponse } from 'next/server';
import { queryProductFacets } from '@/lib/server/products/queryFacets';

// Mark route as dynamic to prevent static generation
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const categorySlug = searchParams.get('category');
    const businessSlug = searchParams.get('business');
    const searchQuery = searchParams.get('search');
    const featured = searchParams.get('featured');
    const status = searchParams.get('status');
    // Note: Facets are calculated from the filtered set, so we don't include
    // price, colors, brands, filters params here - those are for the products query.
    // Facets show what's available AFTER context filters (category, business, search).
    const facets = await queryProductFacets({
      categorySlug,
      businessSlug,
      searchQuery,
      featured,
      status,
    });

    return NextResponse.json({
      success: true,
      facets: {
        colors: facets.colors,
        brands: facets.brands,
        filters: facets.filters,
        // specs removed - Golden Rule: filterable = filters, descriptive = specifications
        // statuses removed - not needed in sidebar
        priceRange: facets.priceRange,
        totalProducts: facets.totalProducts,
      },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Error fetching facets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch facets', details: error.message },
      { status: 500 }
    );
  }
}

