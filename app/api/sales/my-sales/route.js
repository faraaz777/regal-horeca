import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { getMySales } from '@/lib/server/sales/mySalesService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sales/my-sales
 *
 * Completed sales credited to the logged-in user (today + this month).
 * Always scoped to the session — never accepts another user id.
 *
 * Permissions: sales:requests:read
 */
export async function GET(request) {
  const auth = await requireAuth(request, { permission: 'sales:requests:read' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const data = await getMySales(auth.session);
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    console.error('My sales error:', error);
    return NextResponse.json({ error: 'Failed to load sales' }, { status: 500 });
  }
}
