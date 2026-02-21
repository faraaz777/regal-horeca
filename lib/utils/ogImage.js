/**
 * Open Graph & Twitter card image URL helpers.
 * Ensures consistent, absolute image URLs and fallback logic across social meta tags.
 */

/**
 * Convert a relative or absolute image path to an absolute URL.
 * @param {string | null | undefined} path - Image path (relative, or already absolute)
 * @param {string} baseUrl - Site base URL (e.g. https://www.regalhoreca.com)
 * @returns {string | null} Absolute URL or null if path is falsy
 */
export function toAbsoluteImageUrl(path, baseUrl) {
  if (!path || typeof path !== 'string') return null;
  const trimmed = path.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  const base = baseUrl.replace(/\/$/, '');
  const pathPart = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${base}${pathPart}`;
}

/**
 * Get a single absolute image URL for product OG/Twitter cards.
 * Fallback order: heroImage → first gallery image → default OG image → favicon.
 * @param {object} product - Product with optional heroImage and gallery
 * @param {object} siteConfig - SITE_CONFIG (baseUrl, defaultOgImagePath, fallbackOgImagePath)
 * @returns {string} Always returns an absolute URL
 */
export function getProductOgImageUrl(product, siteConfig) {
  const baseUrl = siteConfig.baseUrl || '';
  const raw =
    (product && (product.heroImage || (product.gallery && product.gallery[0]))) || null;
  const fromProduct = toAbsoluteImageUrl(raw, baseUrl);
  if (fromProduct) return fromProduct;
  const defaultPath = siteConfig.defaultOgImagePath || '/og-default.png';
  const fromDefault = toAbsoluteImageUrl(defaultPath, baseUrl);
  if (fromDefault) return fromDefault;
  const fallbackPath = siteConfig.fallbackOgImagePath || '/favicon.ico';
  return toAbsoluteImageUrl(fallbackPath, baseUrl) || `${baseUrl}/favicon.ico`;
}
