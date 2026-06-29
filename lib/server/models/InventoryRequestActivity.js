/**
 * Inventory request timeline — submit, approve, reject, fulfill.
 */

import mongoose from 'mongoose';

const InventoryRequestActivitySchema = new mongoose.Schema(
  {
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryRequest',
      required: true,
      index: true,
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String, trim: true, default: '' },
    action: { type: String, required: true, trim: true },
    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

InventoryRequestActivitySchema.index({ requestId: 1, createdAt: -1 });

if (mongoose.models.InventoryRequestActivity) {
  delete mongoose.models.InventoryRequestActivity;
}

export default mongoose.model('InventoryRequestActivity', InventoryRequestActivitySchema);
