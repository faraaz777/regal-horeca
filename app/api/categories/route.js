/**
 * Categories API Route
 * 
 * Handles CRUD operations for categories.
 * 
 * GET /api/categories - Get all categories (optionally as tree)
 * POST /api/categories - Create a new category (admin only)
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import Category from '@/lib/models/Category';
import { clearCategoryCache } from '@/lib/utils/categoryCache';

/**
 * GET /api/categories
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
      // Return as tree structure (cached on client side via SWR)
      const tree = await Category.buildTree();
      return NextResponse.json({
        success: true,
        categories: tree,
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
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
    // If parentId is not provided (null), don't filter - return all categories
    if (parentId !== null && parentId !== undefined) {
      if (parentId === 'null') {
        query.parent = null;
      } else {
        query.parent = parentId;
      }
    }
    // If no parentId parameter, don't add parent filter - return all categories

    // Get all categories
    const categories = await Category.find(query)
      .populate('parent', 'name slug level')
      .sort({ name: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      categories,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/categories
 * Body: Category object
 */
export async function POST(request) {
  try {
    await connectToDatabase();

    const categoryData = await request.json();

    // Validate required fields
    if (!categoryData.name || !categoryData.level) {
      return NextResponse.json(
        { error: 'Name and level are required' },
        { status: 400 }
      );
    }

    // Generate slug if not provided
    if (!categoryData.slug) {
      categoryData.slug = categoryData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    // Create category
    const category = new Category(categoryData);
    await category.save();

    // Clear category cache since structure changed
    clearCategoryCache();

    return NextResponse.json({
      success: true,
      category: await Category.findById(category._id).populate('parent').lean(),
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating category:', error);
    
    // Handle duplicate slug error
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'Category with this slug already exists' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create category', details: error.message },
      { status: 500 }
    );
  }
}

