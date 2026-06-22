import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { hasPermission } from '@/lib/shared/permissions';
import { searchInventoryProducts } from '@/lib/server/inventory/addToInventoryService';
import { inventorySearchSchema, formatZodError } from '@/lib/server/inventory/schemas';
import { productHasLedgerEntries } from '@/lib/server/inventory/stockLedgerService';
import InventoryRule from '@/lib/models/InventoryRule';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireAuth(request, { permission: 'inventory:read' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const parsed = inventorySearchSchema.safeParse({
      q: searchParams.get('q') || '',
      limit: searchParams.get('limit') || 10,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    const products = await searchInventoryProducts(parsed.data.q, parsed.data.limit);

    const enriched = await Promise.all(
      products.map(async (p) => {
        const hasStock = await productHasLedgerEntries(p._id);
        const rule = await InventoryRule.findOne({ productId: p._id }).lean();
        return {
          _id: p._id,
          title: p.title,
          sku: p.sku,
          barcode: p.barcode,
          brand: p.brand,
          colour: p.colour,
          stockUnit: p.stockUnit,
          productStatus: p.productStatus,
          categoryName: p.categoryId?.name || '',
          departmentName: p.departmentId?.name || '',
          hasStock,
          hasInventoryRule: Boolean(rule),
        };
      })
    );

    return NextResponse.json({ results: enriched });
  } catch (error) {
    console.error('Inventory search error:', error);
    return NextResponse.json({ error: error.message || 'Search failed' }, { status: 500 });
  }
}
