/**
 * Variant brand collection helpers
 *
 * Parent main brandCategoryId = family default collection.
 * Parent brandCategoryIds = allowed alternate collections for variants
 * (not multi-home membership for every SKU).
 *
 * Each child stores one effective brandCategoryId.
 */

function nodeId(node) {
  if (!node) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node).trim();
  return String(node._id || node.id || '').trim();
}

function findBrand(brands, id) {
  const target = String(id || '').trim();
  if (!target) return null;
  return (brands || []).find((brand) => nodeId(brand) === target) || null;
}

/**
 * Walk to the top-level brand (department / no parent).
 */
export function getBrandTopLevelId(brandNodeId, brands) {
  let current = findBrand(brands, brandNodeId);
  const seen = new Set();
  while (current) {
    const id = nodeId(current);
    if (!id || seen.has(id)) break;
    seen.add(id);
    const parentId = nodeId(current.parent);
    if (!parentId) return id;
    current = findBrand(brands, parentId);
  }
  return String(brandNodeId || '').trim();
}

/**
 * Human path for a brand-tree leaf, e.g. "Dinewell › Choco".
 */
export function formatBrandCollectionPath(brandNodeId, brands) {
  const parts = [];
  let current = findBrand(brands, brandNodeId);
  const seen = new Set();
  while (current) {
    const id = nodeId(current);
    if (!id || seen.has(id)) break;
    seen.add(id);
    parts.unshift(String(current.name || '').trim() || id);
    const parentId = nodeId(current.parent);
    current = parentId ? findBrand(brands, parentId) : null;
  }
  return parts.filter(Boolean).join(' › ');
}

/**
 * Dropdown options for the variant Brand Collection column.
 * Parent default first; then additional collections under the same top-level brand.
 */
export function buildBrandCollectionOptions({
  parentBrandCategoryId,
  additionalBrandCategoryIds = [],
  brands = [],
} = {}) {
  const parentId = String(parentBrandCategoryId || '').trim();
  if (!parentId) return [];

  const topLevelId = getBrandTopLevelId(parentId, brands);
  const options = [
    {
      id: parentId,
      label: formatBrandCollectionPath(parentId, brands) || 'Parent default',
      isParentDefault: true,
    },
  ];

  const seen = new Set([parentId]);
  for (const raw of additionalBrandCategoryIds || []) {
    const id = String(raw?._id || raw?.id || raw || '').trim();
    if (!id || seen.has(id)) continue;
    if (getBrandTopLevelId(id, brands) !== topLevelId) continue;
    seen.add(id);
    options.push({
      id,
      label: formatBrandCollectionPath(id, brands) || id,
      isParentDefault: false,
    });
  }

  return options;
}

/**
 * Resolve the brandCategoryId to persist on a child SKU.
 *
 * Empty / missing / parent id → parent default.
 * Override must be in the allowed additional list and under the same top-level brand.
 *
 * @returns {{ ok: true, brandCategoryId: string } | { ok: false, error: string }}
 */
export function resolveChildBrandCategoryId({
  requestedId,
  parentBrandCategoryId,
  additionalBrandCategoryIds = [],
  brands = [],
} = {}) {
  const parentId = String(parentBrandCategoryId || '').trim();
  const requested = String(requestedId || '').trim();

  /**
   * Parent has no linked brand-tree node yet (name-only brand). Store empty;
   * Brand Report still falls back to brand name at department level.
   */
  if (!parentId) {
    if (requested) {
      return {
        ok: false,
        error: 'Link the parent to a brand collection before assigning variant collections.',
      };
    }
    return { ok: true, brandCategoryId: '' };
  }

  if (!requested || requested === parentId) {
    return { ok: true, brandCategoryId: parentId };
  }

  const allowed = new Set(
    (additionalBrandCategoryIds || [])
      .map((raw) => String(raw?._id || raw?.id || raw || '').trim())
      .filter(Boolean)
  );

  if (!allowed.has(requested)) {
    return {
      ok: false,
      error: 'Variant collection must be the parent default or one of the allowed additional collections.',
    };
  }

  const parentTop = getBrandTopLevelId(parentId, brands);
  const requestedTop = getBrandTopLevelId(requested, brands);
  if (!parentTop || !requestedTop || parentTop !== requestedTop) {
    return {
      ok: false,
      error: 'Variant collection override must stay under the same top-level brand as the parent.',
    };
  }

  return { ok: true, brandCategoryId: requested };
}

/**
 * True when the child collection differs from the parent default.
 */
export function isBrandCollectionOverride(childBrandCategoryId, parentBrandCategoryId) {
  const childId = String(childBrandCategoryId || '').trim();
  const parentId = String(parentBrandCategoryId || '').trim();
  return Boolean(childId && parentId && childId !== parentId);
}
