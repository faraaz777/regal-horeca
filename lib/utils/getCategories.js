/**
 * Server-side function to fetch categories
 * Used for SSR/pre-rendering to ensure categories are available immediately
 */

import { connectToDatabase } from '@/lib/db/connect';
import Category from '@/lib/models/Category';

/**
 * Efficiently serialize category to plain object (faster than JSON.parse/stringify)
 */
function serializeCategory(cat) {
  return {
    ...cat,
    _id: cat._id?.toString ? cat._id.toString() : String(cat._id || ''),
    id: cat._id?.toString ? cat._id.toString() : String(cat._id || ''),
    parent: cat.parent ? (cat.parent.toString ? cat.parent.toString() : String(cat.parent)) : null,
    createdAt: cat.createdAt instanceof Date ? cat.createdAt.toISOString() : cat.createdAt,
    updatedAt: cat.updatedAt instanceof Date ? cat.updatedAt.toISOString() : cat.updatedAt,
  };
}

/**
 * Flatten tree structure for easier access
 * Also serializes categories to plain objects
 */
function flattenCategories(cats) {
  let result = [];
  cats.forEach(cat => {
    const serialized = serializeCategory(cat);
    // Remove children from flattened version
    const { children, ...catWithoutChildren } = serialized;
    result.push(catWithoutChildren);
    if (cat.children && cat.children.length > 0) {
      result = result.concat(flattenCategories(cat.children));
    }
  });
  return result;
}

/**
 * Fetch categories as tree structure and flatten them
 * Returns empty array on error to prevent blocking
 * Uses efficient serialization instead of expensive JSON.parse/stringify
 */
export async function getCategories() {
  try {
    await connectToDatabase();
    const tree = await Category.buildTree();
    // Use efficient serialization instead of JSON.parse/stringify
    return flattenCategories(tree || []);
  } catch (error) {
    console.error('Failed to fetch categories server-side:', error);
    // Return empty array on error - client-side fetch will handle it
    return [];
  }
}

