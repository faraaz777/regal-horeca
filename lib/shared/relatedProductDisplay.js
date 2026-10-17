/**
 * Display label for Related Products picker / chips.
 * Prefer explicit variant attrs so admins pick the exact SKU, not a family name.
 */
export function formatRelatedProductLabel(product) {
  if (!product) return 'Product';

  const title = String(product.title || 'Product').trim() || 'Product';
  const attrs = product.variationAttributes || {};
  const size = String(attrs.size || '').trim();
  const color = String(attrs.color || attrs.colorDetails?.colorName || '').trim();
  const sku = String(product.sku || '').trim();

  const bits = [];
  if (size) bits.push(size);
  if (color) bits.push(color);
  if (sku) bits.push(`SKU ${sku}`);

  if (bits.length === 0) return title;
  return `${title} — ${bits.join(' · ')}`;
}

/** Related targets must be sellable rows (not parent carriers). */
export function isRelatedProductTargetAllowed(product) {
  if (!product) return false;
  const type = product.productType || 'standalone';
  return type === 'standalone' || type === 'child';
}
