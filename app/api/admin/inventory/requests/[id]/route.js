import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { getRequestById, reviewRequest } from '@/lib/server/sales/requestService';
import { requestReviewSchema, formatZodError } from '@/lib/server/sales/schemas';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const auth = await requireAuth(request, { permission: 'inventory:requests:approve' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const result = await getRequestById(auth.session, params.id, { supervisor: true });
    if (result.error === 'not_found') {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load request' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const auth = await requireAuth(request, { permission: 'inventory:requests:approve' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const body = await request.json();
    const parsed = requestReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    if (parsed.data.action === 'cancel') {
      return NextResponse.json({ error: 'Use sales API to cancel' }, { status: 403 });
    }

    const result = await reviewRequest(auth.session, params.id, parsed.data, request);

    if (result.error === 'not_found') {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }
    if (result.error === 'comment_required') {
      return NextResponse.json({ error: 'Rejection comment is required' }, { status: 400 });
    }
    if (result.error === 'invalid_transition') {
      return NextResponse.json({ error: 'Invalid status transition' }, { status: 400 });
    }
    if (result.error === 'nothing_to_approve') {
      return NextResponse.json({ error: 'No lines could be approved' }, { status: 400 });
    }
    if (result.error === 'reservation_failed' || result.error === 'fulfill_failed') {
      return NextResponse.json({ error: result.message }, { status: 409 });
    }
    if (result.error === 'allocation_mismatch') {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }
    /**
     * Rejecting an approved request returns its stock first. If that fails the
     * request stays approved so the reject can be retried — surfaced as a
     * conflict rather than a success.
     */
    if (result.error === 'release_failed') {
      return NextResponse.json(
        { error: `Could not return reserved stock: ${result.message}` },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, request: result.request });
  } catch (error) {
    console.error('Review request:', error);
    return NextResponse.json({ error: 'Failed to review request' }, { status: 500 });
  }
}
