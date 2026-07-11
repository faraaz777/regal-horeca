import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { removeRacksFromZone } from '@/lib/server/inventory/locationZoneRackService';
import { zoneRackRemoveSchema, formatZodError } from '@/lib/server/inventory/schemas';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  const auth = await requireAuth(request, { permission: 'locations:write' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const body = await request.json();
    const parsed = zoneRackRemoveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    const result = await removeRacksFromZone(
      params.locationId,
      params.zoneId,
      parsed.data.rackIds,
      parsed.data.layoutVersion,
      auth.session,
      request
    );
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error.code === 'LAYOUT_CONFLICT') {
      return NextResponse.json(
        { error: error.message, currentVersion: error.currentVersion },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
