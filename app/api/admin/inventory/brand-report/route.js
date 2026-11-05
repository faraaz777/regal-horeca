/**
 * GET /api/admin/inventory/brand-report
 *
 * facets=1 returns brands and category options.
 * Otherwise returns one page of grouped catalog articles with stock rules.
 * Any filter is enough. A search with no filter needs 2+ characters.
 *
 * Permissions: inventory:read
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { listBrandReportFacets, queryBrandReport } from '@/lib/server/inventory/brandReportService';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireAuth(request, { permission: 'inventory:read' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    if (searchParams.get('facets') === '1') {
      const facets = await listBrandReportFacets();
      return NextResponse.json({ success: true, ...facets });
    }

    const report = await queryBrandReport(Object.fromEntries(searchParams.entries()));
    return NextResponse.json({ success: true, ...report });
  } catch (error) {
    console.error('Brand report error:', error);
    return NextResponse.json({ error: error.message || 'Failed to load brand report' }, { status: 500 });
  }
}
