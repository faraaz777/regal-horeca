/**
 * Server-side category utilities
 */

import { connectToDatabase } from '@/lib/db/connect';
import Category from '@/lib/models/Category';

/**
 * Serialize MongoDB objects to plain JSON-serializable objects
 */
function serializeCategory(cat) {
  if (!cat) return null;
  
  // Handle _id - convert ObjectId to string
  const _id = cat._id ? (cat._id.toString ? cat._id.toString() : String(cat._id)) : null;
  
  // Handle parent - can be ObjectId, populated object, or string
  let parent = null;
  if (cat.parent) {
    if (typeof cat.parent === 'object') {
      // If populated, extract _id
      parent = cat.parent._id ? (cat.parent._id.toString ? cat.parent._id.toString() : String(cat.parent._id)) : null;
    } else {
      // Already a string or primitive
      parent = String(cat.parent);
    }
  }
  
  return {
    _id,
    id: cat.id || _id,
    name: cat.name,
    slug: cat.slug,
    level: cat.level,
    parent,
    image: cat.image,
    tagline: cat.tagline,
    createdAt: cat.createdAt,
    updatedAt: cat.updatedAt,
    // Recursively serialize children if they exist
    children: cat.children && Array.isArray(cat.children) ? cat.children.map(serializeCategory) : undefined,
  };
}

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
    // Serialize to plain objects for client component compatibility
    return (tree || []).map(serializeCategory);
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
    const flattened = flattenCategories(tree);
    // Ensure all categories are serialized (in case flattening didn't serialize nested children)
    return flattened.map(serializeCategory);
  } catch (error) {
    console.error('Error flattening categories:', error);
    return [];
  }
}

