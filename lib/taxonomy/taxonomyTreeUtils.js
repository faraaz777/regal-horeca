/**
 * Taxonomy Tree Utils
 *
 * Generic O(n) tree build/search for categories and brands.
 * Extends the pattern from lib/utils/categoryUtils.js.
 */

/**
 * Normalize document id to string.
 * @param {unknown} item
 * @returns {string|null}
 */
export function getTaxonomyId(item) {
  const id = item?._id ?? item?.id;
  if (id == null) return null;
  if (typeof id === 'object' && id.toString) return id.toString();
  return String(id);
}

/**
 * Normalize parent id from a taxonomy node.
 * @param {Object} item
 * @returns {string|null}
 */
export function getTaxonomyParentId(item) {
  const parent = item?.parent;
  if (parent == null) return null;
  if (typeof parent === 'object') {
    if (parent._id) return parent._id.toString();
    if (parent.toString) {
      const pid = parent.toString();
      const selfId = getTaxonomyId(item);
      if (selfId && pid === selfId) return null;
      return pid;
    }
  }
  return parent ? String(parent) : null;
}

/**
 * Build parent→children and id→node maps in one pass.
 * @param {Array} items
 * @returns {{ parentMap: Map<string|null, Array>, idMap: Map<string, Object> }}
 */
export function buildTaxonomyMaps(items) {
  const parentMap = new Map();
  const idMap = new Map();

  if (!items?.length) return { parentMap, idMap };

  for (const item of items) {
    const id = getTaxonomyId(item);
    if (id) idMap.set(id, item);

    const parentId = getTaxonomyParentId(item);
    if (!parentMap.has(parentId)) parentMap.set(parentId, []);
    parentMap.get(parentId).push(item);
  }

  for (const [, siblings] of parentMap) {
    siblings.sort(compareTaxonomySiblings);
  }

  return { parentMap, idMap };
}

/**
 * Stable sibling sort: sortOrder asc, then name asc.
 * @param {Object} a
 * @param {Object} b
 */
export function compareTaxonomySiblings(a, b) {
  const orderA = Number(a?.sortOrder ?? 0);
  const orderB = Number(b?.sortOrder ?? 0);
  if (orderA !== orderB) return orderA - orderB;
  return String(a?.name || '').localeCompare(String(b?.name || ''));
}

/**
 * @param {Map} parentMap
 * @param {string|null} parentKey
 * @returns {Array}
 */
export function buildTaxonomyTreeFromMap(parentMap, parentKey = null) {
  const children = parentMap.get(parentKey) || [];
  return children.map((item) => {
    const id = getTaxonomyId(item);
    const childTree = buildTaxonomyTreeFromMap(parentMap, id);
    return {
      ...item,
      id: item._id ?? item.id,
      children: childTree.length > 0 ? childTree : undefined,
    };
  });
}

/**
 * @param {Array} items - flat list
 * @returns {Array} root tree nodes
 */
export function buildTaxonomyTree(items) {
  const { parentMap } = buildTaxonomyMaps(items);
  return buildTaxonomyTreeFromMap(parentMap, null);
}

/**
 * Derive level enum from parent depth.
 * @param {string|null} parentId
 * @param {Map} idMap
 * @param {string[]} levels
 * @returns {string}
 */
export function deriveLevelFromParent(parentId, idMap, levels) {
  if (!parentId) return levels[0];
  let depth = 0;
  let current = parentId;
  const seen = new Set();
  while (current && !seen.has(current)) {
    seen.add(current);
    depth += 1;
    const node = idMap.get(current);
    if (!node) break;
    current = getTaxonomyParentId(node);
  }
  const idx = Math.min(depth, levels.length - 1);
  return levels[idx];
}

/**
 * Build breadcrumb path names for a node.
 * @param {string} itemId
 * @param {Map} idMap
 * @returns {string[]}
 */
export function getTaxonomyPath(itemId, idMap) {
  const path = [];
  let current = itemId;
  const seen = new Set();
  while (current && !seen.has(current)) {
    seen.add(current);
    const node = idMap.get(current);
    if (!node) break;
    path.unshift(node.name);
    current = getTaxonomyParentId(node);
  }
  return path;
}

/**
 * Flatten visible tree rows for list rendering (respects expand state).
 * @param {Array} tree
 * @param {Set<string>} expandedIds
 * @param {number} [depth]
 * @param {string|null} [parentId]
 * @returns {Array<{ node: Object, depth: number, parentId: string|null, hasChildren: boolean, isExpanded: boolean, path: string[] }>}
 */
export function flattenVisibleTaxonomyRows(tree, expandedIds, depth = 0, parentId = null) {
  /** @type {Array} */
  const rows = [];

  for (const node of tree) {
    const id = getTaxonomyId(node);
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;
    const isExpanded = id ? expandedIds.has(id) : false;

    rows.push({
      node,
      depth,
      parentId,
      hasChildren,
      isExpanded,
      id,
    });

    if (hasChildren && isExpanded) {
      rows.push(...flattenVisibleTaxonomyRows(node.children, expandedIds, depth + 1, id));
    }
  }

  return rows;
}

