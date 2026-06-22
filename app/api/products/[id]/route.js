/**
 * Single Product API Route
 * 
 * Handles operations on a single product.
 * 
 * GET /api/products/[id] - Get product by ID or slug
 * PUT /api/products/[id] - Update product (admin only)
 * DELETE /api/products/[id] - Soft-delete product (admin only). POST .../restore to undo.
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import Product from '@/lib/models/Product';
import { generateUniqueSlug } from '@/lib/utils/slug';
import { archiveSlugOnSoftDelete } from '@/lib/server/products/slugArchive';
import { revalidateHomepage, revalidatePath, revalidateProducts, revalidateProductSlugs } from '@/lib/utils/revalidate';
import { resolveProduct, getSiblingChildren } from '@/lib/server/products/resolveProduct';
import { normalizeProductPayloadForUpdate, normalizeFiltersField } from '@/lib/server/products/normalizeProductInput';
import { assertProductWrite } from '@/lib/server/auth/adminApiGuard';
import { findBarcodeConflicts, normalizeBarcode } from '@/lib/server/products/barcodeValidation';
import { syncParentEmbeddedVariantFromChild } from '@/lib/server/products/syncParentEmbeddedVariants';
import { stripChildVariantOwnedFields } from '@/lib/shared/childVariantPayload';
import mongoose from 'mongoose';

/**
 * GET /api/products/[id]
 * Supports both MongoDB ObjectId and slug
 */
