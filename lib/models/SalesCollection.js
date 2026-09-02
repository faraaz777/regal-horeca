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

/**
 * Instagram-style hotspots on one table-setup photo.
 * Coordinates are percent of the rendered image content box (object-contain), not pixels.
 * Kept separate from `items` so the product list stays the source of truth.
 */
const PresentationPinSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    xPct: { type: Number, min: 0, max: 100, required: true },
    yPct: { type: Number, min: 0, max: 100, required: true },
  },
  { _id: true }
);

const PresentationSceneSchema = new mongoose.Schema(
  {
    imageUrl: { type: String, trim: true, required: true },
    pins: { type: [PresentationPinSchema], default: [] },
  },
  { _id: true }
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
    /**
     * Gallery of table-setup photos. Cover `thumbnailUrl` stays for list cards.
     * `imageUrl` / `pins` are v1 leftovers — migrated into `scenes` on write.
     * Capped in application code (MAX_PRESENTATION_SCENES).
     */
    presentationSet: {
      scenes: { type: [PresentationSceneSchema], default: [] },
      imageUrl: { type: String, trim: true, default: '' },
      pins: { type: [PresentationPinSchema], default: [] },
    },
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
