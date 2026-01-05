/**
 * Departments API Route (ISR Optimized)
 * 
 * Lightweight endpoint specifically for the department bar.
 * Uses ISR to cache departments at build time and revalidate periodically.
 * This improves initial page load performance and SEO.
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import Category from '@/lib/models/Category';

// ISR: Revalidate every hour (3600 seconds)
export const revalidate = 3600;

export async function GET() {
  try {
    await connectToDatabase();

    // Get only top-level categories (departments)
    const departments = await Category.find({ parent: null })
      .select('name slug level _id')
      .sort({ name: 1 })
      .lean();

    // Filter by level if it exists, otherwise return all top-level categories
    const filtered = departments.filter((cat) => {
      if (cat.level !== undefined) {
        return cat.level === 'department';
      }
      return true;
    });

    // If no departments found, use all top-level categories
    const result = filtered.length > 0 ? filtered : departments;

    // Format for department bar
    const formatted = result.map((cat) => ({
      _id: cat._id,
      id: cat._id,
      name: cat.name.toUpperCase(),
      slug: cat.slug,
      level: cat.level,
    }));

    return NextResponse.json({
      success: true,
      departments: formatted,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
        'CDN-Cache-Control': 'public, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error('Error fetching departments:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch departments', 
        departments: [] // Return empty array on error
      },
      { status: 500 }
    );
  }
}

