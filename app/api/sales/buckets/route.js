import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { createBucket } from '@/lib/server/sales/bucketService';
import { getSessionWorkspace } from '@/lib/server/sales/sessionService';
import { bucketPatchSchema, formatZodError } from '@/lib/server/sales/schemas';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireAuth(request, { permission: 'sales:buckets:write' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const { buckets } = await getSessionWorkspace(auth.session);
    return NextResponse.json({ success: true, buckets });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to list buckets' }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await requireAuth(request, { permission: 'sales:buckets:write' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const body = await request.json().catch(() => ({}));
    const parsed = bucketPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    const bucket = await createBucket(auth.session, parsed.data);
    return NextResponse.json({ success: true, bucket }, { status: 201 });
  } catch (error) {
    console.error('Create bucket:', error);
    return NextResponse.json({ error: 'Failed to create bucket' }, { status: 500 });
  }
}
