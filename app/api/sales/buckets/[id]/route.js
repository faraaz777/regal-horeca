import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { updateBucket, deleteBucket } from '@/lib/server/sales/bucketService';
import { assertBucketAccess } from '@/lib/server/sales/sessionService';
import SalesBucket from '@/lib/models/SalesBucket';
import { bucketPatchSchema, formatZodError } from '@/lib/server/sales/schemas';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const auth = await requireAuth(request, { permission: 'sales:buckets:write' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const bucket = await SalesBucket.findById(params.id).lean();
    const access = await assertBucketAccess(auth.session, bucket);
    if (access.error === 'not_found') {
      return NextResponse.json({ error: 'Bucket not found' }, { status: 404 });
    }
    if (access.error === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ success: true, bucket });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load bucket' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const auth = await requireAuth(request, { permission: 'sales:buckets:write' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const body = await request.json();
    const parsed = bucketPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    const result = await updateBucket(auth.session, params.id, parsed.data, request);
    if (result.error === 'not_found') {
      return NextResponse.json({ error: 'Bucket not found' }, { status: 404 });
    }
    if (result.error === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (result.error === 'not_editable') {
      return NextResponse.json({ error: 'Submitted buckets cannot be edited' }, { status: 400 });
    }

    return NextResponse.json({ success: true, bucket: result.bucket });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update bucket' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const auth = await requireAuth(request, { permission: 'sales:buckets:write' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const result = await deleteBucket(auth.session, params.id, request);
    if (result.error === 'not_found') {
      return NextResponse.json({ error: 'Bucket not found' }, { status: 404 });
    }
    if (result.error === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (result.error === 'not_deletable') {
      return NextResponse.json({ error: 'Submitted buckets cannot be deleted' }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete bucket' }, { status: 500 });
  }
}
