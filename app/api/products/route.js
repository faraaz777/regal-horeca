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

    // Category filter
    if (categorySlug) {
      const Category = (await import('@/lib/models/Category')).default;
      const category = await Category.findOne({ slug: categorySlug });
      if (category) {
        // Get all subcategories recursively
        const getAllSubcategoryIds = async (parentId) => {
          const children = await Category.find({ parent: parentId });
          let ids = [parentId];
          for (const child of children) {
            ids = ids.concat(await getAllSubcategoryIds(child._id));
          }
          return ids;
        };
        const categoryIds = await getAllSubcategoryIds(category._id);
        query.categoryId = { $in: categoryIds };
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
      query.$or = [
        { title: { $regex: searchQuery, $options: 'i' } },
        { brand: { $regex: searchQuery, $options: 'i' } },
        { tags: { $in: [new RegExp(searchQuery, 'i')] } },
      ];
    }

    // Execute query
    const products = await Product.find(query)
      .populate('categoryId', 'name slug level')
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

    // Generate slug if not provided
    if (!productData.slug) {
      productData.slug = productData.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
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
      product: await Product.findById(product._id).populate('categoryId').lean(),
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

