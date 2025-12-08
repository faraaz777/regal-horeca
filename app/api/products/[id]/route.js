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
  try {
    await connectToDatabase();

    const { id } = params;

    let product = null;

    // Check if id is a valid MongoDB ObjectId
    const isValidObjectId = mongoose.Types.ObjectId.isValid(id);
    
    if (isValidObjectId) {
      // Try to find by ID first
      product = await Product.findById(id)
        .populate('categoryId')
        .populate('relatedProductIds', 'title slug heroImage price')
        .lean();
    }

    // If not found by ID (or id is not a valid ObjectId), try to find by slug
    if (!product) {
      product = await Product.findOne({ slug: id })
        .populate('categoryId')
        .populate('relatedProductIds', 'title slug heroImage price')
        .lean();
    }

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      product,
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product', details: error.message },
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

    // Update product
    Object.assign(product, updateData);
    await product.save();

    return NextResponse.json({
      success: true,
      product: await Product.findById(id).populate('categoryId').lean(),
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

