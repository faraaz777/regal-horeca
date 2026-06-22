/**
 * POST /api/products/[id]/restore
 * Clears soft-delete so the product is live again (subject to slug uniqueness among active rows).
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import Product from '@/lib/models/Product';
import { revalidateProductSlugs } from '@/lib/utils/revalidate';
import { assertAdmin } from '@/lib/server/auth/adminApiGuard';
import { restoreCanonicalSlugOnUndelete } from '@/lib/server/products/slugArchive';

export async function POST(_request, { params }) {
  const authError = await assertAdmin(_request);
  if (authError) return authError;

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

    await restoreCanonicalSlugOnUndelete(product);

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

    const slugsToRevalidate = [product.slug];
    let cascadeRestored = 0;

    if (product.productType === 'parent') {
      const children = await Product.find({ parentProductId: product._id, deletedAt: { $ne: null } })
        .select('_id slug')
        .lean();
      if (children.length > 0) {
        // Skip restoration for any child whose slug is now claimed by an active row.
        const childIds = children.map((c) => c._id);
        const activeChildSlugs = await Product.find({
          _id: { $nin: childIds },
          slug: { $in: children.map((c) => c.slug).filter(Boolean) },
          deletedAt: null,
        })
          .select('slug')
          .lean();
        const blocked = new Set(activeChildSlugs.map((s) => s.slug));
        const restorable = children.filter((c) => !blocked.has(c.slug));
        if (restorable.length > 0) {
          for (const childRef of restorable) {
            const childDoc = await Product.findById(childRef._id);
            if (!childDoc) continue;
            await restoreCanonicalSlugOnUndelete(childDoc);
            const childConflict = await Product.findOne({
              _id: { $ne: childDoc._id },
              slug: childDoc.slug,
              deletedAt: null,
            })
              .select('_id')
              .lean();
            if (childConflict) continue;
            childDoc.deletedAt = null;
            await childDoc.save();
            cascadeRestored += 1;
            slugsToRevalidate.push(childDoc.slug);
          }
        }
      }
    }

    revalidateProductSlugs(slugsToRevalidate);

    return NextResponse.json({
      success: true,
      cascadeRestored,
      message:
        cascadeRestored > 0
          ? `Product and ${cascadeRestored} variant(s) restored.`
          : 'Product restored',
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
