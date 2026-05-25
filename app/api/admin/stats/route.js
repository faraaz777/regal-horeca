/**
 * Admin Stats API Route
 * 
 * Provides unified statistics for the admin dashboard.
 * Consolidates multiple API calls into a single endpoint for better performance.
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import Product from '@/lib/models/Product';
import Category from '@/lib/models/Category';
import BusinessType from '@/lib/models/BusinessType';
import { assertAdmin } from '@/lib/server/auth/adminApiGuard';

/** Active rows that are real catalog SKUs: standalones + every child variant (not parent carriers). */
const ADMIN_TOTAL_PRODUCTS_MATCH = {
  deletedAt: null,
  productType: { $ne: 'parent' },
};

export async function GET(request) {
  const authError = assertAdmin(request);
  if (authError) return authError;

  try {
    await connectToDatabase();

    // Total = standalones + all child variants (each variant row is one product).
    // Parent carriers are excluded — they are grouping shells, not sellable SKUs.
    const [statsResult] = await Product.aggregate([
      { $match: ADMIN_TOTAL_PRODUCTS_MATCH },
      {
        $facet: {
          total: [{ $count: 'count' }],
          featured: [
            { $match: { featured: true } },
            { $count: 'count' }
          ],
          statusBreakdown: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 }
              }
            }
          ],
        }
      }
    ]);

    // Recent products: standalones + variants only (no parent carriers).
    const recentProducts = await Product.find(ADMIN_TOTAL_PRODUCTS_MATCH)
      .select('title heroImage createdAt status slug')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // Get counts for categories and business types
    const [totalCategories, totalBusinessTypes] = await Promise.all([
      Category.countDocuments(),
      BusinessType.countDocuments(),
    ]);

    // Process status breakdown
    const statusDistribution = {};
    statsResult.statusBreakdown.forEach(item => {
      statusDistribution[item._id] = item.count;
    });

    const totalProducts = statsResult.total[0]?.count || 0;
    const featuredProducts = statsResult.featured[0]?.count || 0;
    const inStockProducts = statusDistribution['In Stock'] || 0;
    const outOfStockProducts = statusDistribution['Out of Stock'] || 0;
    const preOrderProducts = statusDistribution['Pre-Order'] || 0;

    return NextResponse.json({
      success: true,
      stats: {
        totalProducts,
        totalCategories,
        totalBusinessTypes,
        featuredProducts,
        inStockProducts,
        outOfStockProducts,
        preOrderProducts,
        statusDistribution,
      },
      recentProducts,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats', details: error.message },
      { status: 500 }
    );
  }
}

