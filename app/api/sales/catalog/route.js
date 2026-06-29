import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { searchSalesCatalog } from '@/lib/server/sales/catalogService';
import { catalogQuerySchema, formatZodError } from '@/lib/server/sales/schemas';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireAuth(request, { permission: 'sales:catalog:read' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const parsed = catalogQuerySchema.safeParse({
      q: searchParams.get('q') || '',
      page: searchParams.get('page') || 1,
      limit: searchParams.get('limit') || 24,
      sort: searchParams.get('sort') || 'title',
      brands: searchParams.get('brands') || '',
      priceMin: searchParams.get('priceMin') || undefined,
      priceMax: searchParams.get('priceMax') || undefined,
      stock: searchParams.get('stock') || 'all',
      category: searchParams.get('category') || '',
    });

    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    const data = await searchSalesCatalog(parsed.data);
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    console.error('Sales catalog:', error);
    return NextResponse.json({ error: 'Failed to load catalog' }, { status: 500 });
  }
}
