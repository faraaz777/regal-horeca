/**
 * Admin Children API
 *
 * GET    /api/admin/products/[parentId]/children
 *   List all (incl. hidden, incl. soft-deleted on demand) children of a parent.
 *
 * POST   /api/admin/products/[parentId]/children
 *   Create one child variant. If the parent is currently 'standalone', the route
 *   atomically promotes it to 'parent' and copies variationTheme from the request.
 *   The created child auto-derives title/slug, mirrors category/brand from parent,
 *   and computes searchBlob.
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import Product from '@/lib/models/Product';
import { generateUniqueSlug } from '@/lib/utils/slug';
import { revalidateProductSlugs } from '@/lib/utils/revalidate';
import { assertAdmin, assertProductWrite } from '@/lib/server/auth/adminApiGuard';
import { assertVariantBarcodesUnique, normalizeBarcode } from '@/lib/server/products/barcodeValidation';
import { syncParentEmbeddedVariantFromChild } from '@/lib/server/products/syncParentEmbeddedVariants';
import {
  buildChildPayloadFromVariantRow,
  deriveChildTitle,
  sanitizeChildVariationAttributes,
} from '@/lib/shared/childVariantPayload';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const authError = await assertAdmin(request);
  if (authError) return authError;

  try {
    await connectToDatabase();
    const { parentId } = params;
    const includeDeleted =
      new URL(request.url).searchParams.get('includeDeleted') === 'true';

    const parent = await Product.findById(parentId).lean();
    if (!parent) {
      return NextResponse.json({ error: 'Parent product not found' }, { status: 404 });
    }

    const childQuery = { parentProductId: parent._id };
    if (!includeDeleted) {
      childQuery.deletedAt = null;
    }

    const children = await Product.find(childQuery).sort({ createdAt: 1 }).lean();

    return NextResponse.json({ success: true, parent, children });
  } catch (error) {
    console.error('Error listing children:', error);
    return NextResponse.json(
      { error: 'Failed to list children', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request, { params }) {
  const authError = await assertProductWrite(request);
  if (authError) return authError;

  try {
    await connectToDatabase();
    const { parentId } = params;
    const body = await request.json();

    const parent = await Product.findById(parentId);
    if (!parent) {
      return NextResponse.json({ error: 'Parent product not found' }, { status: 404 });
    }
    if (parent.productType === 'child') {
      return NextResponse.json(
        { error: 'Cannot create a child of a child. Use the top-level parent.' },
        { status: 400 }
      );
    }

    // Promote standalone -> parent on the first variant create.
    if (parent.productType === 'standalone') {
      parent.productType = 'parent';
      parent.visibleOnClient = false;
      if (Array.isArray(body.variationTheme) && body.variationTheme.length > 0) {
        parent.variationTheme = body.variationTheme.filter(Boolean);
      } else if (parent.variationTheme.length === 0) {
        // Infer from the variation attributes of this first child.
        const inferred = ['size', 'color', 'weight', 'unitCount'].filter((k) =>
          String(body?.variationAttributes?.[k] ?? '').trim()
        );
        parent.variationTheme = inferred;
      }
      await parent.save();
    } else if (Array.isArray(body.variationTheme) && body.variationTheme.length > 0) {
      // Allow updating theme when explicitly provided.
      parent.variationTheme = body.variationTheme.filter(Boolean);
      await parent.save();
    }

    const built = buildChildPayloadFromVariantRow(
      {
        name: body.title || body.name,
        size: body.variationAttributes?.size,
        color: body.variationAttributes?.color,
        weight: body.variationAttributes?.weight,
        unitCount: body.variationAttributes?.unitCount,
        unit: body.variationAttributes?.unit ?? body.unit,
        sku: body.sku,
        barcode: body.barcode,
        hsnCode: body.hsnCode,
        gstPercent: body.gstPercent,
        mrp: body.mrp,
        sellingPrice: body.sellingPrice,
        discountPercent: body.discountPercent,
        marginPrice: body.marginPrice,
        price: body.price,
        images: body.images,
        showInCatalog: body.showInCatalog,
        isDefault: body.isDefault,
        _legacyParentVariantId: body.legacyParentVariantId,
      },
      { parent, variationTheme: parent.variationTheme }
    );

    const variationAttributes = built.variationAttributes;
    const barcode = built.barcode;
    if (barcode) {
      const barcodeCheck = await assertVariantBarcodesUnique(
        [{ barcode, _childProductId: null }],
        { parentProductId: parent._id }
      );
      if (!barcodeCheck.ok) {
        return NextResponse.json(
          { error: barcodeCheck.message, conflicts: barcodeCheck.conflicts },
          { status: 400 }
        );
      }
    }

    const title = built.title;
    const slugBase = Product.buildChildSlugBase(parent, variationAttributes);
    const slug = await generateUniqueSlug(slugBase);

    const child = new Product({
      title,
      slug,
      productType: 'child',
      parentProductId: parent._id,
      variationTheme: parent.variationTheme,
      variationAttributes,
      visibleOnClient: built.visibleOnClient !== false,
      showInCatalog: built.showInCatalog === true,
      categoryId: parent.categoryId || null,
      categoryIds: Array.isArray(parent.categoryIds) ? parent.categoryIds : [],
      brand: parent.brand || '',
      businessTypeSlugs: Array.isArray(parent.businessTypeSlugs) ? parent.businessTypeSlugs : [],
      sku: built.sku,
      barcode,
      hsnCode: built.hsnCode,
      gstPercent: built.gstPercent,
      mrp: built.mrp,
      sellingPrice: built.sellingPrice,
      discountPercent: built.discountPercent,
      marginPrice: built.marginPrice,
      price: built.price,
      heroImage: built.heroImage,
      gallery: built.images,
      status: body.status || parent.status || 'In Stock',
      legacyParentVariantId: built.legacyParentVariantId,
    });

    child.searchBlob = Product.buildSearchBlob(parent, child);
    await child.save();

    await syncParentEmbeddedVariantFromChild(parent._id, child);

    if (body.isDefault === true) {
      await Product.updateOne({ _id: parent._id }, { $set: { defaultChildProductId: child._id } });
    }

    revalidateProductSlugs([parent.slug, child.slug]);

    return NextResponse.json({ success: true, child }, { status: 201 });
  } catch (error) {
    console.error('Error creating child product:', error);
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'Variant slug conflict. Adjust attribute values and retry.' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create child product', details: error.message },
      { status: 500 }
    );
  }
}
