/**
 * Category Utility Functions
 *
 * Optimized to avoid repeated .filter() scans. Uses a single-pass parent map
 * for O(1) child lookups instead of O(n) filter per level.
 */

/**
 * Build parent→children map and id→category map in a single O(n) pass.
 * Use these for O(1) lookups instead of repeated categories.filter().
 *
 * @param {Array} categories - Flat array of categories
 * @returns {{ parentMap: Map<string|null, Array>, idMap: Map<string, Object>, slugMap: Map<string, Object> }}
 */
export function buildCategoryMaps(categories) {
  const parentMap = new Map();
  const idMap = new Map();
  const slugMap = new Map();

  if (!categories?.length) {
    return { parentMap, idMap, slugMap };
  }

  for (const cat of categories) {
    const cid = cat._id ?? cat.id;
    const cidStr = cid != null ? (cid.toString?.() ?? String(cid)) : null;
    if (cidStr) idMap.set(cidStr, cat);
    if (cat.slug) slugMap.set(cat.slug, cat);

    const pid = cat.parent?._id ?? cat.parent ?? null;
    const pkey = pid == null ? null : (pid.toString?.() ?? String(pid));
    if (!parentMap.has(pkey)) parentMap.set(pkey, []);
    parentMap.get(pkey).push(cat);
  }

  return { parentMap, idMap, slugMap };
}

/**
 * Build category tree from pre-built parent map. O(n) total, no repeated filter scans.
 *
 * @param {Map} parentMap - From buildCategoryMaps
 * @param {string|null} parentKey - Parent id string, or null for root
 * @returns {Array} Tree of categories with children
 */
export function buildCategoryTreeFromMap(parentMap, parentKey = null) {
  const children = parentMap.get(parentKey) || [];
  return children.map((cat) => {
    const cid = cat._id ?? cat.id;
    const cidStr = cid != null ? (cid.toString?.() ?? String(cid)) : null;
    return {
      ...cat,
      id: cid,
      children: buildCategoryTreeFromMap(parentMap, cidStr),
    };
  });
}

/**
 * Build full category tree in one call. Replaces recursive .filter() pattern.
 *
 * @param {Array} categories - Flat array of categories
 * @returns {Array} Root-level tree (children of null)
 */
export function buildCategoryTree(categories) {
  const { parentMap } = buildCategoryMaps(categories);
  return buildCategoryTreeFromMap(parentMap, null);
}

/**
 * Get children of a parent. O(1) lookup via parent map.
 *
 * @param {Map} parentMap - From buildCategoryMaps
 * @param {string|null} parentId - Parent id or null for root
 * @returns {Array}
 */
export function getChildrenByParentMap(parentMap, parentId) {
  const key = parentId == null ? null : (parentId.toString?.() ?? String(parentId));
  return parentMap.get(key) || [];
}

/**
 * Flatten category tree structure into a flat array
 * @param {Array} categories - Tree structure of categories
 * @returns {Array} Flattened array of categories
 */
export function flattenCategories(categories) {
  if (!categories || !Array.isArray(categories)) {
    return [];
  }

  let result = [];
  categories.forEach((cat) => {
    result.push(cat);
    if (cat.children && cat.children.length > 0) {
      result = result.concat(flattenCategories(cat.children));
    }
  });
  return result;
}

