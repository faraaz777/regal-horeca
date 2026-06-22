import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { getLocationTree } from '@/lib/server/inventory/locationTreeService';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireAuth(request, { permission: 'inventory:read' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const data = await getLocationTree();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Location tree error:', error);
    return NextResponse.json({ error: error.message || 'Failed to load locations' }, { status: 500 });
  }
}
