import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { listSoldForCandidates } from '@/lib/server/users/userService';

/**
 * GET /api/users/sold-for
 *
 * Active staff a Sold movement can be credited to.
 *
 * Separate from the enquiry assignee list: that one is gated on enquiry
 * access and includes data entry, while this is read by inventory staff on
 * the stock movement screen and excludes roles that never handle a sale.
 *
 * Permissions: inventory:write
 */
export async function GET(request) {
  const auth = await requireAuth(request, { permission: 'inventory:write' });
  if (auth.error) return auth.error;

  await connectToDatabase();
  const users = await listSoldForCandidates();

  return NextResponse.json({ success: true, users });
}