/**
 * Insert "add same level" slots after the last direct child of each expanded parent.
 * @param {Array} visibleRows
 * @param {Set<string>} expandedIds
 * @param {(node: Object) => boolean} canAddChild
 * @param {(node: Object) => string|null} getChildLevel
 * @returns {Array<{ type: 'item', row: Object } | { type: 'addSibling', parentNode: Object, level: string, depth: number }>}
 */
export function injectSameLevelAddSlots(visibleRows, expandedIds, canAddChild, getChildLevel) {
  /** @type {Array} */
  const out = [];

  for (let i = 0; i < visibleRows.length; i++) {
    const row = visibleRows[i];
    out.push({ type: 'item', row });

    // Expanded parent with no children yet — show add row right under it
    if (expandedIds.has(row.id) && canAddChild(row.node)) {
      const hasDirectChild = visibleRows.some((r, j) => j > i && r.parentId === row.id);
      if (!hasDirectChild) {
        const childLevel = getChildLevel(row.node);
        if (childLevel) {
          out.push({
            type: 'addSibling',
            parentNode: row.node,
            parentName: row.node.name,
            level: childLevel,
            depth: row.depth + 1,
          });
        }
        continue;
      }
    }

    // Last direct child of an expanded parent — add row after the sibling group
    if (!row.parentId) continue;

    let isLastDirectChild = true;
    for (let j = i + 1; j < visibleRows.length; j++) {
      if (visibleRows[j].parentId === row.parentId) {
        isLastDirectChild = false;
        break;
      }
      if (visibleRows[j].depth <= row.depth) break;
    }

    if (!isLastDirectChild) continue;

    const parentRow = visibleRows.find((r) => r.id === row.parentId);
    if (!parentRow || !expandedIds.has(row.parentId) || !canAddChild(parentRow.node)) continue;

    const childLevel = getChildLevel(parentRow.node);
    if (!childLevel) continue;

    out.push({
      type: 'addSibling',
      parentNode: parentRow.node,
      parentName: parentRow.node.name,
      level: childLevel,
      depth: row.depth,
    });
  }

  return out;
}

/**
 * Collect all ancestor ids that must expand to reveal matches.
 * @param {Array} items
 * @param {string} query
 * @param {Map} idMap
 * @param {Map} parentMap
 * @returns {Set<string>}
 */
export function getSearchExpandIds(items, query, idMap, parentMap) {
  const q = query.trim().toLowerCase();
  if (!q) return new Set();

  const expandIds = new Set();
  for (const item of items) {
    if (!String(item.name || '').toLowerCase().includes(q)) continue;
    let current = getTaxonomyId(item);
    const seen = new Set();
    while (current && !seen.has(current)) {
      seen.add(current);
      const node = idMap.get(current);
      if (!node) break;
      const parent = getTaxonomyParentId(node);
      if (parent) expandIds.add(parent);
      current = parent;
    }
  }
  return expandIds;
}

/**
 * Filter flat list by search while keeping matched nodes and their descendants.
 * @param {Array} items
 * @param {string} query
 * @param {Map} idMap
 * @param {Map} parentMap
 * @returns {Set<string>|null} matched ids or null if no filter
 */
export function getSearchMatchedIds(items, query, idMap, parentMap) {
  const q = query.trim().toLowerCase();
  if (!q) return null;

  const matched = new Set();
  for (const item of items) {
    const id = getTaxonomyId(item);
    if (!id) continue;
    const nameMatch = String(item.name || '').toLowerCase().includes(q);
    const slugMatch = String(item.slug || '').toLowerCase().includes(q);
    if (nameMatch || slugMatch) {
      matched.add(id);
      // include all descendants
      const stack = [id];
      while (stack.length) {
        const pid = stack.pop();
        const kids = parentMap.get(pid) || [];
        for (const kid of kids) {
          const kidId = getTaxonomyId(kid);
          if (kidId && !matched.has(kidId)) {
            matched.add(kidId);
            stack.push(kidId);
          }
        }
      }
      // include ancestors for context
      let current = getTaxonomyParentId(item);
      const seen = new Set();
      while (current && !seen.has(current)) {
        seen.add(current);
        matched.add(current);
        const node = idMap.get(current);
        current = node ? getTaxonomyParentId(node) : null;
      }
    }
  }
  return matched;
}

/**
 * Sort flat list the same way siblings are ordered in the tree.
 * @param {Array} items
 */
export function sortTaxonomyFlatList(items) {
  return [...items].sort((a, b) => {
    const parentA = getTaxonomyParentId(a);
    const parentB = getTaxonomyParentId(b);
    if (parentA !== parentB) {
      return String(parentA || '').localeCompare(String(parentB || ''));
    }
    return compareTaxonomySiblings(a, b);
  });
}

/**
 * Generate slug from name.
 * @param {string} name
 */
export function slugifyTaxonomyName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
