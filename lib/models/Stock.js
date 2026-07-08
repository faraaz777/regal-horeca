/**
 * Derived stock projection — recomputed from StockLedger inside a transaction.
 * Do not update these rows except via recomputeStockProjection().
 */

import mongoose from 'mongoose';
import { STATUS_BUCKETS } from '@/lib/shared/inventoryConstants';

const StockSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: true,
      index: true,
    },
    /** Denormalized cascade ids for Branch › Floor › Rack reporting. */
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      default: null,
      index: true,
    },
    floorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      default: null,
      index: true,
    },
    rackId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      default: null,
      index: true,
    },
    statusBucket: {
      type: String,
      enum: STATUS_BUCKETS,
      required: true,
    },
    qty: { type: Number, required: true, min: 0, default: 0 },
    lastLedgerAt: { type: Date, default: null },
  },
  { timestamps: true }
);

StockSchema.index({ productId: 1, locationId: 1, statusBucket: 1 }, { unique: true });
StockSchema.index({ branchId: 1, floorId: 1, rackId: 1 });

if (mongoose.models.Stock) delete mongoose.models.Stock;

export default mongoose.model('Stock', StockSchema);
