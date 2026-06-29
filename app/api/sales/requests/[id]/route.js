import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { getRequestById, reviewRequest } from '@/lib/server/sales/requestService';
import { requestReviewSchema, formatZodError } from '@/lib/server/sales/schemas';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const auth = await requireAuth(request, { permission: 'sales:requests:read' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const result = await getRequestById(auth.session, params.id);
    if (result.error === 'not_found') {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }
    if (result.error === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load request' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const auth = await requireAuth(request, { permission: 'sales:requests:write' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const body = await request.json();
    const parsed = requestReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    if (parsed.data.action !== 'cancel') {
      return NextResponse.json({ error: 'Sales users may only cancel requests' }, { status: 403 });
    }

    const result = await reviewRequest(auth.session, params.id, parsed.data, request);
    if (result.error === 'not_found') {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }
    if (result.error === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (result.error === 'invalid_transition') {
      return NextResponse.json({ error: 'Request cannot be cancelled in current status' }, { status: 400 });
    }

    return NextResponse.json({ success: true, request: result.request });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update request' }, { status: 500 });
  }
}
