import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { listCollections, createCollection } from '@/lib/server/sales/collectionService';
import { collectionCreateSchema, formatZodError } from '@/lib/server/sales/schemas';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireAuth(request, { permission: 'sales:collections:read' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const collections = await listCollections(auth.session);
    return NextResponse.json({ success: true, collections });
  } catch (error) {
    console.error('List collections:', error);
    return NextResponse.json({ error: 'Failed to list collections' }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await requireAuth(request, { permission: 'sales:collections:write' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const body = await request.json().catch(() => ({}));
    const parsed = collectionCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    const result = await createCollection(auth.session, parsed.data, request);
    if (result?.error === 'invalid_thumbnail') {
      return NextResponse.json({ error: 'Invalid thumbnail URL' }, { status: 400 });
    }

    return NextResponse.json({ success: true, collection: result }, { status: 201 });
  } catch (error) {
    console.error('Create collection:', error);
    return NextResponse.json({ error: 'Failed to create collection' }, { status: 500 });
  }
}
