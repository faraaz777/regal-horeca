import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { bulkUpdateRackPositions } from '@/lib/server/inventory/locationLayoutService';
import { bulkRackPositionsSchema, formatZodError } from '@/lib/server/inventory/schemas';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/inventory/locations/positions/bulk
 */
export async function PATCH(request) {
  const auth = await requireAuth(request, { permission: 'locations:write' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const body = await request.json();
    const parsed = bulkRackPositionsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    const result = await bulkUpdateRackPositions(parsed.data.positions);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
