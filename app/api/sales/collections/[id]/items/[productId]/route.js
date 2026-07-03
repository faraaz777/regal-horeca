import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { removeCollectionItem } from '@/lib/server/sales/collectionService';

export const dynamic = 'force-dynamic';

export async function DELETE(request, { params }) {
  const auth = await requireAuth(request, { permission: 'sales:collections:write' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const result = await removeCollectionItem(
      auth.session,
      params.id,
      params.productId,
      request
    );
    if (result.error === 'not_found') {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }
    if (result.error === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (result.error === 'item_not_found') {
      return NextResponse.json({ error: 'Product not in collection' }, { status: 404 });
    }

    return NextResponse.json({ success: true, collection: result.collection });
  } catch (error) {
    console.error('Remove collection item:', error);
    return NextResponse.json({ error: 'Failed to remove product' }, { status: 500 });
  }
}
