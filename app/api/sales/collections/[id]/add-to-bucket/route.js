import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { addCollectionToBucket } from '@/lib/server/sales/collectionService';
import { collectionAddToBucketSchema, formatZodError } from '@/lib/server/sales/schemas';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  const auth = await requireAuth(request, {
    permissions: ['sales:collections:read', 'sales:buckets:write'],
  });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const body = await request.json().catch(() => ({}));
    const parsed = collectionAddToBucketSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    const result = await addCollectionToBucket(
      auth.session,
      params.id,
      parsed.data.bucketId,
      request
    );

    if (result.error === 'not_found') {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }
    if (result.error === 'not_found') {
      return NextResponse.json({ error: 'Bucket not found' }, { status: 404 });
    }
    if (result.error === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (result.error === 'empty_collection') {
      return NextResponse.json({ error: 'Collection has no products' }, { status: 400 });
    }
    if (result.error === 'not_editable') {
      return NextResponse.json({ error: 'Submitted buckets cannot be edited' }, { status: 400 });
    }
    if (result.error === 'invalid_pricing') {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      bucket: result.bucket,
      added: result.added,
      skipped: result.skipped,
    });
  } catch (error) {
    console.error('Add collection to bucket:', error);
    return NextResponse.json({ error: 'Failed to add to bucket' }, { status: 500 });
  }
}
