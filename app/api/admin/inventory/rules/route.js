import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { getDefaultLowStockThreshold, setStockRule } from '@/lib/server/inventory/inventoryService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/inventory/rules
 * Returns global default low-stock threshold (InventoryStockRule).
 * Per-product thresholds live on InventoryRule.minStock.
 */
export async function GET(request) {
  const auth = await requireAuth(request, { permission: 'inventory:read' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const defaultLowStockThreshold = await getDefaultLowStockThreshold();
    return NextResponse.json({ rules: { defaultLowStockThreshold } });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/inventory/rules
 * Updates global defaultLowStockThreshold only.
 * Per-product minStock is edited via InventoryRule (product rules UI).
 */
export async function PATCH(request) {
  const auth = await requireAuth(request, { permission: 'inventory:write' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const body = await request.json();

    if (body.productId != null || body.lowStockThreshold != null) {
      return NextResponse.json(
        {
          error:
            'Per-product low stock is InventoryRule.minStock. Update it from the product inventory rules UI.',
        },
        { status: 400 }
      );
    }

    if (body.defaultLowStockThreshold != null) {
      const val = Number(body.defaultLowStockThreshold);
      if (!Number.isFinite(val) || val < 0) {
        return NextResponse.json({ error: 'Invalid threshold' }, { status: 400 });
      }
      await setStockRule({
        key: 'defaultLowStockThreshold',
        value: val,
        userId: auth.session.userId,
      });
    }

    const defaultLowStockThreshold = await getDefaultLowStockThreshold();
    return NextResponse.json({ success: true, rules: { defaultLowStockThreshold } });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
