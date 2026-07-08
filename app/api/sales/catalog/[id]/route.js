import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { getSalesProductDetail } from '@/lib/server/sales/productDetailService';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const auth = await requireAuth(request, { permission: 'sales:catalog:read' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const { id } = await params;
    if (!id || !/^[a-f\d]{24}$/i.test(id)) {
      return NextResponse.json({ error: 'Invalid product id' }, { status: 400 });
    }

    const product = await getSalesProductDetail(id);
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, product });
  } catch (error) {
    console.error('Sales catalog product detail:', error);
    return NextResponse.json({ error: 'Failed to load product' }, { status: 500 });
  }
}
