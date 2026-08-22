import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { getFulfilmentSlip } from '@/lib/server/sales/requestService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sales/requests/[id]/slip
 *
 * Charge sheet for a fulfilled request. Salesman who owns it, or inventory /
 * super admin reviewing it.
 *
 * Permissions: sales:requests:read
 */
export async function GET(request, { params }) {
  const auth = await requireAuth(request, { permission: 'sales:requests:read' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const result = await getFulfilmentSlip(auth.session, params.id);
    if (result.error === 'not_found') {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }
    if (result.error === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (result.error === 'not_fulfilled') {
      return NextResponse.json(
        { error: 'Slip is available after the request is fulfilled' },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Fulfilment slip error:', error);
    return NextResponse.json({ error: 'Failed to load slip' }, { status: 500 });
  }
}
