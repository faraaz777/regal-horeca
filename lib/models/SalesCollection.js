/**
 * Personal product collections for sales staff — curated lists across sessions.
 */

import mongoose from 'mongoose';

const SalesCollectionItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    sortOrder: { type: Number, default: 0 },
    note: { type: String, trim: true, default: '' },
    suggestedQty: { type: Number, min: 1, default: 1 },
  },
  { _id: false }
);

const SalesCollectionSchema = new mongoose.Schema(
  {
    salesUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, default: '', maxlength: 500 },
    thumbnailUrl: { type: String, trim: true, default: '' },
    pinned: { type: Boolean, default: false },
    items: {
      type: [SalesCollectionItemSchema],
      default: [],
    },
  },
  { timestamps: true }
);

SalesCollectionSchema.index({ salesUserId: 1, updatedAt: -1 });

if (mongoose.models.SalesCollection) {
  delete mongoose.models.SalesCollection;
}

export default mongoose.model('SalesCollection', SalesCollectionSchema);
