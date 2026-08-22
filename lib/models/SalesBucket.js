/**
 * Draft customer quote bucket — editable until submitted.
 */

import mongoose from 'mongoose';
import { BUCKET_STATUSES } from '@/lib/shared/salesConstants';

const SalesBucketLineSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    productTitle: { type: String, trim: true, default: '' },
    sku: { type: String, trim: true, default: '' },
    /** Snapshot at add time so the quote panel does not refetch products. */
    heroImage: { type: String, trim: true, default: '' },
    quantity: { type: Number, required: true, min: 1 },
    /** Offered unit rate in paise. */
    offeredRatePaise: { type: Number, required: true, min: 0 },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    listPricePaise: { type: Number, default: 0, min: 0 },
    /** Snapshot of MAX DISCOUNT % at quote time. Floor = MRP × (1 − this), capped at selling. */
    maxDiscountPercent: { type: Number, default: 0, min: 0, max: 100 },
    /** Owner-only leftover — not used to validate offers. */
    marginPricePaise: { type: Number, default: 0, min: 0 },
    /** Lowest allowed offer in paise, derived from list + max discount. */
    minOfferPricePaise: { type: Number, default: 0, min: 0 },
    notes: { type: String, trim: true, default: '' },
  },
  { _id: true }
);

const SalesBucketSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SalesSession',
      required: true,
      index: true,
    },
    salesUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    displayNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: BUCKET_STATUSES,
      default: 'draft',
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
    },
    customerName: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    lines: {
      type: [SalesBucketLineSchema],
      default: [],
    },
    submittedAt: { type: Date, default: null },
    inventoryRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryRequest',
      default: null,
    },
  },
  { timestamps: true }
);

SalesBucketSchema.index({ sessionId: 1, displayNumber: 1 }, { unique: true });

if (mongoose.models.SalesBucket) {
  delete mongoose.models.SalesBucket;
}

export default mongoose.model('SalesBucket', SalesBucketSchema);
