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
import { assertAdmin } from '@/lib/server/auth/adminApiGuard';

export const dynamic = 'force-dynamic';

const VARIATION_KEYS = ['size', 'color', 'weight', 'unitCount'];

function sanitizeVariationAttributes(input) {
  const out = {};
  VARIATION_KEYS.forEach((k) => {
    out[k] = String(input?.[k] ?? '').trim();
  });
  return out;
}

function deriveChildTitle(parentTitle, attrs) {
  const tail = VARIATION_KEYS
    .map((k) => attrs[k])
    .filter(Boolean)
    .join(' / ');
  if (!tail) return parentTitle;
  return `${parentTitle} - ${tail}`;
}

export async function GET(_request, { params }) {
  const authError = assertAdmin(_request);
  if (authError) return authError;

  try {
    await connectToDatabase();
    const { parentId } = params;

    const parent = await Product.findById(parentId).lean();
    if (!parent) {
      return NextResponse.json({ error: 'Parent product not found' }, { status: 404 });
    }

    const children = await Product.find({ parentProductId: parent._id })
      .sort({ createdAt: 1 })
      .lean();

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
  const authError = assertAdmin(request);
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
        const inferred = VARIATION_KEYS.filter((k) => String(body?.variationAttributes?.[k] ?? '').trim());
        parent.variationTheme = inferred;
      }
      await parent.save();
    } else if (Array.isArray(body.variationTheme) && body.variationTheme.length > 0) {
      // Allow updating theme when explicitly provided.
      parent.variationTheme = body.variationTheme.filter(Boolean);
      await parent.save();
    }

    const variationAttributes = sanitizeVariationAttributes(body.variationAttributes);
    const title = deriveChildTitle(parent.title, variationAttributes);
    const slugBase = Product.buildChildSlugBase(parent, variationAttributes);
    const slug = await generateUniqueSlug(slugBase);

    const child = new Product({
      title,
      slug,
      productType: 'child',
      parentProductId: parent._id,
      variationTheme: parent.variationTheme,
      variationAttributes,
      visibleOnClient: body.visibleOnClient !== false,
      // Mirrored query-critical fields.
      categoryId: parent.categoryId || null,
      categoryIds: Array.isArray(parent.categoryIds) ? parent.categoryIds : [],
      brand: parent.brand || '',
      businessTypeSlugs: Array.isArray(parent.businessTypeSlugs) ? parent.businessTypeSlugs : [],
      // Per-child commerce fields (deltas).
      sku: String(body.sku || '').trim(),
      barcode: String(body.barcode || '').trim(),
      hsnCode: String(body.hsnCode || '').trim(),
      gstPercent: Number(body.gstPercent || 0),
      mrp: Number(body.mrp || 0),
      sellingPrice: Number(body.sellingPrice || 0),
      discountPercent: Number(body.discountPercent || 0),
      marginPrice: Number(body.marginPrice || 0),
      price: Number(body.price ?? body.sellingPrice ?? 0),
      heroImage: body.heroImage || (Array.isArray(body.images) ? body.images.find(Boolean) : '') || '',
      gallery: Array.isArray(body.images) ? body.images.filter(Boolean) : [],
      status: body.status || parent.status || 'In Stock',
      legacyParentVariantId: String(body.legacyParentVariantId || '').trim(),
    });

    child.searchBlob = Product.buildSearchBlob(parent, child);
    await child.save();

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
