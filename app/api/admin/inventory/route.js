import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { listInventoryItems } from '@/lib/server/inventory/inventoryService';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireAuth(request, { permission: 'inventory:read' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const categoryId = searchParams.get('categoryId') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const data = await listInventoryItems({ search, categoryId, page, limit });
    return NextResponse.json(data);
  } catch (error) {
    console.error('Inventory list error:', error);
    return NextResponse.json({ error: error.message || 'Failed to load inventory' }, { status: 500 });
  }
}
