/**
 * Combined Products + Facets API Route
 * 
 * Returns both products and facets in a single request for faster catalog page loading.
 * Uses ISR for caching to improve performance and SEO.
 * 
 * This reduces the number of API calls from 2 to 1, significantly improving load time.
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import Product from '@/lib/models/Product';
import { getCategoryIdsWithChildren } from '@/lib/utils/categoryCache';

// ISR: Revalidate every 5 minutes (300 seconds) - same as products route
export const revalidate = 300;

const PREDEFINED_COLORS = [
  'Blue', 'Green', 'Red', 'Yellow', 'Purple', 'Orange', 
  'Pink', 'Brown', 'Gray', 'Black', 'White', 'Silver'
];

const ITEMS_PER_PAGE = 24;

export async function GET(request) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    
    // Context filters (used for both products and facets)
    const categorySlug = searchParams.get('category');
    const businessSlug = searchParams.get('business');
    const searchQuery = searchParams.get('search');
    const featured = searchParams.get('featured');
    const status = searchParams.get('status');
    
    // User filters (used only for products, not facets)
    const priceMin = searchParams.get('priceMin');
    const priceMax = searchParams.get('priceMax');
    const colorsParam = searchParams.get('colors');
    const brandsParam = searchParams.get('brands');
    const filtersParam = searchParams.get('filters');
    const sortBy = searchParams.get('sortBy') || 'newest';
    
    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || String(ITEMS_PER_PAGE));
    const skip = (page - 1) * limit;

    // Build base query for facets (context filters only, no user filters)
    const facetsQuery = {};
    const facetsAndConditions = [];
    let useTextSearch = false;
    let textSearchQuery = null;

    // Text search
    if (searchQuery && searchQuery.trim()) {
      useTextSearch = true;
      textSearchQuery = { $text: { $search: searchQuery.trim() } };
    }

    // Category filter
    if (categorySlug) {
      const categoryIds = await getCategoryIdsWithChildren(categorySlug);
      if (categoryIds.length > 0) {
        facetsAndConditions.push({
          $or: [
            { categoryId: { $in: categoryIds } },
            { categoryIds: { $in: categoryIds } }
          ]
        });
      }
    }

    // Business type filter
    if (businessSlug) {
      facetsAndConditions.push({
        businessTypeSlugs: businessSlug
      });
    }

    // Featured filter
    if (featured === 'true') {
      facetsAndConditions.push({ featured: true });
    }

    // Status filter
    if (status) {
      facetsAndConditions.push({ status: status });
    }

    // Combine facets query conditions
    if (useTextSearch) {
      if (facetsAndConditions.length > 0) {
        facetsQuery.$and = [textSearchQuery, ...facetsAndConditions];
      } else {
        Object.assign(facetsQuery, textSearchQuery);
      }
    } else if (facetsAndConditions.length > 0) {
      facetsQuery.$and = facetsAndConditions;
    }

    // Build products query (includes user filters)
    const productsQuery = { ...facetsQuery };
    const productsAndConditions = [...facetsAndConditions];

    // Price filter
    const priceConditions = {};
    if (priceMin) {
      const min = parseFloat(priceMin);
      if (!isNaN(min)) {
        priceConditions.$gte = min;
      }
    }
    if (priceMax) {
      const max = parseFloat(priceMax);
      if (!isNaN(max)) {
        priceConditions.$lte = max;
      }
    }
    if (Object.keys(priceConditions).length > 0) {
      productsAndConditions.push({ price: priceConditions });
    }

    // Brand filter
    if (brandsParam) {
      const brands = brandsParam.split(',').map(b => b.trim()).filter(Boolean);
      if (brands.length > 0) {
        productsAndConditions.push({ brand: { $in: brands } });
      }
    }

    // Color filter
    if (colorsParam) {
      const colors = colorsParam.split(',').map(c => c.trim()).filter(Boolean);
      if (colors.length > 0) {
        productsAndConditions.push({
          'colorVariants.colorName': { $in: colors }
        });
      }
    }

    // Dynamic filters
    if (filtersParam) {
      try {
        const filters = JSON.parse(decodeURIComponent(filtersParam));
        if (typeof filters === 'object' && filters !== null) {
          Object.entries(filters).forEach(([filterKey, filterValues]) => {
            if (Array.isArray(filterValues) && filterValues.length > 0) {
              const normalizedKey = filterKey.trim().charAt(0).toUpperCase() + filterKey.trim().slice(1).toLowerCase();
              const normalizedValues = filterValues.map(v => 
                v.trim().charAt(0).toUpperCase() + v.trim().slice(1).toLowerCase()
              );
              
              productsAndConditions.push({
                filters: {
                  $elemMatch: {
                    key: normalizedKey,
                    values: { $in: normalizedValues }
                  }
                }
              });
            }
          });
        }
      } catch (error) {
        console.warn('Failed to parse filters param:', error);
      }
    }

    // Combine products query conditions
    if (useTextSearch) {
      if (productsAndConditions.length > 0) {
        productsQuery.$and = [textSearchQuery, ...productsAndConditions];
      } else {
        Object.assign(productsQuery, textSearchQuery);
      }
    } else if (productsAndConditions.length > 0) {
      productsQuery.$and = productsAndConditions;
    }

    // Build sort object
    let sortObject = {};
    switch (sortBy) {
      case 'price-asc':
        sortObject = { price: 1 };
        break;
      case 'price-desc':
        sortObject = { price: -1 };
        break;
      case 'newest':
      default:
        if (useTextSearch) {
          sortObject = { score: { $meta: 'textScore' }, createdAt: -1 };
        } else {
          sortObject = { createdAt: -1 };
        }
        break;
    }

    // Execute queries in parallel
    const [productsForFacets, products, totalCount] = await Promise.all([
      // Get all products for facet calculation (no pagination, no user filters)
      Product.find(facetsQuery)
        .select('colorVariants brand filters price')
        .lean(),
      // Get paginated products (with user filters)
      Product.find(productsQuery)
        .select('title slug heroImage price brand categoryId featured status createdAt sku tags colorVariants filters')
        .select(useTextSearch ? { score: { $meta: 'textScore' } } : {})
        .populate('categoryId', 'name slug level')
        .populate('categoryIds', 'name slug level')
        .populate('brandCategoryId', 'name slug level')
        .populate('brandCategoryIds', 'name slug level')
        .sort(sortObject)
        .limit(limit)
        .skip(skip)
        .lean(),
      // Get total count for pagination
      Product.countDocuments(productsQuery),
    ]);

    // Normalize filters for products
    const normalizedProducts = products.map(product => {
      if (product.filters && !Array.isArray(product.filters)) {
        const oldFilters = product.filters;
        product.filters = [];
        if (oldFilters.material && Array.isArray(oldFilters.material) && oldFilters.material.length > 0) {
          product.filters.push({ key: 'Material', values: oldFilters.material });
        }
        if (oldFilters.size && Array.isArray(oldFilters.size) && oldFilters.size.length > 0) {
          product.filters.push({ key: 'Size', values: oldFilters.size });
        }
        if (oldFilters.color && Array.isArray(oldFilters.color) && oldFilters.color.length > 0) {
          product.filters.push({ key: 'Color', values: oldFilters.color });
        }
        if (oldFilters.usage && Array.isArray(oldFilters.usage) && oldFilters.usage.length > 0) {
          product.filters.push({ key: 'Usage', values: oldFilters.usage });
        }
        Object.keys(oldFilters).forEach(key => {
          if (!['material', 'size', 'color', 'usage'].includes(key.toLowerCase()) && 
              Array.isArray(oldFilters[key]) && oldFilters[key].length > 0) {
            product.filters.push({ 
              key: key.charAt(0).toUpperCase() + key.slice(1), 
              values: oldFilters[key] 
            });
          }
        });
      } else if (!product.filters) {
        product.filters = [];
      }
      return product;
    });

    // Calculate facets from productsForFacets
    const colors = new Set();
    const brands = new Set();
    const filters = {};
    let minPrice = Infinity;
    let maxPrice = -Infinity;

    productsForFacets.forEach(product => {
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
            const normalizedKey = filter.key.trim().charAt(0).toUpperCase() + filter.key.trim().slice(1).toLowerCase();
            if (!filters[normalizedKey]) {
              filters[normalizedKey] = {};
            }
            filter.values.forEach(value => {
              if (value && value.trim()) {
                const normalizedValue = value.trim().charAt(0).toUpperCase() + value.trim().slice(1).toLowerCase();
                filters[normalizedKey][normalizedValue] = (filters[normalizedKey][normalizedValue] || 0) + 1;
              }
            });
          }
        });
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

    // Convert filter objects to arrays with counts
    const filtersWithCounts = {};
    Object.keys(filters).forEach(key => {
      filtersWithCounts[key] = Object.entries(filters[key])
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => a.value.localeCompare(b.value));
    });

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      success: true,
      products: normalizedProducts,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      facets: {
        colors: colorsArray,
        brands: brandsArray,
        filters: filtersWithCounts,
        priceRange: {
          min: minPrice === Infinity ? 0 : Math.floor(minPrice),
          max: maxPrice === -Infinity ? 0 : Math.ceil(maxPrice),
        },
        totalProducts: productsForFacets.length,
      },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'CDN-Cache-Control': 'public, s-maxage=300',
      },
    });
  } catch (error) {
    console.error('Error fetching products with facets:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch products with facets', 
        details: error.message,
        products: [],
        pagination: { total: 0, page: 1, totalPages: 1 },
        facets: {
          colors: [],
          brands: [],
          filters: {},
          priceRange: { min: 0, max: 0 },
          totalProducts: 0,
        },
      },
      { status: 500 }
    );
  }
}

