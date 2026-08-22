/**
 * GET /api/admin/stats
 *
 * Owner glance plus leftover catalog counts. Operational numbers are scoped
 * to the caller's role so a salesman does not receive warehouse cost value.
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import Product from '@/lib/models/Product';
import Category from '@/lib/models/Category';
import BusinessType from '@/lib/models/BusinessType';
import Enquiry from '@/lib/models/Enquiry';
import InventoryRequest from '@/lib/models/InventoryRequest';
import StockLedger from '@/lib/models/StockLedger';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { hasPermission } from '@/lib/shared/permissions';
import { getSellableStockTotals } from '@/lib/server/inventory/inventoryReportsService';
import { getMySales, istMonthAndTodayStarts } from '@/lib/server/sales/mySalesService';
import { NEEDS_ACTION_STATUSES } from '@/lib/shared/salesConstants';
import { buildEnquiryListQuery } from '@/lib/server/enquiries/enquiryAccess';

const ADMIN_TOTAL_PRODUCTS_MATCH = {
  deletedAt: null,
  productType: { $ne: 'parent' },
};

async function soldQtySince(since, extra = {}) {
  const [row] = await StockLedger.aggregate([
    { $match: { type: 'sale_fulfill', createdAt: { $gte: since }, ...extra } },
    { $group: { _id: null, qty: { $sum: { $abs: '$qty' } } } },
  ]);
  return row?.qty || 0;
}

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const role = auth.session.role;
    const { todayStart, monthStart } = istMonthAndTodayStarts();

    const ops = {};

    if (hasPermission(role, 'inventory:read')) {
      const [stock, soldToday, soldMonth] = await Promise.all([
        getSellableStockTotals(),
        soldQtySince(todayStart),
        soldQtySince(monthStart),
      ]);
      ops.sellableQty = stock.qty;
      ops.sellableValue = stock.value;
      ops.soldTodayQty = soldToday;
      ops.soldMonthQty = soldMonth;
    } else if (hasPermission(role, 'sales:requests:read')) {
      const mine = await getMySales(auth.session);
      ops.soldTodayQty = mine.todayQty;
      ops.soldMonthQty = mine.monthQty;
    }

    if (hasPermission(role, 'inventory:requests:approve')) {
      ops.openRequests = await InventoryRequest.countDocuments({
        status: { $in: NEEDS_ACTION_STATUSES },
      });
    } else if (hasPermission(role, 'sales:requests:read')) {
      ops.openRequests = await InventoryRequest.countDocuments({
        salesUserId: auth.session.userId,
        status: { $in: NEEDS_ACTION_STATUSES },
      });
    }

    if (hasPermission(role, 'enquiries:read')) {
      ops.newEnquiries = await Enquiry.countDocuments(
        buildEnquiryListQuery(auth.session, { status: 'new' })
      );
    }

    const canSeeCatalog = hasPermission(role, 'products:write') || role === 'super_admin';
    let catalog = {};
    let recentProducts = [];

    if (canSeeCatalog) {
      const [statsResult] = await Product.aggregate([
        { $match: ADMIN_TOTAL_PRODUCTS_MATCH },
        {
          $facet: {
            total: [{ $count: 'count' }],
            featured: [{ $match: { featured: true } }, { $count: 'count' }],
            statusBreakdown: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          },
        },
      ]);

      recentProducts = await Product.find(ADMIN_TOTAL_PRODUCTS_MATCH)
        .select('title heroImage createdAt status slug')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

      const [totalCategories, totalBusinessTypes] = await Promise.all([
        Category.countDocuments(),
        BusinessType.countDocuments(),
      ]);

      const statusDistribution = {};
      (statsResult.statusBreakdown || []).forEach((item) => {
        statusDistribution[item._id] = item.count;
      });

      catalog = {
        totalProducts: statsResult.total[0]?.count || 0,
        totalCategories,
        totalBusinessTypes,
        featuredProducts: statsResult.featured[0]?.count || 0,
        inStockProducts: statusDistribution['In Stock'] || 0,
        outOfStockProducts: statusDistribution['Out of Stock'] || 0,
        preOrderProducts: statusDistribution['Pre-Order'] || 0,
        statusDistribution,
      };
    }

    return NextResponse.json(
      {
        success: true,
        stats: { ...catalog, ...ops },
        recentProducts,
      },
      {
        headers: { 'Cache-Control': 'private, no-store' },
      }
    );
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats', details: error.message },
      { status: 500 }
    );
  }
}
