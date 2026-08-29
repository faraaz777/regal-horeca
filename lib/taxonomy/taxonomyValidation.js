/**
 * Taxonomy Validation
 *
 * Server-side parent/level checks for menu-builder reorder and create.
 */

import { deriveLevelFromParent } from './taxonomyTreeUtils.js';

/**
 * Expected parent level for a child level.
 * @param {string[]} levels
 * @param {string} childLevel
 * @returns {string|null}
 */
export function getExpectedParentLevel(levels, childLevel) {
  const idx = levels.indexOf(childLevel);
  if (idx <= 0) return null;
  return levels[idx - 1];
}

/**
 * Validate parent matches expected level for child.
 * @param {Object|null} parentDoc
 * @param {string} childLevel
 * @param {string[]} levels
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateTaxonomyParent(parentDoc, childLevel, levels) {
  const expectedParentLevel = getExpectedParentLevel(levels, childLevel);
  if (!expectedParentLevel) {
    if (parentDoc) {
      return { valid: false, error: `Root level cannot have a parent` };
    }
    return { valid: true };
  }
  if (!parentDoc) {
    return { valid: false, error: `Parent is required for level "${childLevel}"` };
  }
  if (parentDoc.level !== expectedParentLevel) {
    return {
      valid: false,
      error: `Parent must be level "${expectedParentLevel}", got "${parentDoc.level}"`,
    };
  }
  return { valid: true };
}

/**
 * Validate reorder/move payload for one item.
 * @param {Object} params
 * @param {string|null} params.parentId
 * @param {string} params.itemId
 * @param {Map} params.idMap
 * @param {string[]} params.levels
 */
export function validateTaxonomyMove({ parentId, itemId, idMap, levels }) {
  if (parentId === itemId) {
    return { valid: false, error: 'Item cannot be its own parent' };
  }

  // Prevent moving under a descendant
  if (parentId) {
    let current = parentId;
    const seen = new Set();
    while (current && !seen.has(current)) {
      seen.add(current);
      if (current === itemId) {
        return { valid: false, error: 'Cannot move item under its own descendant' };
      }
      const node = idMap.get(current);
      current = node?.parent
        ? (typeof node.parent === 'object' ? node.parent._id?.toString?.() ?? node.parent.toString?.() : String(node.parent))
        : null;
    }
  }

  const level = deriveLevelFromParent(parentId, idMap, levels);
  const parentDoc = parentId ? idMap.get(parentId) : null;
  return validateTaxonomyParent(parentDoc, level, levels);
}
