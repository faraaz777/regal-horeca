/**
 * InventoryStockRule
 *
 * Global inventory settings (key/value).
 * Currently used for: defaultLowStockThreshold.
 *
 * Per-product thresholds live on InventoryRule.minStock — not here.
 */

import mongoose from 'mongoose';

const InventoryStockRuleSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

if (mongoose.models.InventoryStockRule) {
  delete mongoose.models.InventoryStockRule;
}

const InventoryStockRule = mongoose.model('InventoryStockRule', InventoryStockRuleSchema);

export default InventoryStockRule;
