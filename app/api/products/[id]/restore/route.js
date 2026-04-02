/**
 * POST /api/products/[id]/restore
 * Clears soft-delete so the product is live again (subject to slug uniqueness among active rows).
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import Product from '@/lib/models/Product';
import { revalidateHomepage, revalidatePath, revalidateProducts } from '@/lib/utils/revalidate';

export async function POST(_request, { params }) {
  try {
    await connectToDatabase();

    const { id } = params;
    const product = await Product.findById(id);
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (!product.deletedAt) {
      return NextResponse.json({ error: 'Product is not deleted' }, { status: 400 });
    }

    const conflict = await Product.findOne({
      _id: { $ne: product._id },
      slug: product.slug,
      deletedAt: null,
    }).select('_id title slug');

    if (conflict) {
      return NextResponse.json(
        {
          error:
            'Another active product is using this URL slug. Rename or remove the other product first, then restore.',
          code: 'SLUG_CONFLICT',
          conflictingProductId: conflict._id,
          conflictingTitle: conflict.title,
        },
        { status: 409 }
      );
    }

    product.deletedAt = null;
    await product.save();

    revalidateHomepage();
    revalidateProducts();
    if (product.slug) {
      revalidatePath(`/products/${product.slug}`);
    }
    revalidatePath('/sitemap.xml');

    return NextResponse.json({
      success: true,
      message: 'Product restored',
      product: await Product.findById(id)
        .populate('categoryId')
        .populate('categoryIds', 'name slug level')
        .populate('brandCategoryId', 'name slug level')
        .populate('brandCategoryIds', 'name slug level')
        .lean(),
    });
  } catch (error) {
    console.error('Error restoring product:', error);
    if (error.code === 11000) {
      return NextResponse.json(
        {
          error:
            'Cannot restore: slug conflicts with another active product. Change the slug on one of the products first.',
          code: 'SLUG_CONFLICT',
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to restore product', details: error.message },
      { status: 500 }
    );
  }
}
