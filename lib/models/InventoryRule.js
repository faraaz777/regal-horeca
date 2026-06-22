/**
 * Per-product reorder / dead-stock rules set at first inventory intake.
 * One document per product — created with the opening stock gate.
 */

import mongoose from 'mongoose';

const InventoryRuleSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      unique: true,
      index: true,
    },
    minStock: { type: Number, required: true, min: 0 },
    reorderQty: { type: Number, required: true, min: 0 },
    deadStockDays: { type: Number, required: true, min: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

if (mongoose.models.InventoryRule) delete mongoose.models.InventoryRule;

export default mongoose.model('InventoryRule', InventoryRuleSchema);
