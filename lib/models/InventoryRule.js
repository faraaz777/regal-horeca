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
    maxStock: { type: Number, required: true, min: 0 },
    reorderQty: { type: Number, required: true, min: 0 },
    deadStockPeriod: {
      type: String,
      enum: ['day', 'week', 'month', '3month', '6month'],
      required: true,
    },
    deadStockQty: { type: Number, required: true, min: 1 },
    /** Product-wide tag: slow sales / dead market. Does not block selling. */
    deadStockMarked: { type: Boolean, default: false },
    /**
     * When the tag flipped on (for ageing). Cleared when unmarked.
     * Missing on older rows until the next mark or automation backfill.
     */
    deadStockMarkedAt: { type: Date, default: null },
    /**
     * User cleared the tag — automation must not re-mark until velocity recovers
     * (or the user marks again).
     */
    deadStockManualClear: { type: Boolean, default: false },
    /**
     * When period/qty thresholds last changed. Grace wait uses this, then createdAt.
     */
    deadStockArmedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

if (mongoose.models.InventoryRule) delete mongoose.models.InventoryRule;

export default mongoose.model('InventoryRule', InventoryRuleSchema);
