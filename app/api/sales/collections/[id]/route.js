/**
 * GET/PATCH/DELETE /api/sales/collections/:id
 *
 * Collection detail includes products plus the presentation set (scenes + pins).
 * PATCH accepts name/description/thumbnail/pinned and presentationSet.
 *
 * Permissions:
 * GET  sales:collections:read
 * PATCH/DELETE sales:collections:write
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import {
  getCollectionDetail,
  updateCollection,
  deleteCollection,
} from '@/lib/server/sales/collectionService';
import { collectionPatchSchema, formatZodError } from '@/lib/server/sales/schemas';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const auth = await requireAuth(request, { permission: 'sales:collections:read' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const result = await getCollectionDetail(auth.session, params.id);
    if (result.error === 'not_found') {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }
    if (result.error === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Get collection:', error);
    return NextResponse.json({ error: 'Failed to load collection' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const auth = await requireAuth(request, { permission: 'sales:collections:write' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const body = await request.json().catch(() => ({}));
    const parsed = collectionPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    const result = await updateCollection(auth.session, params.id, parsed.data, request);
    if (result.error === 'not_found') {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }
    if (result.error === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (result.error === 'invalid_thumbnail') {
      return NextResponse.json({ error: 'Invalid thumbnail URL' }, { status: 400 });
    }
    if (result.error === 'invalid_scene') {
      return NextResponse.json({ error: 'Invalid presentation image URL' }, { status: 400 });
    }
    if (result.error === 'too_many_scenes') {
      return NextResponse.json({ error: 'Too many presentation photos' }, { status: 400 });
    }

    return NextResponse.json({ success: true, collection: result.collection });
  } catch (error) {
    console.error('Update collection:', error);
    return NextResponse.json({ error: 'Failed to update collection' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const auth = await requireAuth(request, { permission: 'sales:collections:write' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const result = await deleteCollection(auth.session, params.id, request);
    if (result.error === 'not_found') {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }
    if (result.error === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete collection:', error);
    return NextResponse.json({ error: 'Failed to delete collection' }, { status: 500 });
  }
}
