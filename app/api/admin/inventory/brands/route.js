import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { listInventoryBrands } from '@/lib/server/inventory/inventoryService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/inventory/brands
 * Distinct brands for products in the live inventory ledger.
 */
export async function GET(request) {
  const auth = await requireAuth(request, { permission: 'inventory:read' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const brands = await listInventoryBrands();
    return NextResponse.json({ brands });
  } catch (error) {
    console.error('Inventory brands error:', error);
    return NextResponse.json({ error: error.message || 'Failed to load brands' }, { status: 500 });
  }
}
