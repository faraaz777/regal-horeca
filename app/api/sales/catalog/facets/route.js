import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { getSalesCatalogFacets } from '@/lib/server/sales/catalogQueryBuilder';
import { formatZodError } from '@/lib/server/sales/schemas';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const facetsSchema = z.object({
  q: z.string().trim().optional().default(''),
});

export async function GET(request) {
  const auth = await requireAuth(request, { permission: 'sales:catalog:read' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const parsed = facetsSchema.safeParse({ q: searchParams.get('q') || '' });
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    const facets = await getSalesCatalogFacets(parsed.data);
    return NextResponse.json({ success: true, facets });
  } catch (error) {
    console.error('Sales catalog facets:', error);
    return NextResponse.json({ error: 'Failed to load filters' }, { status: 500 });
  }
}
