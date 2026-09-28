/**
 * Product label helpers.
 *
 * Labels print the buyable SKU (standalone or child), never a parent carrier.
 * Sizes stay in millimetres so the browser print dialog and jsPDF share one source.
 */

export const LABEL_SIZES = {
  '50x25': { id: '50x25', widthMm: 50, heightMm: 25, label: '50 × 25 mm' },
  '50x30': { id: '50x30', widthMm: 50, heightMm: 30, label: '50 × 30 mm' },
};

export const DEFAULT_LABEL_SIZE_ID = '50x30';

export function getLabelSize(sizeId) {
  return LABEL_SIZES[sizeId] || LABEL_SIZES[DEFAULT_LABEL_SIZE_ID];
}

export function variantLineFromAttrs(attrs) {
  return ['size', 'color', 'weight', 'unitCount']
    .map((key) => String(attrs?.[key] || '').trim())
    .filter(Boolean)
    .join(' / ');
}

export function productPageUrl(slug, baseUrl) {
  const trimmed = String(slug || '').trim();
  if (!trimmed) return '';
  const base = String(baseUrl || '').replace(/\/$/, '');
  if (!base) return `/products/${encodeURIComponent(trimmed)}`;
  return `${base}/products/${encodeURIComponent(trimmed)}`;
}

/**
 * QR payload: storefront PDP when a slug exists, otherwise SKU/barcode
 * so the sticker still scans when a legacy row has no URL.
 */
export function labelQrValue(item, baseUrl) {
  const url = productPageUrl(item?.slug, baseUrl);
  if (url) return url;
  return String(item?.sku || item?.barcode || '').trim();
}

export function toProductLabelItem(product, { fallbackSlug = '', fallbackTitle = '' } = {}) {
  const attrs = product?.variationAttributes || {};
  const id = String(product?._id || product?.id || product?.sku || fallbackSlug || 'label');
  return {
    id,
    title: String(product?.title || fallbackTitle || 'Product').trim() || 'Product',
    sku: String(product?.sku || '').trim(),
    barcode: String(product?.barcode || '').trim(),
    slug: String(product?.slug || fallbackSlug || '').trim(),
    variantLine: variantLineFromAttrs(attrs),
  };
}

/**
 * Parent / legacy-carrier rows expand to their children. A lone SKU is itself.
 */
export function collectProductLabelItems(product, displayChildren = [], isCarrier = false) {
  if (isCarrier) {
    if (!Array.isArray(displayChildren) || displayChildren.length === 0) return [];
    return displayChildren.map((child) =>
      toProductLabelItem(child, {
        fallbackSlug: child?.slug || product?.slug,
        fallbackTitle: product?.title,
      })
    );
  }
  return [toProductLabelItem(product)];
}
