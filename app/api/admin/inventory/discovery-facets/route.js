import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { listDiscoveryFilterOptions } from '@/lib/server/inventory/addToInventoryService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/inventory/discovery-facets
 *
 * Brand + color options for Add-to-inventory discovery.
 *
 * Uses the catalog product universe (non-parent, not deleted) — not ledger-only
 * brands from `/api/admin/inventory/brands`, which would hide SKUs not yet stocked.
 */
export async function GET(request) {
  const auth = await requireAuth(request, { permission: 'inventory:read' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const facets = await listDiscoveryFilterOptions();
    return NextResponse.json(facets);
  } catch (error) {
    console.error('Inventory discovery facets error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load filters' },
      { status: 500 }
    );
  }
}
