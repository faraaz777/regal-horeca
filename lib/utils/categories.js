/**
 * Server-side category utilities
 */

import { connectToDatabase } from '@/lib/db/connect';
import Category from '@/lib/models/Category';

/**
 * Flatten category tree structure
 */
export function flattenCategories(cats) {
  let result = [];
  cats.forEach(cat => {
    result.push(cat);
    if (cat.children && cat.children.length > 0) {
      result = result.concat(flattenCategories(cat.children));
    }
  });
  return result;
}

/**
 * Fetch categories as tree (server-side)
 */
export async function getCategoriesTree() {
  try {
    await connectToDatabase();
    const tree = await Category.buildTree();
    return tree || [];
  } catch (error) {
    console.error('Error fetching categories tree:', error);
    return [];
  }
}

/**
 * Fetch categories as flat array (server-side)
 */
export async function getCategoriesFlat() {
  try {
    const tree = await getCategoriesTree();
    return flattenCategories(tree);
  } catch (error) {
    console.error('Error flattening categories:', error);
    return [];
  }
}

