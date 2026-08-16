/**
 * POST /api/sales/collections/:id/items
 *
 * Adds one product ({ productId }) or several ({ productIds }) to a personal
 * collection. Duplicates are skipped. Batch add uses a single document save.
 *
 * Permissions:
 * sales:collections:write
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { addCollectionItem, addCollectionItems } from '@/lib/server/sales/collectionService';
import {
  collectionItemSchema,
  collectionItemsBatchSchema,
  formatZodError,
} from '@/lib/server/sales/schemas';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  const auth = await requireAuth(request, { permission: 'sales:collections:write' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const body = await request.json().catch(() => ({}));

    if (Array.isArray(body.productIds)) {
      const parsed = collectionItemsBatchSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
      }

      const result = await addCollectionItems(
        auth.session,
        params.id,
        parsed.data.productIds,
        request
      );
      if (result.error === 'not_found') {
        return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
      }
      if (result.error === 'forbidden') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      return NextResponse.json({
        success: true,
        collection: result.collection,
        added: result.added,
      });
    }

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
