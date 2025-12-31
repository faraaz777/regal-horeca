/**
 * Category Utility Functions
 */

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
  categories.forEach(cat => {
    result.push(cat);
    if (cat.children && cat.children.length > 0) {
      result = result.concat(flattenCategories(cat.children));
    }
  });
  return result;
}

