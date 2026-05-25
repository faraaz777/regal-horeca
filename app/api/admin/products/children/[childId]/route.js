/**
 * Single Child API
 *
 * PATCH  /api/admin/products/children/[childId]
 *   Update fields on a single child variant. Allowed fields are pricing/sku/etc.
 *   plus visibleOnClient, showInCatalog, and isDefault. Mirrored fields (categoryId, brand) cannot
 *   be set directly here — they propagate from the parent.
 *
 * DELETE /api/admin/products/children/[childId]
 *   Soft-delete one child. Soft-deleting the last visible child does NOT touch the
 *   parent — admins can hide all variants intentionally.
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import Product from '@/lib/models/Product';
import { generateUniqueSlug } from '@/lib/utils/slug';
import { revalidateProductSlugs } from '@/lib/utils/revalidate';
import { assertAdmin } from '@/lib/server/auth/adminApiGuard';
import { findBarcodeConflictsForChild, normalizeBarcode } from '@/lib/server/products/barcodeValidation';
import { syncParentEmbeddedVariantFromChild } from '@/lib/server/products/syncParentEmbeddedVariants';
import { removeEmbeddedVariantFromParent } from '@/lib/server/products/removeEmbeddedVariant';
import { archiveSlugOnSoftDelete } from '@/lib/server/products/slugArchive';

export const dynamic = 'force-dynamic';

const VARIATION_KEYS = ['size', 'color', 'weight', 'unitCount'];

const ALLOWED_FIELDS = [
  'sku',
  'barcode',
  'hsnCode',
  'gstPercent',
  'mrp',
  'sellingPrice',
  'discountPercent',
  'marginPrice',
  'price',
  'heroImage',
  'gallery',
  'status',
  'visibleOnClient',
  'showInCatalog',
];

function pickAllowed(body) {
  const out = {};
  ALLOWED_FIELDS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      out[key] = body[key];
    }
  });
  return out;
}

export async function PATCH(request, { params }) {
  const authError = assertAdmin(request);
  if (authError) return authError;

  try {
    await connectToDatabase();
    const { childId } = params;
    const body = await request.json();

    const child = await Product.findById(childId);
    if (!child) {
      return NextResponse.json({ error: 'Variant not found' }, { status: 404 });
    }
    if (child.productType !== 'child') {
      return NextResponse.json(
        { error: 'This product is not a variant. Use /api/products/[id] instead.' },
        { status: 400 }
      );
    }

    const updates = pickAllowed(body);

    if (Object.prototype.hasOwnProperty.call(body, 'barcode')) {
      const nextBarcode = normalizeBarcode(body.barcode);
      if (nextBarcode) {
        const conflicts = await findBarcodeConflictsForChild(child, nextBarcode);
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
      updates.barcode = nextBarcode;
    }

    // Variation attributes can be updated; this triggers a slug regen using the new attrs.
    let regenSlug = false;
    if (body.variationAttributes && typeof body.variationAttributes === 'object') {
      const sanitized = {};
      VARIATION_KEYS.forEach((k) => {
        sanitized[k] = String(body.variationAttributes?.[k] ?? '').trim();
      });
      const changed = VARIATION_KEYS.some((k) => sanitized[k] !== (child.variationAttributes?.[k] || ''));
      if (changed) {
        child.variationAttributes = sanitized;
        regenSlug = true;
      }
    }

    Object.assign(child, updates);

    if (Array.isArray(body.images)) {
      child.gallery = body.images.filter(Boolean);
      if (!child.heroImage) {
        child.heroImage = child.gallery[0] || '';
      }
    }

    let parent = null;
    if (regenSlug) {
      parent = await Product.findById(child.parentProductId).lean();
      if (parent) {
        const slugBase = Product.buildChildSlugBase(parent, child.variationAttributes);
        child.slug = await generateUniqueSlug(slugBase, child._id);
      }
    }

    if (!parent) {
      parent = await Product.findById(child.parentProductId).lean();
    }
    child.searchBlob = Product.buildSearchBlob(parent, child);

    await child.save();

    if (child.parentProductId) {
      await syncParentEmbeddedVariantFromChild(child.parentProductId, child);
    }

    if (body.isDefault === true && parent) {
      await Product.updateOne({ _id: parent._id }, { $set: { defaultChildProductId: child._id } });
    } else if (body.isDefault === false && parent && String(parent.defaultChildProductId) === String(child._id)) {
      await Product.updateOne({ _id: parent._id }, { $set: { defaultChildProductId: null } });
    }

    revalidateProductSlugs([parent?.slug, child.slug]);

    return NextResponse.json({ success: true, child: child.toObject() });
  } catch (error) {
    console.error('Error updating child:', error);
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'Variant slug conflict. Adjust attribute values and retry.' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to update variant', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(_request, { params }) {
  const authError = assertAdmin(_request);
  if (authError) return authError;

  try {
    await connectToDatabase();
    const { childId } = params;

    const child = await Product.findById(childId);
    if (!child) {
      return NextResponse.json({ error: 'Variant not found' }, { status: 404 });
    }
    if (child.productType !== 'child') {
      return NextResponse.json(
        { error: 'This product is not a variant. Use /api/products/[id] instead.' },
        { status: 400 }
      );
    }
    const alreadyDeleted = Boolean(child.deletedAt);

    if (!alreadyDeleted) {
      child.deletedAt = new Date();
      await archiveSlugOnSoftDelete(child);
      await child.save();
    }

    if (child.parentProductId) {
      await removeEmbeddedVariantFromParent(child.parentProductId, {
        legacyParentVariantId: child.legacyParentVariantId,
        barcode: child.barcode,
      });
    }

    const parent = await Product.findById(child.parentProductId).select('slug defaultChildProductId').lean();

    // If the deleted child was the default, clear the pointer so PDP/card pick the next visible one.
    if (parent && String(parent.defaultChildProductId) === String(child._id)) {
      await Product.updateOne({ _id: parent._id }, { $set: { defaultChildProductId: null } });
    }

    revalidateProductSlugs([parent?.slug, child.slug]);

    return NextResponse.json({
      success: true,
      message: alreadyDeleted ? 'Variant was already in trash' : 'Variant moved to trash',
      alreadyDeleted,
    });
  } catch (error) {
    console.error('Error deleting child:', error);
    return NextResponse.json(
      { error: 'Failed to delete variant', details: error.message },
      { status: 500 }
    );
  }
}
