import 'server-only';

import Product from '@/lib/models/Product';
import { normalizeBarcode } from '@/lib/server/products/barcodeValidation';

/**
 * Remove a legacy embedded variant row from the parent when its child is soft-deleted.
 *
 * @param {string} parentId
 * @param {{ legacyParentVariantId?: string, barcode?: string }} match
 */
export async function removeEmbeddedVariantFromParent(parentId, match) {
  if (!parentId) return false;

  const legacyId = String(
    typeof match === 'string' ? match : match?.legacyParentVariantId || ''
  ).trim();
  const barcode = normalizeBarcode(
    typeof match === 'object' && match !== null ? match?.barcode : ''
  );

  if (legacyId) {
    const result = await Product.updateOne(
      { _id: parentId },
      { $pull: { variants: { variantId: legacyId } } }
    );
    if (result.modifiedCount > 0) return true;
  }

  if (barcode) {
    const result = await Product.updateOne(
      { _id: parentId },
      { $pull: { variants: { barcode } } }
    );
    return result.modifiedCount > 0;
  }

  return false;
}
