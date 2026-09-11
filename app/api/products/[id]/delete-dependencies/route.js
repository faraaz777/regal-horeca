/**
 * GET /api/products/[id]/delete-dependencies
 *
 * Read-only dependency report for soft-delete warning and Delete Forever UI.
 *
 * Permissions: products:write
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { assertProductWrite } from '@/lib/server/auth/adminApiGuard';
import { getProductDeleteDependencies } from '@/lib/server/products/productDeleteDependencies';

export async function GET(request, { params }) {
  const authError = await assertProductWrite(request);
  if (authError) return authError;

  try {
    await connectToDatabase();
    const deps = await getProductDeleteDependencies(params.id);
    return NextResponse.json({ success: true, dependencies: deps });
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    console.error('delete-dependencies failed', error);
    return NextResponse.json(
      { error: 'Failed to load delete dependencies', details: error.message },
      { status: 500 }
    );
  }
}
