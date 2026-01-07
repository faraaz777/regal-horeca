/**
 * Server-side function to fetch categories
 * Used for SSR/pre-rendering to ensure categories are available immediately
 * Uses React cache() for request deduplication and unstable_cache for cross-request caching
 */

import { cache } from 'react';
import { unstable_cache } from 'next/cache';
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
 * Internal function to fetch categories from database
 * This is wrapped with caching layers
 */
async function fetchCategoriesFromDB() {
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

/**
 * Cached version - caches across requests for 5 minutes
 * This prevents database queries on every page load
 */
const getCachedCategories = unstable_cache(
  fetchCategoriesFromDB,
  ['categories'], // Cache key
  {
    revalidate: 300, // Revalidate every 5 minutes (300 seconds)
    tags: ['categories'], // Tag for manual revalidation
  }
);

/**
 * Fetch categories with request deduplication
 * Uses React cache() to dedupe within a single request
 * Uses unstable_cache to cache across requests
 * Returns empty array on error to prevent blocking
 */
export const getCategories = cache(async () => {
  // Skip during build to prevent build slowdown
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return [];
  }
  
  try {
    return await getCachedCategories();
  } catch (error) {
    console.error('Failed to get cached categories:', error);
    return [];
  }
});

