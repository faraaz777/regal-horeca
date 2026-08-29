/**
 * PATCH /api/admin/taxonomy/reorder
 *
 * Batch update parent, level, and sortOrder for category or brand menu items.
 * Used by the menu-builder drag-and-drop UI.
 *
 * Permissions: categories:write or brands:write (by type)
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import Category from '@/lib/models/Category';
import Brand from '@/lib/models/Brand';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { clearCategoryCache } from '@/lib/utils/categoryCache';
import { revalidateHomepage, revalidateCategories } from '@/lib/utils/revalidate';
import { getTaxonomyConfig } from '@/lib/taxonomy/taxonomyConfig';
import {
  buildTaxonomyMaps,
  deriveLevelFromParent,
} from '@/lib/taxonomy/taxonomyTreeUtils';
import { validateTaxonomyMove } from '@/lib/taxonomy/taxonomyValidation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getModel(type) {
  return type === 'brand' ? Brand : Category;
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const { type, items } = body;

    if (!type || !['category', 'brand'].includes(type)) {
      return NextResponse.json({ error: 'Invalid taxonomy type' }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'items array is required' }, { status: 400 });
    }

    const config = getTaxonomyConfig(type);
    const auth = await requireAuth(request, { permission: config.permissionWrite });
    if (auth.error) return auth.error;

    await connectToDatabase();
    const Model = getModel(type);

    const allDocs = await Model.find({}).lean();
    const { idMap } = buildTaxonomyMaps(allDocs);

    for (const item of items) {
      const itemId = item?.id?.toString?.() ?? item?.id;
      if (!itemId) {
        return NextResponse.json({ error: 'Each item requires an id' }, { status: 400 });
      }

      const parentId = item.parent == null ? null : (item.parent?.toString?.() ?? String(item.parent));
      const moveCheck = validateTaxonomyMove({
        parentId,
        itemId,
        idMap,
        levels: config.levels,
      });
      if (!moveCheck.valid) {
        return NextResponse.json({ error: moveCheck.error }, { status: 400 });
      }

      const level = item.level || deriveLevelFromParent(parentId, idMap, config.levels);
      const sortOrder = Number(item.sortOrder ?? 0);

      await Model.findByIdAndUpdate(itemId, {
        parent: parentId,
        level,
        sortOrder,
      });

      const existing = idMap.get(itemId);
      if (existing) {
        existing.parent = parentId;
        existing.level = level;
        existing.sortOrder = sortOrder;
      }
    }

    if (type === 'category') {
      clearCategoryCache();
      try {
        revalidateHomepage();
        revalidateCategories();
      } catch (e) {
        console.error('Category revalidation after reorder:', e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Taxonomy reorder error:', error);
    return NextResponse.json(
      { error: 'Failed to reorder taxonomy items', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/taxonomy/reorder
 *
 * Reorder all siblings under one parent.
 * Body: { type, parentId, orderedIds: string[] }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { type, parentId, orderedIds } = body;

    if (!type || !['category', 'brand'].includes(type)) {
      return NextResponse.json({ error: 'Invalid taxonomy type' }, { status: 400 });
    }
    if (!Array.isArray(orderedIds)) {
      return NextResponse.json({ error: 'orderedIds array is required' }, { status: 400 });
    }

    const config = getTaxonomyConfig(type);
    const auth = await requireAuth(request, { permission: config.permissionWrite });
    if (auth.error) return auth.error;

    await connectToDatabase();
    const Model = getModel(type);

    const normalizedParent = parentId == null ? null : (parentId?.toString?.() ?? String(parentId));
    const allDocs = await Model.find({}).lean();
    const { idMap } = buildTaxonomyMaps(allDocs);

    for (let index = 0; index < orderedIds.length; index++) {
      const itemId = orderedIds[index]?.toString?.() ?? String(orderedIds[index]);
      const level = deriveLevelFromParent(normalizedParent, idMap, config.levels);

      const moveCheck = validateTaxonomyMove({
        parentId: normalizedParent,
        itemId,
        idMap,
        levels: config.levels,
      });
      if (!moveCheck.valid) {
        return NextResponse.json({ error: moveCheck.error }, { status: 400 });
      }

      await Model.findByIdAndUpdate(itemId, {
        parent: normalizedParent,
        level,
        sortOrder: index,
      });
    }

    if (type === 'category') {
      clearCategoryCache();
      try {
        revalidateHomepage();
        revalidateCategories();
      } catch (e) {
        console.error('Category revalidation after sibling reorder:', e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Taxonomy sibling reorder error:', error);
    return NextResponse.json(
      { error: 'Failed to reorder siblings', details: error.message },
      { status: 500 }
    );
  }
}
