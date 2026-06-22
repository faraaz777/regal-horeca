import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import Product from '@/lib/models/Product';
import InventoryStock from '@/lib/models/InventoryStock';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { getDefaultLowStockThreshold, setStockRule } from '@/lib/server/inventory/inventoryService';

export const dynamic = 'force-dynamic';

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

export async function PATCH(request) {
  const auth = await requireAuth(request, { permission: 'inventory:write' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const body = await request.json();

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

    if (body.productId && body.lowStockThreshold != null) {
      const val = Number(body.lowStockThreshold);
      if (!Number.isFinite(val) || val < 0) {
        return NextResponse.json({ error: 'Invalid product threshold' }, { status: 400 });
      }
      const product = await Product.findById(body.productId);
      if (!product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }
      let row = await InventoryStock.findOne({
        productId: body.productId,
        locationId: body.locationId || null,
      });
      if (!row) {
        row = await InventoryStock.create({
          productId: body.productId,
          locationId: body.locationId || null,
          lowStockThreshold: val,
        });
      } else {
        row.lowStockThreshold = val;
        await row.save();
      }
    }

    const defaultLowStockThreshold = await getDefaultLowStockThreshold();
    return NextResponse.json({ success: true, rules: { defaultLowStockThreshold } });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
