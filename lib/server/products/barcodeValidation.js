import 'server-only';

import Product from '@/lib/models/Product';

/**
 * Normalize a barcode for comparison (trim; empty means "no barcode").
 */
export function normalizeBarcode(value) {
  return String(value ?? '').trim();
}

/**
 * True when an active child on this parent still owns the barcode / legacy embedded id.
 */
export async function hasActiveChildBlockingBarcode(parentId, barcode, legacyVariantId = '') {
  const pid = String(parentId || '').trim();
  if (!pid) return false;

  const legacyId = String(legacyVariantId || '').trim();
  const normalized = normalizeBarcode(barcode);
  const or = [];
  if (legacyId) or.push({ legacyParentVariantId: legacyId });
  if (normalized) or.push({ barcode: normalized });
  if (or.length === 0) return false;

  const active = await Product.findOne({
    parentProductId: pid,
    deletedAt: null,
    $or: or,
  })
    .select('_id')
    .lean();

  return Boolean(active);
}

/**
 * Soft-deleted children on a parent whose barcodes may be reused on a new variant.
 */
export async function getSoftDeletedBarcodeReuseExclusions(parentId, barcodes) {
  const pid = String(parentId || '').trim();
  const unique = [...new Set((barcodes || []).map(normalizeBarcode).filter(Boolean))];
  if (!pid || unique.length === 0) {
    return { productIds: [], legacyVariantIds: [] };
  }

  const deleted = await Product.find({
    parentProductId: pid,
    deletedAt: { $ne: null },
    barcode: { $in: unique },
  })
    .select('_id legacyParentVariantId')
    .lean();

  return {
    productIds: deleted.map((c) => String(c._id)),
    legacyVariantIds: deleted
      .map((c) => String(c.legacyParentVariantId || '').trim())
      .filter(Boolean),
  };
}

/**
 * Find catalog conflicts for one or more barcodes.
 *
 * Checks:
 * - Top-level `barcode` on any non-deleted product (standalone, parent, child)
 * - Legacy embedded `variants[].barcode` on parent/standalone documents
 *
 * @param {string[]} barcodes
 * @param {{ excludeProductIds?: string[] }} [opts] Product/child ids to ignore (current edits)
 * @param {string} [opts.excludeParentEmbeddedId] Parent whose embedded `variants[]` mirror children being saved
 * @param {string[]} [opts.excludeEmbeddedLegacyVariantIds] Embedded `variantId` values to ignore on that parent
 * @returns {Promise<Array<{ barcode: string, productId: string, title: string, source: string }>>}
 */
export async function findBarcodeConflicts(barcodes, opts = {}) {
  const exclude = new Set(
    (opts.excludeProductIds || []).map((id) => String(id)).filter(Boolean)
  );
  const excludeParentEmbeddedId = opts.excludeParentEmbeddedId
    ? String(opts.excludeParentEmbeddedId)
    : '';
  const excludeEmbeddedLegacyIds = new Set(
    (opts.excludeEmbeddedLegacyVariantIds || []).map((id) => String(id).trim()).filter(Boolean)
  );

  const unique = [
    ...new Set(
      (barcodes || []).map(normalizeBarcode).filter(Boolean)
    ),
  ];

  if (unique.length === 0) return [];

  const conflicts = [];

  for (const barcode of unique) {
    const topLevel = await Product.find({
      deletedAt: null,
      barcode,
    })
      .select('_id title productType parentProductId')
      .lean();

    for (const doc of topLevel) {
      const id = String(doc._id);
      if (exclude.has(id)) continue;
      conflicts.push({
        barcode,
        productId: id,
        title: doc.title || 'Untitled product',
        source: doc.productType === 'child' ? 'variant' : 'product',
      });
    }

    const embedded = await Product.find({
      deletedAt: null,
      'variants.barcode': barcode,
    })
      .select('_id title variants.barcode variants.name variants.variantId')
      .lean();

    for (const parent of embedded) {
      const parentId = String(parent._id);
      if (exclude.has(parentId)) continue;
      const hits = (parent.variants || []).filter(
        (v) => normalizeBarcode(v?.barcode) === barcode
      );
      for (const v of hits) {
        const legacyVariantId = String(v?.variantId || '').trim();
        if (
          excludeParentEmbeddedId &&
          parentId === excludeParentEmbeddedId &&
          legacyVariantId &&
          excludeEmbeddedLegacyIds.has(legacyVariantId)
        ) {
          continue;
        }
        const blocked = await hasActiveChildBlockingBarcode(
          parentId,
          barcode,
          legacyVariantId
        );
        if (!blocked) continue;

        conflicts.push({
          barcode,
          productId: parentId,
          title: `${parent.title || 'Product'} (embedded variant${v?.name ? `: ${v.name}` : ''})`,
          source: 'embedded-variant',
        });
      }
    }
  }

  return conflicts;
}

/**
 * Barcode uniqueness check when PATCHing a single child variant.
 */
export async function findBarcodeConflictsForChild(child, barcode) {
  const nextBarcode = normalizeBarcode(barcode);
  if (!nextBarcode) return [];

  const parentId = child?.parentProductId ? String(child.parentProductId) : '';
  const legacyId = String(child?.legacyParentVariantId || '').trim();

  return findBarcodeConflicts([nextBarcode], {
    excludeProductIds: [String(child._id), parentId].filter(Boolean),
    excludeParentEmbeddedId: parentId,
    excludeEmbeddedLegacyVariantIds: legacyId ? [legacyId] : [],
  });
}

/**
 * Validate barcodes for a variant save batch.
 *
 * @param {Array<{ barcode?: string, _childProductId?: string|null, variantId?: string }>} rows
 * @param {{ parentProductId?: string }} [opts]
 * @returns {Promise<{ ok: true } | { ok: false, message: string, conflicts: object[] }>}
 */
export async function assertVariantBarcodesUnique(rows, opts = {}) {
  const parentId = opts.parentProductId ? String(opts.parentProductId) : '';

  const seen = new Map();
  for (let i = 0; i < (rows || []).length; i += 1) {
    const barcode = normalizeBarcode(rows[i]?.barcode);
    if (!barcode) continue;
    if (seen.has(barcode)) {
      return {
        ok: false,
        message: `Duplicate barcode "${barcode}" in variant rows #${seen.get(barcode) + 1} and #${i + 1}.`,
        conflicts: [],
      };
    }
    seen.set(barcode, i);
  }

  const barcodes = [...seen.keys()];
  if (barcodes.length === 0) return { ok: true };

  const excludeProductIds = [
    parentId,
    ...(rows || []).map((r) => r?._childProductId).filter(Boolean).map(String),
  ];
  const excludeEmbeddedLegacyVariantIds = (rows || [])
    .flatMap((r) => [
      String(r?._legacyParentVariantId || '').trim(),
      String(r?.variantId || '').trim(),
    ])
    .filter(Boolean);

  if (parentId) {
    const reuse = await getSoftDeletedBarcodeReuseExclusions(parentId, barcodes);
    excludeProductIds.push(...reuse.productIds);
    excludeEmbeddedLegacyVariantIds.push(...reuse.legacyVariantIds);
  }

  const conflicts = await findBarcodeConflicts(barcodes, {
    excludeProductIds,
    excludeParentEmbeddedId: parentId,
    excludeEmbeddedLegacyVariantIds,
  });
  if (conflicts.length === 0) return { ok: true };

  const first = conflicts[0];
  return {
    ok: false,
    message: `Barcode "${first.barcode}" is already used by "${first.title}".`,
    conflicts,
  };
}
