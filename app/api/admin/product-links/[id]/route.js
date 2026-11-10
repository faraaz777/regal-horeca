/**
 * DELETE /api/admin/product-links/[id]
 *
 * Removes one undirected SKU mapping. Does not change either product document.
 *
 * Permissions: products:write or inventory:write
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { hasPermission } from '@/lib/shared/permissions';
import { connectToDatabase } from '@/lib/db/connect';
import { deleteProductLink } from '@/lib/server/products/productLinkService';

export const dynamic = 'force-dynamic';

export async function DELETE(request, { params }) {
  const auth = await requireAuth(request, { permission: 'products:read' });
  if (auth.error) return auth.error;
  const canWrite = hasPermission(auth.session.role, 'products:write')
    || hasPermission(auth.session.role, 'inventory:write');
  if (!canWrite) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await connectToDatabase();
    const result = await deleteProductLink(params.id);
    if (result.error) {
      return NextResponse.json({ success: false, error: result.error }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Product link delete error:', error);
    return NextResponse.json({ success: false, error: 'Could not remove the mapping.' }, { status: 500 });
  }
}
