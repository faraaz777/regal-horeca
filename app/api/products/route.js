/**
 * Products API Route
 * 
 * Handles CRUD operations for products.
 * 
 * GET /api/products - Get all products (with optional filters)
 * POST /api/products - Create a new product (admin only)
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import Product from '@/lib/models/Product';
import Category from '@/lib/models/Category';
import Brand from '@/lib/models/Brand';
import { generateUniqueSlug } from '@/lib/utils/slug';
import { getCategoryIdsWithChildren } from '@/lib/utils/categoryCache';
import { revalidateHomepage } from '@/lib/utils/revalidate';

// Force dynamic rendering to prevent caching issues in production
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/products
 * Query parameters:
 * - category: Filter by category slug
 * - business: Filter by business type slug
 * - search: Search query (uses MongoDB $text search)
 * - featured: Filter featured products (true/false)
 * - status: Filter by status
 * - priceMin: Minimum price
 * - priceMax: Maximum price
 * - colors: Comma-separated color names
 * - brands: Comma-separated brand names
 * - filters: JSON string of dynamic filters { "Material": ["Porcelain"], "Size": ["Large"] }
 * - sortBy: Sort order (newest, price-asc, price-desc)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 24)
 */
export async function GET(request) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    
    // Context filters
    const categorySlug = searchParams.get('category');
    const businessSlug = searchParams.get('business');
    const searchQuery = searchParams.get('search');
    const featured = searchParams.get('featured');
    const status = searchParams.get('status');
    
    // User filters
    const priceMin = searchParams.get('priceMin');
    const priceMax = searchParams.get('priceMax');
    const colorsParam = searchParams.get('colors');
    const brandsParam = searchParams.get('brands');
    const filtersParam = searchParams.get('filters');
    const sortBy = searchParams.get('sortBy') || 'newest';
    
    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '24');
    const skip = (page - 1) * limit;

    // Build query - MongoDB $text must be at root level, so we handle it separately
    const query = {};
    const andConditions = [];
    let useTextSearch = false;
    let textSearchQuery = null;

    // Text search - must be at root level, cannot be in $and
    if (searchQuery && searchQuery.trim()) {
      useTextSearch = true;
      textSearchQuery = { $text: { $search: searchQuery.trim() } };
    }

    // Category filter - use cached category tree
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

    // Status filter
    if (status) {
      andConditions.push({ status: status });
    }

    // Price filter - combine min and max into single condition
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
      andConditions.push({ price: priceConditions });
    }

    // Brand filter
    if (brandsParam) {
      const brands = brandsParam.split(',').map(b => b.trim()).filter(Boolean);
      if (brands.length > 0) {
        andConditions.push({ brand: { $in: brands } });
      }
    }

    // Color filter
    if (colorsParam) {
      const colors = colorsParam.split(',').map(c => c.trim()).filter(Boolean);
      if (colors.length > 0) {
        andConditions.push({
          'colorVariants.colorName': { $in: colors }
        });
      }
    }

    // Dynamic filters (from admin form)
    if (filtersParam) {
      try {
        const filters = JSON.parse(decodeURIComponent(filtersParam));
        if (typeof filters === 'object' && filters !== null) {
          Object.entries(filters).forEach(([filterKey, filterValues]) => {
            if (Array.isArray(filterValues) && filterValues.length > 0) {
              // Normalize filter key (capitalize first letter)
              const normalizedKey = filterKey.trim().charAt(0).toUpperCase() + filterKey.trim().slice(1).toLowerCase();
              // Normalize values
              const normalizedValues = filterValues.map(v => 
                v.trim().charAt(0).toUpperCase() + v.trim().slice(1).toLowerCase()
              );
              
      andConditions.push({
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
        // If using text search, sort by text score first, then by date
        if (useTextSearch) {
          sortObject = { score: { $meta: 'textScore' }, createdAt: -1 };
        } else {
          sortObject = { createdAt: -1 };
        }
        break;
    }

    // Execute query
    // For list views, select only needed fields to reduce payload size
    // For detail views (limit=1 or specific ID), fetch full document
    const isListQuery = limit > 1 && !searchParams.get('id');
    const selectFields = isListQuery 
      ? 'title slug heroImage price brand categoryId featured status createdAt sku tags colorVariants filters'
      : undefined; // undefined = fetch all fields
    
    let queryBuilder = Product.find(query);
    
    // Add text score projection if using text search
    if (useTextSearch) {
      // For text search, we need to add score projection
      // select() can be called multiple times - fields are additive
      if (selectFields) {
        queryBuilder = queryBuilder.select(selectFields);
      }
      // Add text score (must be added separately)
      queryBuilder = queryBuilder.select({ score: { $meta: 'textScore' } });
    } else if (selectFields) {
      queryBuilder = queryBuilder.select(selectFields);
    }
    
    let products = await queryBuilder
      .populate('categoryId', 'name slug level')
      .populate('categoryIds', 'name slug level')
      .populate('brandCategoryId', 'name slug level')
      .populate('brandCategoryIds', 'name slug level')
      .sort(sortObject)
      .limit(limit)
      .skip(skip)
      .lean();

    // Normalize filters for all products (convert old object format to array format)
    products = products.map(product => {
      if (product.filters && !Array.isArray(product.filters)) {
        // Convert old object format {material: [], color: [], usage: []} to new array format
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
        // Handle any other keys
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

    const total = await Product.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      products,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      // Keep backward compatibility
      total,
      skip,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/products
 * Body: Product object
 */
export async function POST(request) {
  try {
    await connectToDatabase();

    const productData = await request.json();

    // Validate required fields
    if (!productData.title || !productData.heroImage) {
      return NextResponse.json(
        { error: 'Title and heroImage are required' },
        { status: 400 }
      );
    }

    // Generate unique slug if not provided
    if (!productData.slug) {
      try {
        productData.slug = await generateUniqueSlug(productData.title);
      } catch (error) {
        return NextResponse.json(
          { error: 'Failed to generate slug from title', details: error.message },
          { status: 400 }
        );
      }
    } else {
      // If slug is manually provided, still ensure it's unique
      try {
        productData.slug = await generateUniqueSlug(productData.slug);
      } catch (error) {
        return NextResponse.json(
          { error: 'Failed to generate unique slug', details: error.message },
          { status: 400 }
        );
      }
    }

    // Handle categoryId - only remove if it's truly empty/null/undefined
    // If it's a valid string (ObjectId), MongoDB will convert it automatically
    if (productData.categoryId === '' || productData.categoryId === null || productData.categoryId === undefined) {
      delete productData.categoryId;
    } else if (typeof productData.categoryId === 'string' && productData.categoryId.trim() === '') {
      // Remove if it's a whitespace-only string
      delete productData.categoryId;
    }
    // If categoryId is a valid string (ObjectId format), keep it - MongoDB will handle conversion

    // Handle categoryIds array
    if (!productData.categoryIds || !Array.isArray(productData.categoryIds)) {
      productData.categoryIds = [];
    } else {
      // Filter out empty values
      productData.categoryIds = productData.categoryIds.filter(id => id && id.trim() !== '');
    }

    // Handle brandCategoryId - only remove if it's truly empty/null/undefined
    if (productData.brandCategoryId === '' || productData.brandCategoryId === null || productData.brandCategoryId === undefined) {
      delete productData.brandCategoryId;
    } else if (typeof productData.brandCategoryId === 'string' && productData.brandCategoryId.trim() === '') {
      delete productData.brandCategoryId;
    }

    // Handle brandCategoryIds array
    if (!productData.brandCategoryIds || !Array.isArray(productData.brandCategoryIds)) {
      productData.brandCategoryIds = [];
    } else {
      // Filter out empty values
      productData.brandCategoryIds = productData.brandCategoryIds.filter(id => id && id.trim() !== '');
    }

    // Set defaults for optional fields
    if (productData.price === undefined || productData.price === null || productData.price === '') {
      productData.price = 0;
    }
    if (!productData.status) {
      productData.status = 'In Stock';
    }
    // Normalize filters to array format
    if (!productData.filters) {
      productData.filters = [];
    } else if (!Array.isArray(productData.filters)) {
      // Convert old object format {material: [], color: [], usage: []} to new array format
      const oldFilters = productData.filters;
      productData.filters = [];
      if (oldFilters.material && Array.isArray(oldFilters.material) && oldFilters.material.length > 0) {
        productData.filters.push({ key: 'Material', values: oldFilters.material });
      }
      if (oldFilters.size && Array.isArray(oldFilters.size) && oldFilters.size.length > 0) {
        productData.filters.push({ key: 'Size', values: oldFilters.size });
      }
      if (oldFilters.color && Array.isArray(oldFilters.color) && oldFilters.color.length > 0) {
        productData.filters.push({ key: 'Color', values: oldFilters.color });
      }
      if (oldFilters.usage && Array.isArray(oldFilters.usage) && oldFilters.usage.length > 0) {
        productData.filters.push({ key: 'Usage', values: oldFilters.usage });
      }
      // Handle any other keys
      Object.keys(oldFilters).forEach(key => {
        if (!['material', 'size', 'color', 'usage'].includes(key.toLowerCase()) && 
            Array.isArray(oldFilters[key]) && oldFilters[key].length > 0) {
          productData.filters.push({ 
            key: key.charAt(0).toUpperCase() + key.slice(1), 
            values: oldFilters[key] 
          });
        }
      });
    } else {
      // Ensure it's a valid array with proper structure
      productData.filters = productData.filters
        .filter(f => f && f.key && Array.isArray(f.values))
        .map(f => ({
          key: f.key.trim(),
          values: f.values.filter(v => v && v.trim())
        }));
    }
    if (!productData.tags) {
      productData.tags = [];
    }
    // Handle availableSizes - optional field, trim and set to empty string if not provided
    if (productData.availableSizes === undefined || productData.availableSizes === null) {
      productData.availableSizes = '';
    } else {
      productData.availableSizes = String(productData.availableSizes).trim();
    }
    if (!productData.gallery) {
      productData.gallery = [];
    }
    if (!productData.specifications) {
      productData.specifications = [];
    }
    if (!productData.colorVariants) {
      productData.colorVariants = [];
    }
    if (!productData.businessTypeSlugs) {
      productData.businessTypeSlugs = [];
    }
    if (!productData.relatedProductIds) {
      productData.relatedProductIds = [];
    }

    // Create product
    const product = new Product(productData);
    await product.save();

    // Revalidate homepage to update cached products
    revalidateHomepage();

    return NextResponse.json({
      success: true,
      product: await Product.findById(product._id)
        .populate('categoryId')
        .populate('categoryIds', 'name slug level')
        .populate('brandCategoryId', 'name slug level')
        .populate('brandCategoryIds', 'name slug level')
        .lean(),
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    
    // Handle duplicate slug error
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'Product with this slug already exists' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create product', details: error.message },
      { status: 500 }
    );
  }
}

