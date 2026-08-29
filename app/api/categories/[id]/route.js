/**
 * Single Category API Route
 * 
 * Handles operations on a single category.
 * 
 * GET /api/categories/[id] - Get category by ID
 * PUT /api/categories/[id] - Update category (admin only)
 * DELETE /api/categories/[id] - Delete category (admin only)
 */

import { NextResponse, after } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import Category from '@/lib/models/Category';
import { clearCategoryCache } from '@/lib/utils/categoryCache';
import { revalidateHomepage, revalidateCategories } from '@/lib/utils/revalidate';
import { requireAuth } from '@/lib/server/auth/requireAuth';

/**
 * GET /api/categories/[id]
 */
export async function GET(request, { params }) {
  try {
    await connectToDatabase();

    const { id } = params;

    const category = await Category.findById(id)
      .populate('parent', 'name slug level')
      .lean();

    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      category,
    });
  } catch (error) {
    console.error('Error fetching category:', error);
    return NextResponse.json(
      { error: 'Failed to fetch category', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/categories/[id]
 * Updates a category
 */
export async function PUT(request, { params }) {
  const auth = await requireAuth(request, { permission: 'categories:write' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();

    const { id } = params;
    const updateData = await request.json();

    // Find category
    const category = await Category.findById(id);
    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // Check if trying to delete a category with children
    if (updateData._action === 'delete') {
      const children = await Category.find({ parent: id });
      if (children.length > 0) {
        return NextResponse.json(
          { error: 'Cannot delete category with children. Please delete or reassign its children first.' },
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

    // Update category
    Object.assign(category, updateData);
    await category.save();

    // Clear category cache since structure changed
    clearCategoryCache();

    // Revalidate after response so admin UI isn't blocked
    try {
      after(() => {
        try {
          revalidateHomepage();
          revalidateCategories();
        } catch (e) {
          console.error('Error during category revalidation:', e);
        }
      });
    } catch (e) {
      // Fallback for runtimes where `after()` isn't available
      try {
        revalidateHomepage();
        revalidateCategories();
      } catch (err) {
        console.error('Error during category revalidation fallback:', err);
      }
    }

    return NextResponse.json({
      success: true,
      // Return saved doc directly (avoid extra DB round-trip)
      category: category.toObject({ virtuals: true }),
    });
  } catch (error) {
    console.error('Error updating category:', error);
    return NextResponse.json(
      { error: 'Failed to update category', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/categories/[id]
 * Deletes a category. Permissions: super_admin only.
 */
export async function DELETE(request, { params }) {
  const auth = await requireAuth(request, { roles: ['super_admin'] });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();

    const { id } = params;

    // Check if category has children
    const children = await Category.find({ parent: id });
    if (children.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete category with children. Please delete or reassign its children first.' },
        { status: 400 }
      );
    }

    // Check if category is used by products
    const Product = (await import('@/lib/models/Product')).default;
    const productsUsingCategory = await Product.find({ categoryId: id, deletedAt: null });
    if (productsUsingCategory.length > 0) {
      return NextResponse.json(
        { error: `Cannot delete category. ${productsUsingCategory.length} product(s) are using this category.` },
        { status: 400 }
      );
    }

    // Delete category
    await Category.findByIdAndDelete(id);

    // Clear category cache since structure changed
    clearCategoryCache();

    // Revalidate homepage to update cached categories
    revalidateHomepage();
    revalidateCategories();

    return NextResponse.json({
      success: true,
      message: 'Category deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    return NextResponse.json(
      { error: 'Failed to delete category', details: error.message },
      { status: 500 }
    );
  }
}

