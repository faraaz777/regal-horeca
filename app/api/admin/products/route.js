/**
 * Admin Products API Route
 *
 * Unified, uncached admin list. Returns parents, children, and standalones in a
 * single response. Children belonging to a parent on this page are appended to
 * keep them grouped (so a parent never ends a page with its children dangling on
 * the next one). Visibility filters from queryProducts are bypassed via
 * `adminMode: true`.
 *
 * GET /api/admin/products?
 *   page=1&limit=20
 *   search=...
 *   showDeleted=true|false
 *   productType=parent|child|standalone
 *   parentProductId=<id>
 *   adminListFilter=all|parents|children|catalog_visible|hidden_catalog
 */

import { NextResponse } from 'next/server';
import Product from '@/lib/models/Product';
import { queryProducts } from '@/lib/server/products/queryProducts';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search');
    const showDeleted = searchParams.get('showDeleted') === 'true';
    const includeAll = searchParams.get('includeAll') === 'true';
    const productType = searchParams.get('productType');
    const parentProductId = searchParams.get('parentProductId');
    const adminListFilter = searchParams.get('adminListFilter') || 'all';

    let listMode = 'active';
    if (includeAll) listMode = 'all';
    else if (showDeleted) listMode = 'deleted';

    const { products, pagination } = await queryProducts({
      adminMode: true,
      searchQuery: search,
      page,
      limit,
      listMode,
      productType,
      parentProductId,
      adminListFilter,
      sortBy: 'newest',
    });

    // Group children with their parents on the current page so the UI can render
    // a parent followed by its variant rows without straddling pagination boundaries.
    const parentIdsOnPage = products
      .filter((p) => p.productType === 'parent')
      .map((p) => p._id);

    let attachedChildren = [];
    if (parentIdsOnPage.length > 0) {
      const childMatch = { parentProductId: { $in: parentIdsOnPage } };
      if (listMode !== 'all') childMatch.deletedAt = listMode === 'deleted' ? { $ne: null } : null;
      attachedChildren = await Product.find(childMatch)
        .select(
          'title slug heroImage gallery price brand status sku barcode hsnCode productType parentProductId variationAttributes variationTheme visibleOnClient showInCatalog defaultChildProductId legacyParentVariantId createdAt deletedAt'
        )
        .sort({ createdAt: 1 })
        .lean();
    }

    return NextResponse.json(
      {
        success: true,
        products,
        attachedChildren,
        pagination,
        total: pagination.total,
        skip: (pagination.page - 1) * pagination.limit,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error('Error fetching admin products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch admin products', details: error.message },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
