/**
 * Single Product API Route
 * 
 * Handles operations on a single product.
 * 
 * GET /api/products/[id] - Get product by ID or slug
 * PUT /api/products/[id] - Update product (admin only)
 * DELETE /api/products/[id] - Delete product (admin only)
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import Product from '@/lib/models/Product';
import { deleteFromR2 } from '@/lib/utils/r2Upload';
import { generateUniqueSlug } from '@/lib/utils/slug';
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

    if (isValidObjectId) {
      // Try to find by ID first
      try {
        product = await Product.findById(id)
          .populate('categoryId')
          .populate('categoryIds', 'name slug level')
          .populate('brandCategoryId', 'name slug level')
          .populate('brandCategoryIds', 'name slug level')
          .populate('relatedProductIds', 'title slug heroImage price')
          .lean();
      } catch (populateError) {
        // If populate fails, try without populate
        console.warn('Populate failed, trying without populate:', populateError.message);
        product = await Product.findById(id).lean();
      }
    }

    // If not found by ID (or id is not a valid ObjectId), try to find by slug
    if (!product) {
      try {
        product = await Product.findOne({ slug: id })
          .populate('categoryId')
          .populate('categoryIds', 'name slug level')
          .populate('brandCategoryId', 'name slug level')
          .populate('brandCategoryIds', 'name slug level')
          .populate('relatedProductIds', 'title slug heroImage price')
          .lean();
      } catch (populateError) {
        // If populate fails, try without populate
        console.warn('Populate failed for slug lookup, trying without populate:', populateError.message);
        product = await Product.findOne({ slug: id }).lean();
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

    // Normalize filters to array format if filters are being updated
    if (updateData.filters !== undefined) {
      if (!Array.isArray(updateData.filters)) {
        // Convert old object format to new array format
        const oldFilters = updateData.filters;
        updateData.filters = [];
        if (oldFilters.material && Array.isArray(oldFilters.material) && oldFilters.material.length > 0) {
          updateData.filters.push({ key: 'Material', values: oldFilters.material });
        }
        if (oldFilters.size && Array.isArray(oldFilters.size) && oldFilters.size.length > 0) {
          updateData.filters.push({ key: 'Size', values: oldFilters.size });
        }
        if (oldFilters.color && Array.isArray(oldFilters.color) && oldFilters.color.length > 0) {
          updateData.filters.push({ key: 'Color', values: oldFilters.color });
        }
        if (oldFilters.usage && Array.isArray(oldFilters.usage) && oldFilters.usage.length > 0) {
          updateData.filters.push({ key: 'Usage', values: oldFilters.usage });
        }
        // Handle any other keys
        Object.keys(oldFilters).forEach(key => {
          if (!['material', 'size', 'color', 'usage'].includes(key.toLowerCase()) && 
              Array.isArray(oldFilters[key]) && oldFilters[key].length > 0) {
            updateData.filters.push({ 
              key: key.charAt(0).toUpperCase() + key.slice(1), 
              values: oldFilters[key] 
            });
          }
        });
      } else {
        // Ensure it's a valid array with proper structure
        updateData.filters = updateData.filters
          .filter(f => f && f.key && Array.isArray(f.values))
          .map(f => ({
            key: f.key.trim(),
            values: f.values.filter(v => v && v.trim())
          }));
      }
    }

    // Update product
    Object.assign(product, updateData);
    await product.save();

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
 * Deletes a product and its images from R2
 */
export async function DELETE(request, { params }) {
  try {
    await connectToDatabase();

    const { id } = params;

    // Find product
    const product = await Product.findById(id);
    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Delete images from R2
    const imagesToDelete = [
      product.heroImage,
      ...product.gallery,
      ...product.colorVariants.flatMap(variant => variant.images),
    ].filter(Boolean);

    // Delete images in parallel (don't wait for completion)
    Promise.all(imagesToDelete.map(url => deleteFromR2(url)))
      .catch(err => console.error('Error deleting images from R2:', err));

    // Delete product from database
    await Product.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { error: 'Failed to delete product', details: error.message },
      { status: 500 }
    );
  }
}

