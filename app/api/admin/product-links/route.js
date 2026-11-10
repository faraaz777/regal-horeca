/**
 * GET /api/admin/product-links?productId=
 * POST /api/admin/product-links
 *
 * Lists or creates one SKU-to-SKU product mapping.
 * A link is only "this SKU ↔ that SKU" — no type or audience.
 * Stock, MRP and selling price are read live; they are not stored on the link.
 *
 * Permissions:
 * - Read: products:read (sales, inventory, catalog)
 * - Write: products:write or inventory:write
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { hasPermission } from '@/lib/shared/permissions';
import { connectToDatabase } from '@/lib/db/connect';
import {
  createProductLink,
  listProductLinks,
} from '@/lib/server/products/productLinkService';

export const dynamic = 'force-dynamic';

function canWriteMapping(role) {
  return hasPermission(role, 'products:write') || hasPermission(role, 'inventory:write');
}

export async function GET(request) {
  const auth = await requireAuth(request, { permission: 'products:read' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const productId = new URL(request.url).searchParams.get('productId') || '';
    if (!productId) {
      return NextResponse.json({ success: true, data: null, canWrite: canWriteMapping(auth.session.role) });
    }

    const result = await listProductLinks(productId);
    if (result.error) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: result,
      canWrite: canWriteMapping(auth.session.role),
    });
  } catch (error) {
    console.error('Product link list error:', error);
    return NextResponse.json({ success: false, error: 'Could not load mappings.' }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await requireAuth(request, { permission: 'products:read' });
  if (auth.error) return auth.error;
  if (!canWriteMapping(auth.session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await connectToDatabase();
    const body = await request.json();
    const result = await createProductLink({
      productId: body.productId,
      otherProductId: body.otherProductId,
      note: body.note,
      createdBy: auth.session.userId,
    });
    if (result.error) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    console.error('Product link create error:', error);
    return NextResponse.json({ success: false, error: 'Could not save the mapping.' }, { status: 500 });
  }
}
