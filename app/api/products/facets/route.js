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
 * - filters: Dynamic filters (Material, Size, etc.) with counts
 * - specs: Available specifications (Diameter, Volume, etc.) with counts
 * - priceRange: Min/max price in current product set
 * - statuses: Available statuses (In Stock, Out of Stock, Pre-Order)
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import Product from '@/lib/models/Product';
import { getCategoryIdsWithChildren } from '@/lib/utils/categoryCache';

const PREDEFINED_COLORS = [
  'Blue', 'Green', 'Red', 'Yellow', 'Purple', 'Orange', 
  'Pink', 'Brown', 'Gray', 'Black', 'White', 'Silver'
];

const FILTERABLE_SPECS = ['Diameter', 'Volume', 'Capacity', 'Size', 'Weight', 'Length', 'Width', 'Height'];

export async function GET(request) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const categorySlug = searchParams.get('category');
    const businessSlug = searchParams.get('business');
    const searchQuery = searchParams.get('search');
    const featured = searchParams.get('featured');
    const status = searchParams.get('status');

    // Build base query (same as products route)
    const query = {};
    const andConditions = [];

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
      query.businessTypeSlugs = businessSlug;
    }

    // Featured filter
    if (featured === 'true') {
      query.featured = true;
    }

    // Status filter (for base query, but we'll still calculate all statuses in facets)
    if (status) {
      query.status = status;
    }

    // Search filter
    if (searchQuery) {
      andConditions.push({
        $or: [
          { title: { $regex: searchQuery, $options: 'i' } },
          { brand: { $regex: searchQuery, $options: 'i' } },
          { tags: { $in: [new RegExp(searchQuery, 'i')] } },
        ]
      });
    }

    // Combine all conditions
    if (andConditions.length > 0) {
      query.$and = andConditions;
    }

    // Get products matching the base query (for facet calculation)
    // We don't need to populate or sort for facets, just get the data
    const products = await Product.find(query)
      .select('colorVariants brand filters specifications price status')
      .lean();

    // Calculate facets from products
    const colors = new Set();
    const brands = new Set();
    const filters = {};
    const specs = {};
    const statuses = new Set();
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

      // Dynamic filters
      if (product.filters && Array.isArray(product.filters)) {
        product.filters.forEach(filter => {
          if (filter.key && filter.values && Array.isArray(filter.values)) {
            if (!filters[filter.key]) {
              filters[filter.key] = {};
            }
            filter.values.forEach(value => {
              if (value && value.trim()) {
                const trimmedValue = value.trim();
                filters[filter.key][trimmedValue] = (filters[filter.key][trimmedValue] || 0) + 1;
              }
            });
          }
        });
      }

      // Specifications
      if (product.specifications && Array.isArray(product.specifications)) {
        product.specifications.forEach(spec => {
          if (spec.label && FILTERABLE_SPECS.includes(spec.label)) {
            const specKey = spec.label;
            const specValue = `${spec.value || ''}${spec.unit || ''}`.trim();
            if (specValue) {
              if (!specs[specKey]) {
                specs[specKey] = {};
              }
              specs[specKey][specValue] = (specs[specKey][specValue] || 0) + 1;
            }
          }
        });
      }

      // Status
      if (product.status) {
        statuses.add(product.status);
      }

      // Price range
      if (typeof product.price === 'number' && product.price >= 0) {
        minPrice = Math.min(minPrice, product.price);
        maxPrice = Math.max(maxPrice, product.price);
      }
    });

    // Convert sets to sorted arrays
    const colorsArray = Array.from(colors).sort();
    const brandsArray = Array.from(brands).sort();
    const statusesArray = Array.from(statuses).sort();

    // Convert filter/spec objects to arrays with counts
    const filtersWithCounts = {};
    Object.keys(filters).forEach(key => {
      filtersWithCounts[key] = Object.entries(filters[key])
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => a.value.localeCompare(b.value));
    });

    const specsWithCounts = {};
    Object.keys(specs).forEach(key => {
      specsWithCounts[key] = Object.entries(specs[key])
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => {
          // Try to sort numerically if possible
          const aNum = parseFloat(a.value);
          const bNum = parseFloat(b.value);
          if (!isNaN(aNum) && !isNaN(bNum)) {
            return aNum - bNum;
          }
          return a.value.localeCompare(b.value);
        });
    });

    return NextResponse.json({
      success: true,
      facets: {
        colors: colorsArray,
        brands: brandsArray,
        filters: filtersWithCounts,
        specs: specsWithCounts,
        statuses: statusesArray,
        priceRange: {
          min: minPrice === Infinity ? 0 : Math.floor(minPrice),
          max: maxPrice === -Infinity ? 0 : Math.ceil(maxPrice),
        },
        totalProducts: products.length,
      },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
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

