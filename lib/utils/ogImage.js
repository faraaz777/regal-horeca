/**
 * Open Graph & Twitter card image URL helpers.
 * Ensures consistent, absolute image URLs and fallback logic across social meta tags.
 * For SEO (sitemap, JSON-LD, Open Graph) we use direct R2 URLs so crawlers never hit /_next/image.
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
 * Return a direct image URL for SEO (sitemap, JSON-LD, Open Graph).
 * - If the value is a Next.js image URL (/_next/image?url=...), extracts and returns the real URL.
 * - If already absolute (e.g. R2), returns as-is.
 * - If relative, prepends R2_PUBLIC_URL when set, otherwise baseUrl.
 * @param {string | null | undefined} path - Image path or URL
 * @param {string} baseUrl - Site base URL (e.g. https://www.regalhoreca.com)
 * @returns {string | null} Direct absolute URL or null if path is falsy
 */
export function toDirectSeoImageUrl(path, baseUrl) {
  if (!path || typeof path !== 'string') return null;
  const trimmed = path.trim();
  if (!trimmed) return null;

  // If it's a Next.js image URL, extract the real image URL from the query param
  if (trimmed.includes('_next/image') && trimmed.includes('url=')) {
    try {
      const urlPart = trimmed.includes('?') ? trimmed.split('?')[1] : '';
      const params = new URLSearchParams(urlPart);
      const realUrl = params.get('url');
      if (realUrl) return decodeURIComponent(realUrl);
    } catch (_) {
      // fall through to treat as normal URL
    }
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;

  const pathPart = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const r2Base = process.env.R2_PUBLIC_URL;
  if (r2Base) return r2Base.replace(/\/$/, '') + pathPart;
  const base = (baseUrl || '').replace(/\/$/, '');
  return `${base}${pathPart}`;
}

/**
 * Get a single absolute image URL for product OG/Twitter cards.
 * Uses direct R2 URLs for product images so Google/crawlers see real image URLs (no /_next/image).
 * Fallback order: heroImage → first gallery image → default OG image → favicon.
 * @param {object} product - Product with optional heroImage and gallery
 * @param {object} siteConfig - SITE_CONFIG (baseUrl, defaultOgImagePath, fallbackOgImagePath)
 * @returns {string} Always returns an absolute URL (direct R2 for product images)
 */
export function getProductOgImageUrl(product, siteConfig) {
  const baseUrl = siteConfig.baseUrl || '';
  const raw =
    (product && (product.heroImage || (product.gallery && product.gallery[0]))) || null;
  const fromProduct = toDirectSeoImageUrl(raw, baseUrl);
  if (fromProduct) return fromProduct;
  const defaultPath = siteConfig.defaultOgImagePath || '/og-default.png';
  const fromDefault = toAbsoluteImageUrl(defaultPath, baseUrl);
  if (fromDefault) return fromDefault;
  const fallbackPath = siteConfig.fallbackOgImagePath || '/favicon.ico';
  return toAbsoluteImageUrl(fallbackPath, baseUrl) || `${baseUrl}/favicon.ico`;
}
