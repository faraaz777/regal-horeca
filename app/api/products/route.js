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
import { revalidateHomepage, revalidatePath, revalidateProducts } from '@/lib/utils/revalidate';
import { queryProducts } from '@/lib/server/products/queryProducts';
import { normalizeProductPayloadForCreate } from '@/lib/server/products/normalizeProductInput';
import { assertAdmin } from '@/lib/server/auth/adminApiGuard';

// Allow caching with revalidation for better performance
// Revalidate every 5 minutes (300 seconds)
export const revalidate = 300;

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
 *
 * Note: This route is storefront-only — always returns active (non-deleted) products.
 * `showDeleted` / `includeAll` query params are ignored. Admin deleted/all lists use
 * GET /api/admin/products (with auth when enabled).
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Context filters
    const categorySlug = searchParams.get('category');
    const businessSlug = searchParams.get('business');
    const searchQuery = searchParams.get('search');
    const featured = searchParams.get('featured');
    const status = searchParams.get('status');
    const idsParam = searchParams.get('ids');
    
    // User filters
    const priceMin = searchParams.get('priceMin');
    const priceMax = searchParams.get('priceMax');
    const colorsParam = searchParams.get('colors');
    const brandsParam = searchParams.get('brands');
    const filtersParam = searchParams.get('filters');
    const sortBy = searchParams.get('sortBy') || 'newest';
    
    // Pagination (public list: never expose soft-deleted or all-rows modes)
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '24');
    const listMode = 'active';

    const { products, pagination } = await queryProducts({
      categorySlug,
      businessSlug,
      searchQuery,
      featured,
      status,
      idsParam,
      priceMin,
      priceMax,
      colorsParam,
      brandsParam,
      filtersParam,
      sortBy,
      page,
      limit,
      includePopulates: true,
      listMode,
    });

    return NextResponse.json({
      success: true,
      products,
      pagination,
      // Keep backward compatibility
      total: pagination.total,
      skip: (pagination.page - 1) * pagination.limit,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'CDN-Cache-Control': 'public, s-maxage=300',
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
  const authError = assertAdmin(request);
  if (authError) return authError;

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

    normalizeProductPayloadForCreate(productData);

    // Create product
    const product = new Product(productData);
    await product.save();

    // Revalidate homepage to update cached products
    revalidateHomepage();
    revalidateProducts();
    
    // Revalidate product page and sitemap for SEO
    if (product.slug) {
      revalidatePath(`/products/${product.slug}`);
    }
    revalidatePath('/sitemap.xml');

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

