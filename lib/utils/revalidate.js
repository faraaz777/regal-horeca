/**
 * Revalidation Utility
 * 
 * Helper function to trigger on-demand cache revalidation
 * Can be used in server-side API routes or called via the revalidate API endpoint
 */

import { revalidatePath as nextRevalidatePath } from 'next/cache';

/**
 * Trigger cache revalidation for a specific path (server-side only)
 * Use this function directly in API routes
 * @param {string} path - The path to revalidate (e.g., '/' for homepage)
 */
export function revalidatePath(path) {
  try {
    nextRevalidatePath(path);
    console.log(`Successfully revalidated path: ${path}`);
  } catch (error) {
    console.error(`Error revalidating path ${path}:`, error);
  }
}

/**
 * Revalidate homepage (for products and categories)
 * Call this after updating products or categories
 */
export function revalidateHomepage() {
  revalidatePath('/');
}

