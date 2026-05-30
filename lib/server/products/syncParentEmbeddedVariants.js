import 'server-only';

import Product from '@/lib/models/Product';
import { normalizeBarcode } from '@/lib/server/products/barcodeValidation';

/**
 * Keep legacy embedded `parent.variants[]` in sync when a child variant's commerce
 * fields change, without loading/saving the full parent document (avoids __v races).
 */
export async function syncParentEmbeddedVariantFromChild(parentId, child) {
  if (!parentId || !child) return false;

  const legacyId = String(child.legacyParentVariantId || '').trim();
  if (!legacyId) return false;

  const barcode = normalizeBarcode(child.barcode);
  const sku = String(child.sku || '').trim();
  const hsnCode = String(child.hsnCode || '').trim();

  const attrs = child.variationAttributes || {};
  const gallery = Array.isArray(child.gallery) ? child.gallery.filter(Boolean) : [];

  const result = await Product.updateOne(
    {
      _id: parentId,
      'variants.variantId': legacyId,
    },
    {
      $set: {
        'variants.$.name': String(child.title || '').trim(),
        'variants.$.size': String(attrs.size || '').trim(),
        'variants.$.unit': String(attrs.unit || '').trim(),
        'variants.$.color': String(attrs.color || '').trim(),
        'variants.$.unitCount': String(attrs.unitCount || '').trim(),
        'variants.$.weight': String(attrs.weight || '').trim(),
        'variants.$.images': gallery,
        'variants.$.barcode': barcode,
        'variants.$.sku': sku,
        'variants.$.hsnCode': hsnCode,
        'variants.$.gstPercent': Number(child.gstPercent || 0),
        'variants.$.mrp': Number(child.mrp || 0),
        'variants.$.sellingPrice': Number(child.sellingPrice || 0),
        'variants.$.discountPercent': Number(child.discountPercent || 0),
        'variants.$.marginPrice': Number(child.marginPrice || 0),
        'variants.$.price': Number(child.price ?? child.sellingPrice ?? 0),
      },
    }
  );

  return result.modifiedCount > 0;
}
