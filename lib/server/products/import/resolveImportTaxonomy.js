/**
 * Resolve Excel brand/category/business-type names to catalog ids.
 *
 * Excel never stores ObjectIds. Operators type names; we match against the
 * live Brand / Category / BusinessType trees.
 */

function norm(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function nodeId(node) {
  return String(node?._id || node?.id || '');
}

function parentId(node) {
  const parent = node?.parent;
  if (!parent) return '';
  if (typeof parent === 'object') return String(parent._id || parent.id || '');
  return String(parent);
}

export function indexTaxonomy(nodes) {
  const byId = new Map();
  const byLevelName = new Map();
  for (const node of nodes || []) {
    const id = nodeId(node);
    if (!id) continue;
    byId.set(id, node);
    const key = `${node.level || ''}::${norm(node.name)}`;
    if (!byLevelName.has(key)) byLevelName.set(key, []);
    byLevelName.get(key).push(node);
  }
  return { byId, byLevelName, all: nodes || [] };
}

export function getNodeAncestry(node, byId) {
  const ancestry = {};
  let current = node;
  const seen = new Set();
  while (current) {
    const id = nodeId(current);
    if (!id || seen.has(id)) break;
    seen.add(id);
    if (current.level) ancestry[current.level] = id;
    const pid = parentId(current);
    current = pid ? byId.get(pid) : null;
  }
  return ancestry;
}

function matchesUnderParent(node, expectedParentId, byId) {
  if (!expectedParentId) return true;
  const pid = parentId(node);
  if (pid === expectedParentId) return true;
  let current = pid ? byId.get(pid) : null;
  const seen = new Set();
  while (current) {
    const id = nodeId(current);
    if (!id || seen.has(id)) break;
    if (id === expectedParentId) return true;
    seen.add(id);
    current = parentId(current) ? byId.get(parentId(current)) : null;
  }
  return false;
}

/**
 * Walk a named catalog path. Each filled level must exist as a child of the previous.
 */
export function resolveNamedPath(pathNames, index, levels) {
  const errors = [];
  let parentConstraint = '';
  let leaf = null;

  for (const level of levels) {
    const name = norm(pathNames[level]);
    if (!name) continue;
    const candidates = (index.byLevelName.get(`${level}::${name}`) || []).filter((node) =>
      matchesUnderParent(node, parentConstraint, index.byId)
    );
    if (candidates.length === 0) {
      errors.push(`No ${level} named "${pathNames[level]}"${parentConstraint ? ' under the selected parent' : ''} in the catalog.`);
      return { id: '', errors };
    }
    if (candidates.length > 1) {
      errors.push(
        `Multiple ${level}s named "${pathNames[level]}". Use a more complete path.`
      );
      return { id: '', errors };
    }
    leaf = candidates[0];
    parentConstraint = nodeId(leaf);
  }

  return { id: leaf ? nodeId(leaf) : '', errors };
}

const BRAND_LEVELS = ['department', 'category', 'subcategory'];

export function resolveBrandName(name, levelHint, brandIndex) {
  const errors = [];
  const brandName = String(name || '').trim();
  if (!brandName) return { id: '', displayName: '', errors };

  const hint = norm(levelHint);
  const levels = hint && BRAND_LEVELS.includes(hint) ? [hint] : BRAND_LEVELS;
  const matches = [];
  for (const level of levels) {
    const found = brandIndex.byLevelName.get(`${level}::${norm(brandName)}`) || [];
    matches.push(...found);
  }

  if (matches.length === 0) {
    errors.push(
      `Brand "${brandName}" was not found in the brand tree. Pick an existing brand or create it under Brands first.`
    );
    return { id: '', displayName: '', errors };
  }

  if (matches.length > 1) {
    const levelsFound = [...new Set(matches.map((m) => m.level))].join(', ');
    errors.push(
      `Multiple brands named "${brandName}" (${levelsFound}). Set brand_level_hint to department, category, or subcategory.`
    );
    return { id: '', displayName: '', errors };
  }

  const node = matches[0];
  const ancestry = getNodeAncestry(node, brandIndex.byId);
  const department = ancestry.department ? brandIndex.byId.get(ancestry.department) : node;
  return {
    id: nodeId(node),
    displayName: department?.name || node.name,
    errors,
  };
}

export function resolveBusinessTypes(raw, businessTypes) {
  const errors = [];
  const slugs = [];
  const parts = String(raw || '')
    .split(/[,|;]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  for (const part of parts) {
    const needle = norm(part);
    const hit = (businessTypes || []).find(
      (bt) => norm(bt.slug) === needle || norm(bt.name) === needle
    );
    if (!hit) {
      errors.push(`Unknown business type "${part}".`);
      continue;
    }
    if (!slugs.includes(hit.slug)) slugs.push(hit.slug);
  }

  return { slugs, errors };
}
