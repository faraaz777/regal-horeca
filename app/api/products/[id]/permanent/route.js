/**
 * DELETE /api/products/[id]/permanent
 *
 * Hard-delete a product that is already in trash, only when nothing depends on it.
 * Super Admin only. Images in R2 are left in place (safe; URLs may be shared).
 *
 * Permissions: roles: ['super_admin']
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { assertProductHardDelete } from '@/lib/server/auth/adminApiGuard';
import { hardDeleteProduct } from '@/lib/server/products/productDeleteDependencies';
import { revalidateHomepage, revalidateProducts } from '@/lib/utils/revalidate';

export async function DELETE(request, { params }) {
  const authError = await assertProductHardDelete(request);
  if (authError) return authError;

  try {
    await connectToDatabase();
    const result = await hardDeleteProduct(params.id);

    revalidateHomepage();
    revalidateProducts();

    return NextResponse.json({
      success: true,
      ...result,
      message: `Permanently deleted "${result.title}"${
        result.deletedChildren.length
          ? ` and ${result.deletedChildren.length} variant(s)`
          : ''
      }.`,
    });
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    if (error.code === 'NOT_IN_TRASH') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error.code === 'HAS_DEPENDENCIES') {
      return NextResponse.json(
        {
          error: error.message,
          code: 'HAS_DEPENDENCIES',
          dependencies: error.dependencies,
        },
        { status: 409 }
      );
    }
    console.error('permanent delete failed', error);
    return NextResponse.json(
      { error: 'Failed to permanently delete product', details: error.message },
      { status: 500 }
    );
  }
}
