/**
 * ProductLink
 *
 * One undirected mapping between two sellable SKUs.
 *
 * productA / productB are stored in sorted id order so the pair is unique.
 * Price and stock are not stored here — readers join live MRP, selling
 * price and sellable quantity when the mapping is opened.
 */

import mongoose from 'mongoose';
import { PRODUCT_LINK_NOTE_MAX } from '@/lib/shared/productLink';

/**
 * Drop the cached model so schema changes (type/visibility removed)
 * take effect on hot reload without a full process restart.
 */
if (mongoose.models.ProductLink) {
  delete mongoose.models.ProductLink;
}

const ProductLinkSchema = new mongoose.Schema(
  {
    productA: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    productB: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    note: {
      type: String,
      trim: true,
      default: '',
      maxlength: PRODUCT_LINK_NOTE_MAX,
    },
    createdBy: {
      type: String,
      default: '',
    },
  },
  { timestamps: true, strict: false }
);

ProductLinkSchema.index({ productA: 1, productB: 1 }, { unique: true });

const ProductLink = mongoose.models.ProductLink || mongoose.model('ProductLink', ProductLinkSchema);
export default ProductLink;
