/**
 * Single Product API Route
 * 
 * Handles operations on a single product.
 * 
 * GET /api/products/[id] - Get product by ID or slug
 * PUT /api/products/[id] - Update product (admin only)
 * DELETE /api/products/[id] - Soft-delete product (admin only). POST .../restore to undo.
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import Product from '@/lib/models/Product';
import { generateUniqueSlug } from '@/lib/utils/slug';
import { revalidateHomepage, revalidatePath, revalidateProducts } from '@/lib/utils/revalidate';
import { normalizeFilterValues } from '@/lib/utils/normalizeFilterValue';
import mongoose from 'mongoose';

/**
 * GET /api/products/[id]
 * Supports both MongoDB ObjectId and slug
 */
export async function GET(request, { params }) {
  let id;
  try {
    await connectToDatabase();

    id = params?.id;

    if (!id) {
      return NextResponse.json(
        { error: 'Product ID or slug is required' },
        { status: 400 }
      );
    }

    let product = null;

    // Check if id is a valid MongoDB ObjectId
    const isValidObjectId = mongoose.Types.ObjectId.isValid(id);

    const relatedPopulate = {
      path: 'relatedProductIds',
      match: { deletedAt: null },
      select: 'title slug heroImage price',
    };
    const fotPopulate = {
      path: 'frequentlyOrderedTogetherProductIds',
      match: { deletedAt: null },
      select: 'title slug heroImage price',
    };

    if (isValidObjectId) {
      // Try to find by ID first (includes soft-deleted — admin / cart resolution by id)
      try {
        product = await Product.findById(id)
          .populate('categoryId')
          .populate('categoryIds', 'name slug level')
          .populate('brandCategoryId', 'name slug level')
          .populate('brandCategoryIds', 'name slug level')
          .populate(relatedPopulate)
          .populate(fotPopulate)
          .lean();
      } catch (populateError) {
        // If populate fails, try without populate
        console.warn('Populate failed, trying without populate:', populateError.message);
        product = await Product.findById(id).lean();
      }
    }

    // If not found by ID (or id is not a valid ObjectId), try to find by slug (storefront: active only)
    if (!product) {
      try {
        product = await Product.findOne({ slug: id, deletedAt: null })
          .populate('categoryId')
          .populate('categoryIds', 'name slug level')
          .populate('brandCategoryId', 'name slug level')
          .populate('brandCategoryIds', 'name slug level')
          .populate(relatedPopulate)
          .populate(fotPopulate)
          .lean();
      } catch (populateError) {
        // If populate fails, try without populate
        console.warn('Populate failed for slug lookup, trying without populate:', populateError.message);
        product = await Product.findOne({ slug: id, deletedAt: null }).lean();
      }
    }

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Normalize filters (convert old object format to array format if needed)
    try {
      if (product.filters && !Array.isArray(product.filters)) {
        // Convert old object format {material: [], color: [], usage: []} to new array format
        const oldFilters = product.filters;
        product.filters = [];
        if (oldFilters && typeof oldFilters === 'object') {
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
        }
      } else if (!product.filters) {
        product.filters = [];
      }
    } catch (filterError) {
      console.warn('Error normalizing filters:', filterError.message);
      product.filters = [];
    }

    return NextResponse.json({
      success: true,
      product,
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    console.error('Error stack:', error.stack);
    console.error('Product ID/Slug:', id);
    
    // Provide more detailed error information
    const errorDetails = {
      message: error.message,
      name: error.name,
      ...(error.code && { code: error.code }),
      ...(error.keyPattern && { keyPattern: error.keyPattern }),
      ...(error.keyValue && { keyValue: error.keyValue }),
    };
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch product', 
        details: error.message,
        ...(process.env.NODE_ENV === 'development' && { fullError: errorDetails })
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/products/[id]
 * Updates a product
 * 
 * Slug regeneration logic:
 * - If title changes: Slug regenerates automatically from new title
 * - If title stays the same: Slug remains unchanged
 * - Manual slugs from client are always ignored
 * - Duplicate slugs auto-increment (e.g., "red-mug-1")
 */
export async function PUT(request, { params }) {
  try {
    await connectToDatabase();

    const { id } = params;
    const updateData = await request.json();

    // Handle categoryId - only remove if it's truly empty/null/undefined
    // If it's a valid string (ObjectId), MongoDB will convert it automatically
    if (updateData.categoryId === '' || updateData.categoryId === null || updateData.categoryId === undefined) {
      delete updateData.categoryId;
    } else if (typeof updateData.categoryId === 'string' && updateData.categoryId.trim() === '') {
      // Remove if it's a whitespace-only string
      delete updateData.categoryId;
    }
    // If categoryId is a valid string (ObjectId format), keep it - MongoDB will handle conversion

    // Handle categoryIds array
    if (updateData.categoryIds !== undefined) {
      if (!Array.isArray(updateData.categoryIds)) {
        updateData.categoryIds = [];
      } else {
        // Filter out empty values
        updateData.categoryIds = updateData.categoryIds.filter(id => id && id.trim() !== '');
      }
    }

    // Handle brandCategoryId - only remove if it's truly empty/null/undefined
    if (updateData.brandCategoryId === '' || updateData.brandCategoryId === null || updateData.brandCategoryId === undefined) {
      delete updateData.brandCategoryId;
    } else if (typeof updateData.brandCategoryId === 'string' && updateData.brandCategoryId.trim() === '') {
      delete updateData.brandCategoryId;
    }

    // Handle brandCategoryIds array
    if (updateData.brandCategoryIds !== undefined) {
      if (!Array.isArray(updateData.brandCategoryIds)) {
        updateData.brandCategoryIds = [];
      } else {
        // Filter out empty values
        updateData.brandCategoryIds = updateData.brandCategoryIds.filter(id => id && id.trim() !== '');
      }
    }

    // Find product
    const product = await Product.findById(id);
    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Store original slug before update (for revalidation)
    const oldSlug = product.slug;

    // Store original title for comparison
    const originalTitle = product.title;
    const newTitle = updateData.title;

    // Check if title changed
    const titleChanged = newTitle && newTitle.trim() !== originalTitle.trim();

    // Remove slug from updateData (always ignore manually provided slugs)
    delete updateData.slug;

    // If title changed, regenerate slug from new title
    if (titleChanged) {
      try {
        // Generate unique slug from new title
        // Exclude current product from duplicate check
        const newSlug = await generateUniqueSlug(newTitle, id);
        updateData.slug = newSlug;
      } catch (error) {
        console.error('Error generating slug:', error);
        return NextResponse.json(
          { error: 'Failed to generate slug from title', details: error.message },
          { status: 400 }
        );
      }
    }
    // If title didn't change, slug remains unchanged (not included in updateData)

    // Handle availableSizes - optional field, trim and set to empty string if not provided
    if (updateData.availableSizes !== undefined) {
      if (updateData.availableSizes === null || updateData.availableSizes === '') {
        updateData.availableSizes = '';
      } else {
        updateData.availableSizes = String(updateData.availableSizes).trim();
      }
    }

    // Normalize detailPhotos if provided (max 3)
    if (updateData.detailPhotos !== undefined) {
      if (!Array.isArray(updateData.detailPhotos)) {
        updateData.detailPhotos = [];
      } else {
        updateData.detailPhotos = updateData.detailPhotos.map(String).filter(Boolean).slice(0, 3);
      }
    }

    // Normalize FAQs if provided
    if (updateData.faqs !== undefined) {
      if (!Array.isArray(updateData.faqs)) {
        updateData.faqs = [];
      } else {
        updateData.faqs = updateData.faqs
          .filter(f => f && typeof f === 'object')
          .map(f => ({
            question: String(f.question || '').trim(),
            answer: String(f.answer || '').trim(),
          }))
          .filter(f => f.question && f.answer);
      }
    }

    // Normalize frequently ordered together ids if provided
    if (updateData.frequentlyOrderedTogetherProductIds !== undefined) {
      if (!Array.isArray(updateData.frequentlyOrderedTogetherProductIds)) {
        updateData.frequentlyOrderedTogetherProductIds = [];
      } else {
        updateData.frequentlyOrderedTogetherProductIds = updateData.frequentlyOrderedTogetherProductIds
          .filter(id => id && String(id).trim() !== '');
      }
    }

    // Normalize testimonials if provided
    if (updateData.testimonials !== undefined) {
      if (!Array.isArray(updateData.testimonials)) {
        updateData.testimonials = [];
      } else {
        updateData.testimonials = updateData.testimonials
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
    }

    // Normalize filters to array format if filters are being updated
    if (updateData.filters !== undefined) {
      if (!Array.isArray(updateData.filters)) {
        // Convert old object format to new array format
        const oldFilters = updateData.filters;
        updateData.filters = [];
        if (oldFilters.material && Array.isArray(oldFilters.material) && oldFilters.material.length > 0) {
          updateData.filters.push({ key: 'Material', values: normalizeFilterValues(oldFilters.material) });
        }
        if (oldFilters.size && Array.isArray(oldFilters.size) && oldFilters.size.length > 0) {
          updateData.filters.push({ key: 'Size', values: normalizeFilterValues(oldFilters.size) });
        }
        if (oldFilters.color && Array.isArray(oldFilters.color) && oldFilters.color.length > 0) {
          updateData.filters.push({ key: 'Color', values: normalizeFilterValues(oldFilters.color) });
        }
        if (oldFilters.usage && Array.isArray(oldFilters.usage) && oldFilters.usage.length > 0) {
          updateData.filters.push({ key: 'Usage', values: normalizeFilterValues(oldFilters.usage) });
        }
        // Handle any other keys
        Object.keys(oldFilters).forEach(key => {
          if (!['material', 'size', 'color', 'usage'].includes(key.toLowerCase()) && 
              Array.isArray(oldFilters[key]) && oldFilters[key].length > 0) {
            updateData.filters.push({ 
              key: key.charAt(0).toUpperCase() + key.slice(1), 
              values: normalizeFilterValues(oldFilters[key])
            });
          }
        });
      } else {
        // Ensure it's a valid array with proper structure; normalize values for consistent sidebar filtering
        updateData.filters = updateData.filters
          .filter(f => f && f.key && Array.isArray(f.values))
          .map(f => ({
            key: f.key.trim(),
            values: normalizeFilterValues(f.values.filter(v => v && v.trim()))
          }));
      }
    }

    // Update product
    Object.assign(product, updateData);
    await product.save();

    // Get the new slug (either from updateData if changed, or old slug)
    const newSlug = product.slug || oldSlug;

    // Revalidate homepage to update cached products
    revalidateHomepage();
    revalidateProducts();
    
    // Revalidate product pages for SEO
    if (oldSlug && oldSlug !== newSlug) {
      // If slug changed, revalidate old page (for redirect handling)
      revalidatePath(`/products/${oldSlug}`);
    }
    // Always revalidate new/current product page
    if (newSlug) {
      revalidatePath(`/products/${newSlug}`);
    }
    // Revalidate sitemap to include updated product
    revalidatePath('/sitemap.xml');

    return NextResponse.json({
      success: true,
      product: await Product.findById(id)
        .populate('categoryId')
        .populate('categoryIds', 'name slug level')
        .populate('brandCategoryId', 'name slug level')
        .populate('brandCategoryIds', 'name slug level')
        .lean(),
    });
  } catch (error) {
    console.error('Error updating product:', error);
    
    // Handle duplicate slug error (shouldn't happen with unique slug generation, but just in case)
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'Product with this slug already exists. Please try again.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update product', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/products/[id]
 * Soft-deletes a product (sets deletedAt). Images remain in R2 so restore keeps assets.
 */
export async function DELETE(request, { params }) {
  try {
    await connectToDatabase();

    const { id } = params;

    const product = await Product.findById(id);
    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    if (product.deletedAt) {
      return NextResponse.json(
        { error: 'Product is already deleted' },
        { status: 400 }
      );
    }

    const productSlug = product.slug;

    product.deletedAt = new Date();
    await product.save();

    revalidateHomepage();
    revalidateProducts();

    if (productSlug) {
      revalidatePath(`/products/${productSlug}`);
    }
    revalidatePath('/sitemap.xml');

    return NextResponse.json({
      success: true,
      message: 'Product moved to trash. You can restore it from the Deleted tab.',
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { error: 'Failed to delete product', details: error.message },
      { status: 500 }
    );
  }
}

