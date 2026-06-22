/**
 * Auditable ledger for every stock movement.
 */

import mongoose from 'mongoose';

const TRANSACTION_TYPES = [
  'adjustment_add',
  'adjustment_minus',
  'transfer_out',
  'transfer_in',
  'condition_change',
  'initial',
];

const InventoryTransactionSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: TRANSACTION_TYPES,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    fromLocationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      default: null,
    },
    toLocationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      default: null,
    },
    previousSellableQty: { type: Number, default: 0 },
    newSellableQty: { type: Number, default: 0 },
    previousCondition: { type: String, default: null },
    newCondition: { type: String, default: null },
    note: { type: String, trim: true, default: '' },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

InventoryTransactionSchema.index({ createdAt: -1 });
InventoryTransactionSchema.index({ productId: 1, createdAt: -1 });

export { TRANSACTION_TYPES };

if (mongoose.models.InventoryTransaction) {
  delete mongoose.models.InventoryTransaction;
}

const InventoryTransaction = mongoose.model('InventoryTransaction', InventoryTransactionSchema);

export default InventoryTransaction;
