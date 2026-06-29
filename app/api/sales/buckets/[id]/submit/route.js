import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { submitBucketAsRequest } from '@/lib/server/sales/requestService';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  const auth = await requireAuth(request, { permission: 'sales:requests:write' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const result = await submitBucketAsRequest(auth.session, params.id, request);

    if (result.error === 'not_found') {
      return NextResponse.json({ error: 'Bucket not found' }, { status: 404 });
    }
    if (result.error === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (result.error === 'already_submitted') {
      return NextResponse.json({ error: 'Bucket already submitted' }, { status: 400 });
    }
    if (result.error === 'empty_bucket') {
      return NextResponse.json({ error: 'Add at least one product before submitting' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      request: result.request,
      stockWarnings: result.stockWarnings,
    });
  } catch (error) {
    console.error('Submit bucket:', error);
    return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 });
  }
}
