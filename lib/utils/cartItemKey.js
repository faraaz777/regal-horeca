/**
 * Stable cart line identity: product + optional swatch color + optional SKU variant.
 * Legacy keys (productId or productId_color) are unchanged when no variant segment exists.
 */

export function getVariantKeySegment(selectedVariant) {
  if (!selectedVariant || typeof selectedVariant !== 'object') return '';
  const id = String(selectedVariant.variantId || '').trim();
  if (id) return id;
  const sku = String(selectedVariant.sku || '').trim();
  if (sku) return `sku:${sku}`;
  return '';
}

/**
 * @param {string|undefined} productId
 * @param {object|null} selectedColor
 * @param {object|null} selectedVariant - admin variant row (variantId / sku / attributes)
 */
export function createCartItemKey(productId, selectedColor = null, selectedVariant = null) {
  const productIdStr = productId?.toString();

  let baseKey;
  if (!selectedColor || typeof selectedColor !== 'object') {
    baseKey = productIdStr;
  } else {
    const colorIdentifier =
      selectedColor.colorName ||
      selectedColor.colorHex ||
      selectedColor.colorId ||
      selectedColor.id ||
      selectedColor._id;

    if (colorIdentifier && colorIdentifier !== 'undefined' && colorIdentifier !== 'null') {
      baseKey = `${productIdStr}_${colorIdentifier.toString()}`;
    } else {
      try {
        const colorHash = JSON.stringify(selectedColor);
        const hash = colorHash.split('').reduce((acc, char) => {
          const h = ((acc << 5) - acc) + char.charCodeAt(0);
          return h & h;
        }, 0);
        baseKey = `${productIdStr}_hash_${Math.abs(hash)}`;
      } catch {
        baseKey = productIdStr;
      }
    }
  }

  const vSeg = getVariantKeySegment(selectedVariant);
  return vSeg ? `${baseKey}__VAR__${vSeg}` : baseKey;
}

export function formatCartVariantSummary(variant) {
  if (!variant || typeof variant !== 'object') return '';
  const parts = [variant.size, variant.color, variant.weight, variant.unitCount].filter(Boolean);
  const tail = parts.join(' · ');
  if (tail) return tail;
  const sku = String(variant.sku || '').trim();
  if (sku) return sku;
  const name = String(variant.name || '').trim();
  return name || '';
}

/**
 * Image shown in cart for a line: variant gallery → colour swatch images → product hero.
 */
export function resolveCartLineImage(item, product) {
  const fromVariant = item?.selectedVariant?.images;
  if (Array.isArray(fromVariant) && fromVariant.length > 0) {
    const url = fromVariant.find(Boolean);
    if (url) return url;
  }
  const colorName = String(item?.selectedVariant?.color || item?.selectedColor?.colorName || '')
    .trim()
    .toLowerCase();
  if (colorName && product?.colorVariants?.length) {
    const cv = product.colorVariants.find(
      (c) => String(c?.colorName || '').trim().toLowerCase() === colorName
    );
    const cvImgs = cv?.images;
    if (Array.isArray(cvImgs) && cvImgs.length > 0) {
      const url = cvImgs.find(Boolean);
      if (url) return url;
    }
  }
  return (
    product?.heroImage ||
    product?.image ||
    (Array.isArray(product?.images) && product.images[0]) ||
    '/placeholder-product.jpg'
  );
}

/** PDP link that restores the same SKU row when variants exist. */
export function buildProductHrefWithVariant(slug, selectedVariant) {
  const base = `/products/${slug}`;
  if (!selectedVariant || typeof selectedVariant !== 'object') return base;
  const vid = String(selectedVariant.variantId || '').trim();
  const sku = String(selectedVariant.sku || '').trim();
  const qs = new URLSearchParams();
  if (vid) qs.set('variantId', vid);
  else if (sku) qs.set('sku', sku);
  const q = qs.toString();
  return q ? `${base}?${q}` : base;
}
