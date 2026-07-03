import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { addCollectionItem } from '@/lib/server/sales/collectionService';
import { collectionItemSchema, formatZodError } from '@/lib/server/sales/schemas';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  const auth = await requireAuth(request, { permission: 'sales:collections:write' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const body = await request.json().catch(() => ({}));
    const parsed = collectionItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    const result = await addCollectionItem(auth.session, params.id, parsed.data, request);
    if (result.error === 'not_found') {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }
    if (result.error === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ success: true, collection: result.collection });
  } catch (error) {
    console.error('Add collection item:', error);
    return NextResponse.json({ error: 'Failed to add product' }, { status: 500 });
  }
}
