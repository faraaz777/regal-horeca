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
import { generateUniqueSlug } from '@/lib/utils/slug';
import { getCategoryIdsWithChildren } from '@/lib/utils/categoryCache';

// Force dynamic rendering to prevent caching issues in production
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/products
 * Query parameters:
 * - category: Filter by category slug
 * - business: Filter by business type slug
 * - search: Search in title, brand, tags
 * - featured: Filter featured products (true/false)
 * - status: Filter by status
 * - limit: Limit results (default: 100)
 * - skip: Skip results for pagination
 */
export async function GET(request) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const categorySlug = searchParams.get('category');
    const businessSlug = searchParams.get('business');
    const searchQuery = searchParams.get('search');
    const featured = searchParams.get('featured');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '100');
    const skip = parseInt(searchParams.get('skip') || '0');

    // Build query
    const query = {};
    const andConditions = [];

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
      query.businessTypeSlugs = businessSlug;
    }

    // Featured filter
    if (featured === 'true') {
      query.featured = true;
    }

    // Status filter
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

    // Execute query
    const products = await Product.find(query)
      .populate('categoryId', 'name slug level')
      .populate('categoryIds', 'name slug level')
      .populate('brandCategoryId', 'name slug level')
      .populate('brandCategoryIds', 'name slug level')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const total = await Product.countDocuments(query);

    return NextResponse.json({
      success: true,
      products,
      total,
      limit,
      skip,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
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
    if (!productData.filters) {
      productData.filters = {
        material: [],
        color: [],
        usage: [],
      };
    }
    if (!productData.tags) {
      productData.tags = [];
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

