/**
 * Server-side function to fetch categories
 * Used for SSR/pre-rendering to ensure categories are available immediately
 */

import { connectToDatabase } from '@/lib/db/connect';
import Category from '@/lib/models/Category';

/**
 * Flatten tree structure for easier access
 */
function flattenCategories(cats) {
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
 * Fetch categories as tree structure and flatten them
 * Returns empty array on error to prevent blocking
 * Uses JSON.parse(JSON.stringify()) to convert Mongoose documents to plain objects
 */
export async function getCategories() {
  try {
    await connectToDatabase();
    const tree = await Category.buildTree();
    const flattened = flattenCategories(tree || []);
    // Convert Mongoose documents to plain objects for Client Components
    return JSON.parse(JSON.stringify(flattened));
  } catch (error) {
    console.error('Failed to fetch categories server-side:', error);
    // Return empty array on error - client-side fetch will handle it
    return [];
  }
}

