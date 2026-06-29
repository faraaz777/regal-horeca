import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { getSessionWorkspace, closeActiveSession } from '@/lib/server/sales/sessionService';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireAuth(request, { permission: 'sales:buckets:write' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const workspace = await getSessionWorkspace(auth.session);
    return NextResponse.json({ success: true, ...workspace });
  } catch (error) {
    console.error('Sales session GET:', error);
    return NextResponse.json({ error: 'Failed to load session' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const auth = await requireAuth(request, { permission: 'sales:buckets:write' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const result = await closeActiveSession(auth.session);
    if (result.error === 'no_active_session') {
      return NextResponse.json({ error: 'No active session' }, { status: 404 });
    }
    if (result.error === 'draft_buckets_remain') {
      return NextResponse.json(
        {
          error: 'Close or submit draft buckets with items before ending session',
          draftCount: result.count,
        },
        { status: 400 }
      );
    }
    return NextResponse.json({ success: true, session: result.session });
  } catch (error) {
    console.error('Sales session close:', error);
    return NextResponse.json({ error: 'Failed to close session' }, { status: 500 });
  }
}
