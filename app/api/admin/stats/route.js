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
import { mongoStorefrontCatalogListingTypes } from '@/lib/utils/storefrontCatalogFilter';

export async function GET(request) {
  try {
    await connectToDatabase();

    // Stats exclude parent variant carriers because they are non-buyable, hidden
    // listings — counting them inflates the dashboard's "Total Products" number.
    // Children are counted (each is a real, individually buyable variant).
    // Stats: exclude parent carriers and child variants that are not opted into their
    // own storefront catalog row (aligned with public product listings).
    const storefrontCatalogMatch = {
      $and: [{ deletedAt: null }, { productType: { $ne: 'parent' } }, mongoStorefrontCatalogListingTypes()],
    };
    const [statsResult] = await Product.aggregate([
      { $match: storefrontCatalogMatch },
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

    // Recent products: also skip parents so the "Recently added" widget never shows a hidden carrier.
    const recentProducts = await Product.find(storefrontCatalogMatch)
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

