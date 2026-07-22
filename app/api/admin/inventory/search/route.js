import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { searchInventoryProducts } from '@/lib/server/inventory/addToInventoryService';
import { inventorySearchSchema, formatZodError } from '@/lib/server/inventory/schemas';
import Stock from '@/lib/models/Stock';
import StockLedger from '@/lib/models/StockLedger';
import InventoryRule from '@/lib/models/InventoryRule';

function resolveSearchHeroImage(product) {
  if (product.heroImage?.trim()) return product.heroImage.trim();
  const galleryImage = Array.isArray(product.gallery) ? product.gallery.find(Boolean) : '';
  if (galleryImage) return galleryImage;
  const parent = product.parentProductId;
  if (parent?.heroImage?.trim()) return parent.heroImage.trim();
  const parentGalleryImage = Array.isArray(parent?.gallery) ? parent.gallery.find(Boolean) : '';
  return parentGalleryImage || '';
}

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/inventory/search
 *
 * Discovery only — product identity + badges.
 * Does NOT return live quantities (those belong on Stock snapshots / detail views).
 * Ledger is used only as a presence signal for “already in inventory”.
 */
export async function GET(request) {
  const auth = await requireAuth(request, { permission: 'inventory:read' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const parsed = inventorySearchSchema.safeParse({
      q: searchParams.get('q') || '',
      limit: searchParams.get('limit') || 50,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    const products = await searchInventoryProducts(parsed.data.q, parsed.data.limit);
    const productIds = products.map((p) => p._id);

    /**
     * Presence checks only — no qty aggregation.
     * inInventory = has ledger history OR any positive Stock snapshot row.
     */
    const [stockProductIds, ledgerProductIds, rules] = await Promise.all([
      productIds.length
        ? Stock.distinct('productId', {
            productId: { $in: productIds },
            qty: { $gt: 0 },
          })
        : [],
      productIds.length
        ? StockLedger.distinct('productId', { productId: { $in: productIds } })
        : [],
      productIds.length
        ? InventoryRule.find({ productId: { $in: productIds } })
            .select('productId deadStockMarked')
            .lean()
        : [],
    ]);

    const inInventorySet = new Set([
      ...stockProductIds.map(String),
      ...ledgerProductIds.map(String),
    ]);
    const ruleByProduct = new Map(rules.map((r) => [String(r.productId), r]));

    const enriched = products.map((p) => {
      const pid = String(p._id);
      const hasStock = inInventorySet.has(pid);
      const rule = ruleByProduct.get(pid);
      const isDeadStock = Boolean(rule?.deadStockMarked);

      return {
        _id: p._id,
        title: p.title,
        sku: p.sku,
        barcode: p.barcode,
        hsnCode: p.hsnCode,
        brand: p.brand,
        colour: p.colour,
        stockUnit: p.stockUnit || 'Pcs',
        productStatus: p.productStatus,
        heroImage: resolveSearchHeroImage(p),
        categoryName: p.categoryId?.name || '',
        departmentName: p.departmentId?.name || '',
        hasStock,
        isDeadStock,
        deadStockMarked: isDeadStock,
        condition: isDeadStock ? 'HAS_DEAD_STOCK' : 'NORMAL',
      };
    });

    enriched.sort((a, b) => {
      if (a.hasStock === b.hasStock) return a.title.localeCompare(b.title);
      return a.hasStock ? -1 : 1;
    });

    return NextResponse.json({ results: enriched });
  } catch (error) {
    console.error('Inventory search error:', error);
    return NextResponse.json({ error: error.message || 'Search failed' }, { status: 500 });
  }
}
