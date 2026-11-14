/**
 * DELETE /api/admin/product-links/[id]?scope=pair|group&viewerProductId=
 *
 * Removes one undirected SKU mapping.
 * - scope=pair (default): delete only this edge
 * - scope=group: detach the peer from the connected group (all edges to that component)
 *
 * Permissions: products:write or inventory:write
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { hasPermission } from '@/lib/shared/permissions';
import { connectToDatabase } from '@/lib/db/connect';
import { deleteProductLink } from '@/lib/server/products/productLinkService';
import { PRODUCT_LINK_UNLINK_PAIR } from '@/lib/shared/productLink';

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
    const url = new URL(request.url);
    const scope = url.searchParams.get('scope') || PRODUCT_LINK_UNLINK_PAIR;
    const viewerProductId = url.searchParams.get('viewerProductId') || '';
    const result = await deleteProductLink(params.id, { scope, viewerProductId });
    if (result.error) {
      return NextResponse.json({ success: false, error: result.error }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Product link delete error:', error);
    return NextResponse.json({ success: false, error: 'Could not remove the mapping.' }, { status: 500 });
  }
}
