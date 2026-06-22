import 'server-only';

import Product from '@/lib/models/Product';

function normalizeSku(value) {
  return String(value ?? '').trim();
}

/**
 * Find active catalog conflicts for SKU (standalone + child rows).
 */
export async function findSkuConflicts(sku, excludeProductId = null) {
  const normalized = normalizeSku(sku);
  if (!normalized) return [];

  const query = {
    deletedAt: null,
    sku: normalized,
    productType: { $in: ['standalone', 'child'] },
  };
  if (excludeProductId) {
    query._id = { $ne: excludeProductId };
  }

  const hit = await Product.findOne(query).select('_id title sku').lean();
  if (!hit) return [];

  return [{ productId: String(hit._id), title: hit.title, sku: hit.sku }];
}

export async function assertUniqueSkuBarcode({ sku, barcode, excludeProductId = null }) {
  const errors = [];

  const skuNorm = normalizeSku(sku);
  if (skuNorm) {
    const skuHits = await findSkuConflicts(skuNorm, excludeProductId);
    if (skuHits.length > 0) {
      errors.push(`SKU "${skuNorm}" is already used by "${skuHits[0].title}".`);
    }
  }

  const barcodeNorm = String(barcode ?? '').trim();
  if (barcodeNorm) {
    const { findBarcodeConflicts } = await import('@/lib/server/products/barcodeValidation');
    const exclude = excludeProductId ? [excludeProductId] : [];
    const barcodeHits = await findBarcodeConflicts([barcodeNorm], { excludeProductIds: exclude });
    if (barcodeHits.length > 0) {
      errors.push(`Barcode "${barcodeNorm}" is already used by "${barcodeHits[0].title}".`);
    }
  }

  if (errors.length > 0) {
    const err = new Error(errors.join(' '));
    err.code = 'DUPLICATE_IDENTITY';
    err.details = errors;
    throw err;
  }
}
