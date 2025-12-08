/**
 * Business Types API Route
 * 
 * Handles CRUD operations for business types.
 * 
 * GET /api/business-types - Get all business types
 * POST /api/business-types - Create a new business type (admin only)
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import BusinessType from '@/lib/models/BusinessType';

/**
 * GET /api/business-types
 */
export async function GET(request) {
  try {
    await connectToDatabase();

    const businessTypes = await BusinessType.find()
      .sort({ name: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      businessTypes,
    });
  } catch (error) {
    console.error('Error fetching business types:', error);
    return NextResponse.json(
      { error: 'Failed to fetch business types', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/business-types
 * Body: BusinessType object
 */
export async function POST(request) {
  try {
    await connectToDatabase();

    const businessTypeData = await request.json();

    // Validate required fields
    if (!businessTypeData.name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Generate slug if not provided
    if (!businessTypeData.slug) {
      businessTypeData.slug = businessTypeData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    // Create business type
    const businessType = new BusinessType(businessTypeData);
    await businessType.save();

    return NextResponse.json({
      success: true,
      businessType: businessType.toObject(),
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating business type:', error);
    
    // Handle duplicate slug error
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'Business type with this slug already exists' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create business type', details: error.message },
      { status: 500 }
    );
  }
}

