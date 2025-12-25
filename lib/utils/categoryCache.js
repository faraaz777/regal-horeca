/**
 * Category Tree Cache Utility
 * 
 * Caches category tree structure to reduce database queries.
 * Categories don't change frequently, so caching improves performance significantly.
 */

let categoryTreeCache = null;
let categoryIdsCache = {}; // Cache category ID mappings to avoid recursive queries
let cacheTimestamp = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

/**
 * Gets cached category tree
 * @returns {Promise<Array>} Category tree
 */
export async function getCachedCategoryTree() {
  const now = Date.now();
  
  if (categoryTreeCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return categoryTreeCache;
  }
  
  const Category = (await import('@/lib/models/Category')).default;
  
  categoryTreeCache = await Category.buildTree();
  cacheTimestamp = now;
  
  // Clear categoryIdsCache when tree cache is refreshed
  categoryIdsCache = {};
  
  return categoryTreeCache;
}

/**
 * Gets all category IDs for a given category and its subcategories
 * OPTIMIZED: Uses cached category tree to avoid recursive DB queries
 * @param {string} categorySlug - Category slug
 * @returns {Promise<Array>} Array of category IDs
 */
export async function getCategoryIdsWithChildren(categorySlug) {
  // Check cache first
  if (categoryIdsCache[categorySlug]) {
    return categoryIdsCache[categorySlug];
  }
  
  const Category = (await import('@/lib/models/Category')).default;
  const category = await Category.findOne({ slug: categorySlug }).select('_id').lean();
  
  if (!category) {
    return [];
  }
  
  // Get cached tree (or build it if needed)
  const tree = await getCachedCategoryTree();
  
  // Find category in tree and get all descendant IDs
  const findCategoryInTree = (nodes, targetId, foundIds = []) => {
    for (const node of nodes) {
      if (node._id.toString() === targetId.toString()) {
        // Found the category, collect all descendant IDs
        const collectDescendantIds = (categoryNode) => {
          const ids = [categoryNode._id.toString()];
          if (categoryNode.children && Array.isArray(categoryNode.children)) {
            categoryNode.children.forEach(child => {
              ids.push(...collectDescendantIds(child));
            });
          }
          return ids;
        };
        return collectDescendantIds(node);
      }
      if (node.children && Array.isArray(node.children)) {
        const result = findCategoryInTree(node.children, targetId, foundIds);
        if (result.length > 0) {
          return result;
        }
      }
    }
    return [];
  };
  
  const categoryIds = findCategoryInTree(tree, category._id);
  
  // Cache the result
  categoryIdsCache[categorySlug] = categoryIds;
  
  return categoryIds;
}

/**
 * Clears the category cache (call after category updates)
 */
export function clearCategoryCache() {
  categoryTreeCache = null;
  categoryIdsCache = {};
  cacheTimestamp = 0;
}

