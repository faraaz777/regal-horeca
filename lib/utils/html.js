/**
 * HTML utilities for product descriptions and meta.
 */

/**
 * Strip HTML tags and collapse whitespace for use in meta tags or share text.
 */
export function stripHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Heuristic: treat a string as HTML if it starts with a tag-like structure.
 * Used to distinguish new rich-text descriptions from legacy Markdown.
 */
export function isHtml(str) {
  if (!str || typeof str !== 'string') return false;
  const trimmed = str.trim();
  return trimmed.startsWith('<') && trimmed.includes('>');
}

