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
import { assertAdmin, assertProductWrite } from '@/lib/server/auth/adminApiGuard';
import { findBarcodeConflictsForChild, normalizeBarcode } from '@/lib/server/products/barcodeValidation';
import { syncParentEmbeddedVariantFromChild } from '@/lib/server/products/syncParentEmbeddedVariants';
import { removeEmbeddedVariantFromParent } from '@/lib/server/products/removeEmbeddedVariant';
import { archiveSlugOnSoftDelete } from '@/lib/server/products/slugArchive';
import {
  buildChildPayloadFromVariantRow,
  sanitizeChildVariationAttributes,
} from '@/lib/shared/childVariantPayload';

export const dynamic = 'force-dynamic';

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
  const authError = await assertProductWrite(request);
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

    let parent = await Product.findById(child.parentProductId).lean();

    const built = buildChildPayloadFromVariantRow(
      {
        name: body.title || body.name || child.title,
        size: body.variationAttributes?.size ?? child.variationAttributes?.size,
        color: body.variationAttributes?.color ?? child.variationAttributes?.color,
        weight: body.variationAttributes?.weight ?? child.variationAttributes?.weight,
        unitCount: body.variationAttributes?.unitCount ?? child.variationAttributes?.unitCount,
        unit: body.variationAttributes?.unit ?? body.unit ?? child.variationAttributes?.unit,
        sku: Object.prototype.hasOwnProperty.call(body, 'sku') ? body.sku : child.sku,
        barcode: Object.prototype.hasOwnProperty.call(body, 'barcode') ? body.barcode : child.barcode,
        hsnCode: Object.prototype.hasOwnProperty.call(body, 'hsnCode') ? body.hsnCode : child.hsnCode,
        gstPercent: Object.prototype.hasOwnProperty.call(body, 'gstPercent') ? body.gstPercent : child.gstPercent,
        mrp: Object.prototype.hasOwnProperty.call(body, 'mrp') ? body.mrp : child.mrp,
        sellingPrice: Object.prototype.hasOwnProperty.call(body, 'sellingPrice')
          ? body.sellingPrice
          : child.sellingPrice,
        discountPercent: Object.prototype.hasOwnProperty.call(body, 'discountPercent')
          ? body.discountPercent
          : child.discountPercent,
        marginPrice: Object.prototype.hasOwnProperty.call(body, 'marginPrice')
          ? body.marginPrice
          : child.marginPrice,
        price: Object.prototype.hasOwnProperty.call(body, 'price') ? body.price : child.price,
        images: Array.isArray(body.images) ? body.images : child.gallery,
        showInCatalog: Object.prototype.hasOwnProperty.call(body, 'showInCatalog')
          ? body.showInCatalog
          : child.showInCatalog,
        isDefault: body.isDefault,
        _legacyParentVariantId: child.legacyParentVariantId,
      },
      { parent, variationTheme: parent?.variationTheme }
    );

    if (built.barcode) {
      const conflicts = await findBarcodeConflictsForChild(child, built.barcode);
      if (conflicts.length > 0) {
        const hit = conflicts[0];
        return NextResponse.json(
          {
            error: `Barcode "${built.barcode}" is already used by "${hit.title}".`,
            conflicts,
          },
          { status: 400 }
        );
      }
    }

    let regenSlug = false;
    const prevAttrs = sanitizeChildVariationAttributes(child.variationAttributes || {});
    const nextAttrs = built.variationAttributes;
    const attrsChanged = Object.keys(nextAttrs).some((k) => nextAttrs[k] !== prevAttrs[k]);
    if (attrsChanged) {
      child.variationAttributes = nextAttrs;
      regenSlug = true;
    }

    child.title = built.title;
    child.sku = built.sku;
    child.barcode = built.barcode;
    child.hsnCode = built.hsnCode;
    child.gstPercent = built.gstPercent;
    child.mrp = built.mrp;
    child.sellingPrice = built.sellingPrice;
    child.discountPercent = built.discountPercent;
    child.marginPrice = built.marginPrice;
    child.price = built.price;
    child.gallery = built.images;
    child.heroImage = built.heroImage || child.gallery?.[0] || '';

    const updates = pickAllowed(body);
    Object.assign(child, updates);

    if (regenSlug && parent) {
      const slugBase = Product.buildChildSlugBase(parent, child.variationAttributes);
      child.slug = await generateUniqueSlug(slugBase, child._id);
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
  const authError = await assertProductWrite(_request);
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
