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
import { connectToDatabase } from '@/lib/db/connect';
import Product from '@/lib/models/Product';
import { getCategoryIdsWithChildren } from '@/lib/utils/categoryCache';

const PREDEFINED_COLORS = [
  'Blue', 'Green', 'Red', 'Yellow', 'Purple', 'Orange', 
  'Pink', 'Brown', 'Gray', 'Black', 'White', 'Silver'
];

// Mark route as dynamic to prevent static generation
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const categorySlug = searchParams.get('category');
    const businessSlug = searchParams.get('business');
    const searchQuery = searchParams.get('search');
    const featured = searchParams.get('featured');
    const status = searchParams.get('status');
    // Note: Facets are calculated from the filtered set, so we don't include
    // price, colors, brands, filters params here - those are for the products query
    // Facets show what's available AFTER context filters (category, business, search)

    // Build base query (same as products route)
    const query = {};
    const andConditions = [];

    // Text search - must be at root level
    let useTextSearch = false;
    let textSearchQuery = null;
    if (searchQuery && searchQuery.trim()) {
      useTextSearch = true;
      textSearchQuery = { $text: { $search: searchQuery.trim() } };
    }

    // Category filter
    if (categorySlug) {
      const categoryIds = await getCategoryIdsWithChildren(categorySlug);
      if (categoryIds.length > 0) {
        andConditions.push({
          $or: [
            { categoryId: { $in: categoryIds } },
            { categoryIds: { $in: categoryIds } }
          ]
        });
      }
    }

    // Business type filter
    if (businessSlug) {
      andConditions.push({
        businessTypeSlugs: businessSlug
      });
    }

    // Featured filter
    if (featured === 'true') {
      andConditions.push({ featured: true });
    }

    // Status filter (for base query, but we'll still calculate all statuses in facets)
    if (status) {
      andConditions.push({ status: status });
    }

    // Combine conditions
    // If using text search, combine with $and
    if (useTextSearch) {
      if (andConditions.length > 0) {
        query.$and = [textSearchQuery, ...andConditions];
      } else {
        Object.assign(query, textSearchQuery);
      }
    } else if (andConditions.length > 0) {
      query.$and = andConditions;
    }

    // Get products matching the base query (for facet calculation)
    // We don't need to populate or sort for facets, just get the data
    // NOTE: Specifications are NOT included - they are for product detail page only
    const products = await Product.find(query)
      .select('colorVariants brand filters price status')
      .lean();

    // Calculate facets from products
    // Only extract: colors, brands, filters (from admin form), price
    // Specifications are intentionally excluded (Golden Rule: filterable = filters, descriptive = specifications)
    // Status/Availability removed from sidebar filters
    const colors = new Set();
    const brands = new Set();
    const filters = {};
    let minPrice = Infinity;
    let maxPrice = -Infinity;

    products.forEach(product => {
      // Colors
      if (product.colorVariants && Array.isArray(product.colorVariants)) {
        product.colorVariants.forEach(cv => {
          if (cv.colorName && PREDEFINED_COLORS.includes(cv.colorName)) {
            colors.add(cv.colorName);
          }
        });
      }

      // Brands
      if (product.brand && product.brand.trim()) {
        brands.add(product.brand.trim());
      }

      // Dynamic filters (from admin form - the ONLY source for sidebar filters)
      if (product.filters && Array.isArray(product.filters)) {
        product.filters.forEach(filter => {
          if (filter.key && filter.values && Array.isArray(filter.values)) {
            // Normalize filter key (capitalize first letter)
            const normalizedKey = filter.key.trim().charAt(0).toUpperCase() + filter.key.trim().slice(1).toLowerCase();
            if (!filters[normalizedKey]) {
              filters[normalizedKey] = {};
            }
            filter.values.forEach(value => {
              if (value && value.trim()) {
                // Normalize value: capitalize first letter, rest lowercase
                // This ensures "porcelain", "Porcelain", "PORCELAIN" all become "Porcelain"
                const normalizedValue = value.trim().charAt(0).toUpperCase() + value.trim().slice(1).toLowerCase();
                filters[normalizedKey][normalizedValue] = (filters[normalizedKey][normalizedValue] || 0) + 1;
              }
            });
          }
        });
      }

      // NOTE: Specifications are NOT extracted here
      // They are for product detail page only, not for sidebar filtering

      // NOTE: Status/Availability removed from sidebar filters

      // Price range
      if (typeof product.price === 'number' && product.price >= 0) {
        minPrice = Math.min(minPrice, product.price);
        maxPrice = Math.max(maxPrice, product.price);
      }
    });

    // Convert sets to sorted arrays
    const colorsArray = Array.from(colors).sort();
    const brandsArray = Array.from(brands).sort();

    // Convert filter objects to arrays with counts
    const filtersWithCounts = {};
    Object.keys(filters).forEach(key => {
      filtersWithCounts[key] = Object.entries(filters[key])
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => a.value.localeCompare(b.value));
    });

    // NOTE: specs are NOT included in response - they are for product detail page only

    return NextResponse.json({
      success: true,
      facets: {
        colors: colorsArray,
        brands: brandsArray,
        filters: filtersWithCounts,
        // specs removed - Golden Rule: filterable = filters, descriptive = specifications
        // statuses removed - not needed in sidebar
        priceRange: {
          min: minPrice === Infinity ? 0 : Math.floor(minPrice),
          max: maxPrice === -Infinity ? 0 : Math.ceil(maxPrice),
        },
        totalProducts: products.length,
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

