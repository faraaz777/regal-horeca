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
import { normalizeFilterValues } from '@/lib/utils/normalizeFilterValue';
import { queryProducts } from '@/lib/server/products/queryProducts';

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
    
    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '24');
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
        productData.filters.push({ key: 'Material', values: normalizeFilterValues(oldFilters.material) });
      }
      if (oldFilters.size && Array.isArray(oldFilters.size) && oldFilters.size.length > 0) {
        productData.filters.push({ key: 'Size', values: normalizeFilterValues(oldFilters.size) });
      }
      if (oldFilters.color && Array.isArray(oldFilters.color) && oldFilters.color.length > 0) {
        productData.filters.push({ key: 'Color', values: normalizeFilterValues(oldFilters.color) });
      }
      if (oldFilters.usage && Array.isArray(oldFilters.usage) && oldFilters.usage.length > 0) {
        productData.filters.push({ key: 'Usage', values: normalizeFilterValues(oldFilters.usage) });
      }
      // Handle any other keys
      Object.keys(oldFilters).forEach(key => {
        if (!['material', 'size', 'color', 'usage'].includes(key.toLowerCase()) && 
            Array.isArray(oldFilters[key]) && oldFilters[key].length > 0) {
          productData.filters.push({ 
            key: key.charAt(0).toUpperCase() + key.slice(1), 
            values: normalizeFilterValues(oldFilters[key])
          });
        }
      });
    } else {
      // Ensure it's a valid array with proper structure; normalize values for consistent sidebar filtering
      productData.filters = productData.filters
        .filter(f => f && f.key && Array.isArray(f.values))
        .map(f => ({
          key: f.key.trim(),
          values: normalizeFilterValues(f.values.filter(v => v && v.trim()))
        }));
    }
    if (!productData.tags) {
      productData.tags = [];
    }
    // Handle priceBySize - optional array of {price,size,unit}
    if (!Array.isArray(productData.priceBySize)) {
      productData.priceBySize = [];
    } else {
      productData.priceBySize = productData.priceBySize
        .filter(row => row && typeof row === 'object')
        .map(row => ({
          price: Number(row.price || 0),
          size: String(row.size || '').trim(),
          unit: String(row.unit || '').trim(),
        }))
        .filter(row => Number.isFinite(row.price) && row.price > 0);
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
    if (!productData.detailPhotos) {
      productData.detailPhotos = [];
    } else if (!Array.isArray(productData.detailPhotos)) {
      productData.detailPhotos = [];
    } else {
      productData.detailPhotos = productData.detailPhotos.map(String).filter(Boolean).slice(0, 3);
    }
    if (!productData.specifications) {
      productData.specifications = [];
    }
    if (!productData.testimonials) {
      productData.testimonials = [];
    } else if (!Array.isArray(productData.testimonials)) {
      productData.testimonials = [];
    } else {
      productData.testimonials = productData.testimonials
        .filter(t => t && typeof t === 'object')
        .map(t => ({
          quote: String(t.quote || '').trim(),
          authorName: String(t.authorName || '').trim(),
          authorRole: String(t.authorRole || '').trim(),
          companyName: String(t.companyName || '').trim(),
          companyLogo: String(t.companyLogo || '').trim(),
        }))
        .filter(t => t.quote);
    }
    if (!productData.faqs) {
      productData.faqs = [];
    } else if (!Array.isArray(productData.faqs)) {
      productData.faqs = [];
    } else {
      productData.faqs = productData.faqs
        .filter(f => f && typeof f === 'object')
        .map(f => ({
          question: String(f.question || '').trim(),
          answer: String(f.answer || '').trim(),
        }))
        .filter(f => f.question && f.answer);
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
    if (!productData.frequentlyOrderedTogetherProductIds) {
      productData.frequentlyOrderedTogetherProductIds = [];
    }
    if (productData.frequentlyOrderedTogetherProductIds && !Array.isArray(productData.frequentlyOrderedTogetherProductIds)) {
      productData.frequentlyOrderedTogetherProductIds = [];
    }

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

