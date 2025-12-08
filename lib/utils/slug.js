/**
 * Slug Generation Utility
 * 
 * Generates SEO-friendly slugs from titles with auto-increment
 * for duplicate handling.
 */

import Product from '@/lib/models/Product';

/**
 * Generates a slug from a title string
 * Handles URL decoding and special character conversion
 * 
 * @param {string} title - The title to convert to a slug
 * @returns {string} - The generated slug
 */
export function generateSlugFromTitle(title) {
  if (!title) return '';

  // URL decode the title if needed (handles special characters like &)
  let decodedTitle = title;
  try {
    decodedTitle = decodeURIComponent(title);
  } catch (e) {
    // If decoding fails, use the original title
    decodedTitle = title;
  }

  // Convert to slug format
  // "Cafe & Bar!" -> "cafe-and-bar"
  const slug = decodedTitle
    .toLowerCase()
    .trim()
    // Replace common symbols with words
    .replace(/&/g, 'and')
    // Replace all non-alphanumeric characters with hyphens
    .replace(/[^a-z0-9]+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/(^-|-$)/g, '');

  return slug;
}

/**
 * Generates a unique slug by checking for duplicates and auto-incrementing
 * 
 * @param {string} title - The title to generate slug from
 * @param {string} excludeProductId - Product ID to exclude from duplicate check (for updates)
 * @returns {string} - A unique slug
 */
export async function generateUniqueSlug(title, excludeProductId = null) {
  const baseSlug = generateSlugFromTitle(title);
  
  if (!baseSlug) {
    throw new Error('Cannot generate slug from empty title');
  }

  // Build base query - exclude current product if updating
  const baseQuery = excludeProductId ? { _id: { $ne: excludeProductId } } : {};

  // Check if base slug exists
  const existingBaseProduct = await Product.findOne({
    ...baseQuery,
    slug: baseSlug,
  });
  
  if (!existingBaseProduct) {
    // Base slug is unique, return it
    return baseSlug;
  }

  // Base slug exists, find all numbered duplicates (baseSlug-1, baseSlug-2, etc.)
  // Escape special regex characters in baseSlug
  const escapedBaseSlug = baseSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const slugPattern = new RegExp(`^${escapedBaseSlug}-(\\d+)$`);
  
  const duplicates = await Product.find({
    ...baseQuery,
    slug: slugPattern,
  });

  // Find the highest number used
  let maxNumber = 0;
  duplicates.forEach(product => {
    const match = product.slug.match(slugPattern);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (num > maxNumber) {
        maxNumber = num;
      }
    }
  });

  // Return slug with incremented number
  return `${baseSlug}-${maxNumber + 1}`;
}

