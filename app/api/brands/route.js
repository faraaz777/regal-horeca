/**
 * Brands API Route
 * 
 * Handles CRUD operations for brands.
 * 
 * GET /api/brands - Get all brands (optionally as tree)
 * POST /api/brands - Create a new brand (admin only)
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import Brand from '@/lib/models/Brand';

/**
 * GET /api/brands
 * Query parameters:
 * - tree: Return as tree structure (true/false)
 * - level: Filter by level
 * - parent: Filter by parent ID
 */
export async function GET(request) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const asTree = searchParams.get('tree') === 'true';
    const level = searchParams.get('level');
    const parentId = searchParams.get('parent');

    if (asTree) {
      // Return as tree structure
      const tree = await Brand.buildTree();
      return NextResponse.json({
        success: true,
        brands: tree,
      });
    }

    // Build query
    const query = {};
    if (level) {
      query.level = level;
    }
    // Only filter by parent if explicitly requested
    // If parentId is 'null' string, filter for null parents
    // If parentId is provided, filter by that parent ID
    // If parentId is not provided (null), don't filter - return all brands
    if (parentId !== null && parentId !== undefined) {
      if (parentId === 'null') {
        query.parent = null;
      } else {
        query.parent = parentId;
      }
    }
    // If no parentId parameter, don't add parent filter - return all brands

    // Get all brands
    const brands = await Brand.find(query)
      .populate('parent', 'name slug level')
      .sort({ name: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      brands,
    });
  } catch (error) {
    console.error('Error fetching brands:', error);
    return NextResponse.json(
      { error: 'Failed to fetch brands', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/brands
 * Body: Brand object
 */
export async function POST(request) {
  try {
    await connectToDatabase();

    const brandData = await request.json();

    // Validate required fields
    if (!brandData.name || !brandData.level) {
      return NextResponse.json(
        { error: 'Name and level are required' },
        { status: 400 }
      );
    }

    // Generate slug if not provided
    if (!brandData.slug) {
      brandData.slug = brandData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    // Create brand
    const brand = new Brand(brandData);
    await brand.save();

    return NextResponse.json({
      success: true,
      brand: await Brand.findById(brand._id).populate('parent').lean(),
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating brand:', error);
    
    // Handle duplicate slug error
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'Brand with this slug already exists' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create brand', details: error.message },
      { status: 500 }
    );
  }
}

