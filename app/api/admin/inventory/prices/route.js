import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import Product from '@/lib/models/Product';
import { requireAuth } from '@/lib/server/auth/requireAuth';

export const dynamic = 'force-dynamic';

export async function PATCH(request) {
  const auth = await requireAuth(request, { permission: 'products:write' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const body = await request.json();
    const { productId, costPrice, sellingPrice } = body;

    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 });
    }

    const product = await Product.findById(productId);
    if (!product || product.deletedAt) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (costPrice != null) {
      const val = Number(costPrice);
      if (!Number.isFinite(val) || val < 0) {
        return NextResponse.json({ error: 'Invalid cost price' }, { status: 400 });
      }
      product.costPrice = val;
    }

    if (sellingPrice != null) {
      const val = Number(sellingPrice);
      if (!Number.isFinite(val) || val < 0) {
        return NextResponse.json({ error: 'Invalid selling price' }, { status: 400 });
      }
      product.sellingPrice = val;
      product.price = val;
    }

    await product.save();

    return NextResponse.json({
      success: true,
      product: {
        _id: product._id,
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