export async function GET(request, { params }) {
  let id;
  try {
    await connectToDatabase();

    id = params?.id;

    if (!id) {
      return NextResponse.json(
        { error: 'Product ID or slug is required' },
        { status: 400 }
      );
    }

    let product = null;

    // Check if id is a valid MongoDB ObjectId
    const isValidObjectId = mongoose.Types.ObjectId.isValid(id);

    const relatedPopulate = {
      path: 'relatedProductIds',
      match: { deletedAt: null },
      select: 'title slug heroImage price',
    };
    const fotPopulate = {
      path: 'frequentlyOrderedTogetherProductIds',
      match: { deletedAt: null },
      select: 'title slug heroImage price',
    };

    if (isValidObjectId) {
      // Try to find by ID first (includes soft-deleted — admin / cart resolution by id)
      try {
        product = await Product.findById(id)
          .populate('categoryId')
          .populate('categoryIds', 'name slug level')
          .populate('brandCategoryId', 'name slug level')
          .populate('brandCategoryIds', 'name slug level')
          .populate(relatedPopulate)
          .populate(fotPopulate)
          .lean();
      } catch (populateError) {
        // If populate fails, try without populate
        console.warn('Populate failed, trying without populate:', populateError.message);
        product = await Product.findById(id).lean();
      }
    }

    // If not found by ID (or id is not a valid ObjectId), try to find by slug (storefront: active only)
    if (!product) {
      try {
        product = await Product.findOne({ slug: id, deletedAt: null })
          .populate('categoryId')
          .populate('categoryIds', 'name slug level')
          .populate('brandCategoryId', 'name slug level')
          .populate('brandCategoryIds', 'name slug level')
          .populate(relatedPopulate)
          .populate(fotPopulate)
          .lean();
      } catch (populateError) {
        // If populate fails, try without populate
        console.warn('Populate failed for slug lookup, trying without populate:', populateError.message);
        product = await Product.findOne({ slug: id, deletedAt: null }).lean();
      }
    }

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Resolve parent/child inheritance so callers (cart drawer, related products,
    // ProductCard, etc.) get the merged shape regardless of whether the row is a
    // child variant. Standalones pass through unchanged.
    const productType = product.productType || 'standalone';
    if (productType === 'child' || productType === 'parent') {
      const resolved = await resolveProduct(product);
      if (resolved) {
        product = resolved;
      }
      if (productType === 'parent' || productType === 'child') {
        const parentIdForSiblings =
          productType === 'parent'
            ? product._id
            : product.parentProductId || product.parent?._id;
        if (parentIdForSiblings) {
          product.children = await getSiblingChildren(parentIdForSiblings, { visibleOnly: false });
        }
      }
    }

    try {
      product.filters = normalizeFiltersField(product.filters);
    } catch (filterError) {
      console.warn('Error normalizing filters:', filterError.message);
      product.filters = [];
    }

    return NextResponse.json({
      success: true,
      product,
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    console.error('Error stack:', error.stack);
    console.error('Product ID/Slug:', id);
    
    // Provide more detailed error information
    const errorDetails = {
      message: error.message,
      name: error.name,
      ...(error.code && { code: error.code }),
      ...(error.keyPattern && { keyPattern: error.keyPattern }),
      ...(error.keyValue && { keyValue: error.keyValue }),
    };
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch product', 
        details: error.message,
        ...(process.env.NODE_ENV === 'development' && { fullError: errorDetails })
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/products/[id]
 * Updates a product
 * 
 * Slug regeneration logic:
 * - If title changes: Slug regenerates automatically from new title
 * - If title stays the same: Slug remains unchanged
 * - Manual slugs from client are always ignored
 * - Duplicate slugs auto-increment (e.g., "red-mug-1")
 */
export async function PUT(request, { params }) {
  const authError = await assertProductWrite(request);
  if (authError) return authError;

  try {
    await connectToDatabase();

    const { id } = params;
    const updateData = await request.json();

    normalizeProductPayloadForUpdate(updateData);

    // Find product
    const product = await Product.findById(id);
    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    const resolvedProductType = product.productType || 'standalone';
    if (resolvedProductType === 'child') {
      stripChildVariantOwnedFields(updateData);
      if (updateData.productType === 'parent') delete updateData.productType;
    }

    // Store original slug before update (for revalidation)
    const oldSlug = product.slug;

    // Store original title for comparison
    const originalTitle = product.title;
    const newTitle = updateData.title;

    // Check if title changed
    const titleChanged = newTitle && newTitle.trim() !== originalTitle.trim();

    // Remove slug from updateData (always ignore manually provided slugs)
    delete updateData.slug;

    // If title changed, regenerate slug from new title
    if (titleChanged) {
      try {
        // Generate unique slug from new title
        // Exclude current product from duplicate check
        const newSlug = await generateUniqueSlug(newTitle, id);
        updateData.slug = newSlug;
      } catch (error) {
        console.error('Error generating slug:', error);
        return NextResponse.json(
          { error: 'Failed to generate slug from title', details: error.message },
          { status: 400 }
        );
      }
    }
    // If title didn't change, slug remains unchanged (not included in updateData)

    if (Object.prototype.hasOwnProperty.call(updateData, 'barcode')) {
      const nextBarcode = normalizeBarcode(updateData.barcode);
      if (nextBarcode) {
        const conflicts = await findBarcodeConflicts([nextBarcode], {
          excludeProductIds: [String(id)],
        });
        if (conflicts.length > 0) {
          const hit = conflicts[0];
          return NextResponse.json(
            {
              error: `Barcode "${nextBarcode}" is already used by "${hit.title}".`,
              conflicts,
            },
            { status: 400 }
          );
        }
      }
      updateData.barcode = nextBarcode;
    }

    // Update product (retry once on optimistic concurrency conflicts)
    Object.assign(product, updateData);
    try {
      await product.save();
    } catch (saveError) {
      if (saveError?.name !== 'VersionError') throw saveError;
      const fresh = await Product.findById(id);
      if (!fresh) throw saveError;
      Object.assign(fresh, updateData);
      await fresh.save();
    }

    if (resolvedProductType === 'child' && product.parentProductId) {
      await syncParentEmbeddedVariantFromChild(product.parentProductId, product);
    }

    // Get the new slug (either from updateData if changed, or old slug)
    const newSlug = product.slug || oldSlug;

    // Revalidate homepage to update cached products
    revalidateHomepage();
    revalidateProducts();
    
    // Revalidate product pages for SEO
    if (oldSlug && oldSlug !== newSlug) {
      // If slug changed, revalidate old page (for redirect handling)
      revalidatePath(`/products/${oldSlug}`);
    }
    // Always revalidate new/current product page
    if (newSlug) {
      revalidatePath(`/products/${newSlug}`);
    }
    // Revalidate sitemap to include updated product
    revalidatePath('/sitemap.xml');

    return NextResponse.json({
      success: true,
      product: await Product.findById(id)
        .populate('categoryId')
        .populate('categoryIds', 'name slug level')
        .populate('brandCategoryId', 'name slug level')
        .populate('brandCategoryIds', 'name slug level')
        .lean(),
    });
  } catch (error) {
    console.error('Error updating product:', error);
    
    // Handle duplicate slug error (shouldn't happen with unique slug generation, but just in case)
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'Product with this slug already exists. Please try again.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update product', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/products/[id]
 * Soft-deletes a product (sets deletedAt). Images remain in R2 so restore keeps assets.
 *
 * Cascade rules:
 * - Deleting a 'parent' soft-deletes all its non-deleted children atomically so the
 *   storefront doesn't end up with orphaned children pointing at a hidden parent.
 * - Deleting a 'child' or 'standalone' deletes only that row.
 */
export async function DELETE(request, { params }) {
  const authError = await assertProductWrite(request);
  if (authError) return authError;

  try {
    await connectToDatabase();

    const { id } = params;

    const product = await Product.findById(id);
    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    if (product.deletedAt) {
      return NextResponse.json(
        { error: 'Product is already deleted' },
        { status: 400 }
      );
    }

    const productSlug = product.slug;
    const now = new Date();

    const slugsToRevalidate = [productSlug];
    let cascadeCount = 0;

    if (product.productType === 'parent') {
      const children = await Product.find({ parentProductId: product._id, deletedAt: null })
        .select('_id slug')
        .lean();
      cascadeCount = children.length;
      if (cascadeCount > 0) {
        for (const child of children) {
          const doc = await Product.findById(child._id);
          if (!doc) continue;
          doc.deletedAt = now;
          await archiveSlugOnSoftDelete(doc);
          await doc.save();
          slugsToRevalidate.push(child.slug);
        }
      }
    }

    product.deletedAt = now;
    await archiveSlugOnSoftDelete(product);
    await product.save();

    revalidateProductSlugs(slugsToRevalidate);

    return NextResponse.json({
      success: true,
      cascadeDeleted: cascadeCount,
      message:
        cascadeCount > 0
          ? `Product and ${cascadeCount} variant(s) moved to trash. You can restore from the Deleted tab.`
          : 'Product moved to trash. You can restore it from the Deleted tab.',
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { error: 'Failed to delete product', details: error.message },
      { status: 500 }
    );
  }
}

