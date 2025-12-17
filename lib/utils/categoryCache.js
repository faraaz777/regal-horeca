/**
 * Category Tree Cache Utility
 * 
 * Caches category tree structure to reduce database queries.
 * Categories don't change frequently, so caching improves performance significantly.
 */

let categoryTreeCache = null;
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
  
  return categoryTreeCache;
}

/**
 * Gets all category IDs for a given category and its subcategories
 * Simple recursive approach - categories don't change often
 * @param {string} categorySlug - Category slug
 * @returns {Promise<Array>} Array of category IDs
 */
export async function getCategoryIdsWithChildren(categorySlug) {
  const Category = (await import('@/lib/models/Category')).default;
  const category = await Category.findOne({ slug: categorySlug }).lean();
  
  if (!category) {
    return [];
  }
  
  // Simple recursive function to get all descendant IDs
  const getAllSubcategoryIds = async (parentId) => {
    const children = await Category.find({ parent: parentId }).select('_id').lean();
    let ids = [parentId];
    for (const child of children) {
      ids = ids.concat(await getAllSubcategoryIds(child._id));
    }
    return ids;
  };
  
  return await getAllSubcategoryIds(category._id);
}

/**
 * Clears the category cache (call after category updates)
 */
export function clearCategoryCache() {
  categoryTreeCache = null;
  cacheTimestamp = 0;
}

