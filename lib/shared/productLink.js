/**
 * Product mapping constants.
 *
 * A link is one undirected SKU-to-SKU edge: "this product is linked to that."
 * No substitute/similar type and no internal/customer audience —
 * linkage alone is the concept.
 *
 * This is not merchandising. Related products stay on the product document.
 */

/** Cap per SKU so the alternatives list stays usable for a salesman. */
export const PRODUCT_LINK_CAP = 30;

export const PRODUCT_LINK_NOTE_MAX = 240;

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
