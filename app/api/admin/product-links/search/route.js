/**
 * GET /api/admin/product-links/search?q=
 * GET /api/admin/product-links/search?sourceId=&q=&limit=
 *
 * Sellable SKU lookup for the mapping workspace.
 * With sourceId and empty q, returns workbench candidates near the master.
 * Includes client-hidden SKUs. Parents are excluded.
 *
 * Permissions: products:read
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { connectToDatabase } from '@/lib/db/connect';
import {
  browseMappableSkus,
  searchMappableSkus,
} from '@/lib/server/products/productLinkService';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireAuth(request, { permission: 'products:read' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const params = new URL(request.url).searchParams;
    const q = params.get('q') || '';
    const sourceId = params.get('sourceId') || '';
    const limit = Number(params.get('limit')) || (sourceId ? 60 : 20);

    const data = sourceId
      ? await browseMappableSkus(sourceId, { q, limit })
      : await searchMappableSkus(q, limit);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Product link search error:', error);
    return NextResponse.json({ success: false, error: 'Search failed.' }, { status: 500 });
  }
}
