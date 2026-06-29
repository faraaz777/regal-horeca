import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { listRequests } from '@/lib/server/sales/requestService';
import { requestsListSchema, formatZodError } from '@/lib/server/sales/schemas';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireAuth(request, { permission: 'sales:requests:read' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const parsed = requestsListSchema.safeParse({
      status: searchParams.get('status') || undefined,
      page: searchParams.get('page') || 1,
      limit: searchParams.get('limit') || 50,
      q: searchParams.get('q') || '',
      days: searchParams.get('days') || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    const data = await listRequests(auth.session, { ...parsed.data, supervisor: false });
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to list requests' }, { status: 500 });
  }
}
