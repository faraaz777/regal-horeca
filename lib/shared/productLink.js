/**
 * Product mapping constants.
 *
 * A link is one undirected SKU-to-SKU edge: "this product is linked to that."
 * No substitute/similar type and no internal/customer audience —
 * linkage alone is the concept.
 *
 * Link modes:
 * - star: each picked SKU links only to the master
 * - mesh: master + picks form a clique (every pair linked)
 *
 * This is not merchandising. Related products stay on the product document.
 */

/** Cap per SKU so the alternatives list stays usable for a salesman. */
export const PRODUCT_LINK_CAP = 30;

export const PRODUCT_LINK_NOTE_MAX = 240;

export const PRODUCT_LINK_MODE_STAR = 'star';
export const PRODUCT_LINK_MODE_MESH = 'mesh';
export const PRODUCT_LINK_MODES = [PRODUCT_LINK_MODE_STAR, PRODUCT_LINK_MODE_MESH];

export const PRODUCT_LINK_UNLINK_PAIR = 'pair';
export const PRODUCT_LINK_UNLINK_GROUP = 'group';
export const PRODUCT_LINK_UNLINK_SCOPES = [PRODUCT_LINK_UNLINK_PAIR, PRODUCT_LINK_UNLINK_GROUP];

/**
 * Stable pair so A↔B is stored once, regardless of which side was picked first.
 * @param {string} left
 * @param {string} right
 * @returns {[string, string]}
 */
export function orderedProductPair(left, right) {
  const a = String(left || '').trim();
  const b = String(right || '').trim();
  return a < b ? [a, b] : [b, a];
}

/**
 * Undirected edge count for a clique of n nodes.
 * @param {number} n
 */
export function meshEdgeCount(n) {
  const size = Math.max(0, Number(n) || 0);
  return (size * (size - 1)) / 2;
}

/**
 * How many new edges a star save adds for `pickCount` picks against a master
 * (ignores already-existing edges — caller can subtract).
 * @param {number} pickCount
 */
export function starEdgeCount(pickCount) {
  return Math.max(0, Number(pickCount) || 0);
}
