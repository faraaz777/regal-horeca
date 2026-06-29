import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { setBucketLines, addProductToBucket } from '@/lib/server/sales/bucketService';
import { bucketLineSchema, bucketLinesSchema, formatZodError } from '@/lib/server/sales/schemas';

export const dynamic = 'force-dynamic';

/** Replace all lines (PUT) or add/update single line (POST). */
export async function PUT(request, { params }) {
  const auth = await requireAuth(request, { permission: 'sales:buckets:write' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const body = await request.json();
    const parsed = bucketLinesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    const result = await setBucketLines(auth.session, params.id, parsed.data.lines, request);
    if (result.error === 'not_found') {
      return NextResponse.json({ error: 'Bucket not found' }, { status: 404 });
    }
    if (result.error === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (result.error === 'not_editable') {
      return NextResponse.json({ error: 'Submitted buckets cannot be edited' }, { status: 400 });
    }
    if (result.error === 'invalid_product') {
      return NextResponse.json({ error: 'Invalid product', productId: result.productId }, { status: 400 });
    }
    if (result.error === 'invalid_pricing') {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, bucket: result.bucket });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update lines' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const auth = await requireAuth(request, { permission: 'sales:buckets:write' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const body = await request.json();
    const parsed = bucketLineSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    const result = await addProductToBucket(auth.session, params.id, parsed.data, request);
    if (result.error === 'not_found') {
      return NextResponse.json({ error: 'Bucket not found' }, { status: 404 });
    }
    if (result.error === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (result.error === 'not_editable') {
      return NextResponse.json({ error: 'Submitted buckets cannot be edited' }, { status: 400 });
    }
    if (result.error === 'invalid_product') {
      return NextResponse.json({ error: 'Invalid product' }, { status: 400 });
    }
    if (result.error === 'invalid_pricing') {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, bucket: result.bucket });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to add product' }, { status: 500 });
  }
}
