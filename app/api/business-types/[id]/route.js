/**
 * Single Business Type API Route
 * 
 * Handles operations on a single business type.
 * 
 * GET /api/business-types/[id] - Get business type by ID
 * PUT /api/business-types/[id] - Update business type (admin only)
 * DELETE /api/business-types/[id] - Delete business type (admin only)
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import BusinessType from '@/lib/models/BusinessType';

/**
 * GET /api/business-types/[id]
 */
export async function GET(request, { params }) {
  try {
    await connectToDatabase();

    const { id } = params;

    const businessType = await BusinessType.findById(id).lean();

    if (!businessType) {
      return NextResponse.json(
        { error: 'Business type not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      businessType,
    });
  } catch (error) {
    console.error('Error fetching business type:', error);
    return NextResponse.json(
      { error: 'Failed to fetch business type', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/business-types/[id]
 * Updates a business type
 */
export async function PUT(request, { params }) {
  try {
    await connectToDatabase();

    const { id } = params;
    const updateData = await request.json();

    // Find business type
    const businessType = await BusinessType.findById(id);
    if (!businessType) {
      return NextResponse.json(
        { error: 'Business type not found' },
        { status: 404 }
      );
    }

    // Generate slug if not provided
    if (!updateData.slug && updateData.name) {
      updateData.slug = updateData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    // Update business type
    Object.assign(businessType, updateData);
    await businessType.save();

    return NextResponse.json({
      success: true,
      businessType: businessType.toObject(),
    });
  } catch (error) {
    console.error('Error updating business type:', error);
    
    // Handle duplicate slug error
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'Business type with this slug already exists' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update business type', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/business-types/[id]
 * Deletes a business type
 */
export async function DELETE(request, { params }) {
  try {
    await connectToDatabase();

    const { id } = params;

    // Check if business type exists
    const businessType = await BusinessType.findById(id);
    if (!businessType) {
      return NextResponse.json(
        { error: 'Business type not found' },
        { status: 404 }
      );
    }

    // Optional: Check if any products are using this business type
    // You can add this validation if needed
    // const Product = (await import('@/lib/models/Product')).default;
    // const productsUsingBusinessType = await Product.find({ 
    //   businessTypeSlugs: businessType.slug 
    // });
    // if (productsUsingBusinessType.length > 0) {
    //   return NextResponse.json(
    //     { error: `Cannot delete business type. ${productsUsingBusinessType.length} product(s) are using this business type.` },
    //     { status: 400 }
    //   );
    // }

    // Delete business type
    await BusinessType.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      message: 'Business type deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting business type:', error);
    return NextResponse.json(
      { error: 'Failed to delete business type', details: error.message },
      { status: 500 }
    );
  }
}

