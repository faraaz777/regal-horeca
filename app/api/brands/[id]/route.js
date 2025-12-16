/**
 * Single Brand API Route
 * 
 * Handles operations on a single brand.
 * 
 * GET /api/brands/[id] - Get brand by ID
 * PUT /api/brands/[id] - Update brand (admin only)
 * DELETE /api/brands/[id] - Delete brand (admin only)
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import Brand from '@/lib/models/Brand';

/**
 * GET /api/brands/[id]
 */
export async function GET(request, { params }) {
  try {
    await connectToDatabase();

    const { id } = params;

    const brand = await Brand.findById(id)
      .populate('parent', 'name slug level')
      .lean();

    if (!brand) {
      return NextResponse.json(
        { error: 'Brand not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      brand,
    });
  } catch (error) {
    console.error('Error fetching brand:', error);
    return NextResponse.json(
      { error: 'Failed to fetch brand', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/brands/[id]
 * Updates a brand
 */
export async function PUT(request, { params }) {
  try {
    await connectToDatabase();

    const { id } = params;
    const updateData = await request.json();

    // Find brand
    const brand = await Brand.findById(id);
    if (!brand) {
      return NextResponse.json(
        { error: 'Brand not found' },
        { status: 404 }
      );
    }

    // Check if trying to delete a brand with children
    if (updateData._action === 'delete') {
      const children = await Brand.find({ parent: id });
      if (children.length > 0) {
        return NextResponse.json(
          { error: 'Cannot delete brand with children. Please delete or reassign its children first.' },
          { status: 400 }
        );
      }
    }

    // Generate slug if not provided
    if (!updateData.slug && updateData.name) {
      updateData.slug = updateData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    // Update brand
    Object.assign(brand, updateData);
    await brand.save();

    return NextResponse.json({
      success: true,
      brand: await Brand.findById(id).populate('parent').lean(),
    });
  } catch (error) {
    console.error('Error updating brand:', error);
    return NextResponse.json(
      { error: 'Failed to update brand', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/brands/[id]
 * Deletes a brand
 */
export async function DELETE(request, { params }) {
  try {
    await connectToDatabase();

    const { id } = params;

    // Check if brand has children
    const children = await Brand.find({ parent: id });
    if (children.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete brand with children. Please delete or reassign its children first.' },
        { status: 400 }
      );
    }

    // Check if brand is used by products
    const Product = (await import('@/lib/models/Product')).default;
    const productsUsingBrand = await Product.find({ 
      $or: [
        { brandCategoryId: id },
        { brandCategoryIds: id }
      ]
    });
    if (productsUsingBrand.length > 0) {
      return NextResponse.json(
        { error: `Cannot delete brand. ${productsUsingBrand.length} product(s) are using this brand.` },
        { status: 400 }
      );
    }

    // Delete brand
    await Brand.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      message: 'Brand deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting brand:', error);
    return NextResponse.json(
      { error: 'Failed to delete brand', details: error.message },
      { status: 500 }
    );
  }
}

