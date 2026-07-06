/**
 * Append-only stock movement ledger.
 * Stock summary rows are always derived from this collection — never edited directly.
 */

import mongoose from 'mongoose';
import {
  LEDGER_TYPES,
  STATUS_BUCKETS,
  OPENING_REASONS,
  MOVEMENT_REASONS,
} from '@/lib/shared/inventoryConstants';

const LEDGER_REASONS = [...OPENING_REASONS, ...MOVEMENT_REASONS, 'transfer'];

const StockLedgerSchema = new mongoose.Schema(
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
    type: {
      type: String,
      enum: LEDGER_TYPES,
      required: true,
    },
    statusBucket: {
      type: String,
      enum: STATUS_BUCKETS,
      required: true,
    },
    /** Signed quantity — positive increases bucket qty, negative decreases. */
    qty: { type: Number, required: true },
    reason: {
      type: String,
      enum: LEDGER_REASONS,
      default: 'manual_adjustment',
    },
    remark: { type: String, trim: true, default: '' },
    /** External reference — PO number, request number, etc. */
    ref: { type: String, trim: true, default: '' },
    /** Purchase / opening rate in paise (optional except when reason = purchase). */
    ratePaise: { type: Number, min: 0, default: null },
    /** Opening/intake flag — not selling up to the dead-stock target. Stock stays sellable. */
    deadStockMarked: { type: Boolean, default: false },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

StockLedgerSchema.index({ productId: 1, createdAt: 1 });
StockLedgerSchema.index({ productId: 1, locationId: 1, statusBucket: 1 });
StockLedgerSchema.index({ locationId: 1, createdAt: -1 });
StockLedgerSchema.index({ ref: 1 });

if (mongoose.models.StockLedger) delete mongoose.models.StockLedger;

export default mongoose.model('StockLedger', StockLedgerSchema);
