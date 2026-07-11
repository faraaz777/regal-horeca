import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { updateProductInventoryRule } from '@/lib/server/inventory/inventoryService';
import { inventoryRuleUpdateSchema } from '@/lib/server/inventory/schemas';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/inventory/[productId]/rules
 *
 * Updates inventory gate rules for a product.
 * Permissions: super_admin, inventory_manager
 */
export async function PATCH(request, { params }) {
  const auth = await requireAuth(request, {
    roles: ['super_admin', 'inventory_manager'],
  });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const body = await request.json();
    const parsed = inventoryRuleUpdateSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.errors.map((e) => e.message).join('; ');
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const inventoryRule = await updateProductInventoryRule({
      productId: params.productId,
      payload: parsed.data,
      userId: auth.session.userId,
      actorRole: auth.session.role,
      request,
    });

    return NextResponse.json({ success: true, inventoryRule });
  } catch (error) {
    console.error('inventory rule update error:', error);
    const status = error.message === 'Product not found' ? 404 : 400;
    return NextResponse.json({ error: error.message || 'Failed to update rules' }, { status });
  }
}
