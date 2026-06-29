/**
 * Inventory approval request — immutable snapshot after bucket submit.
 */

import mongoose from 'mongoose';
import { REQUEST_STATUSES } from '@/lib/shared/salesConstants';

const InventoryRequestLineSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    productTitle: { type: String, trim: true, default: '' },
    sku: { type: String, trim: true, default: '' },
    requestedQty: { type: Number, required: true, min: 1 },
    approvedQty: { type: Number, default: null, min: 0 },
    offeredRatePaise: { type: Number, required: true, min: 0 },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    listPricePaise: { type: Number, default: 0, min: 0 },
    maxDiscountPercent: { type: Number, default: 0, min: 0, max: 100 },
    notes: { type: String, trim: true, default: '' },
    stockAtSubmit: { type: Number, default: 0, min: 0 },
  },
  { _id: true }
);

const InventoryRequestSchema = new mongoose.Schema(
  {
    requestNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    bucketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SalesBucket',
      required: true,
      index: true,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SalesSession',
      required: true,
    },
    salesUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    salesUserName: { type: String, trim: true, default: '' },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
    },
    customerName: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: REQUEST_STATUSES,
      default: 'submitted',
      index: true,
    },
    lines: {
      type: [InventoryRequestLineSchema],
      default: [],
    },
    supervisorComment: { type: String, trim: true, default: '' },
    reviewedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedByName: { type: String, trim: true, default: '' },
    reviewedAt: { type: Date, default: null },
    submittedAt: { type: Date, default: () => new Date() },
    fulfilledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

InventoryRequestSchema.index({ status: 1, createdAt: -1 });
InventoryRequestSchema.index({ salesUserId: 1, createdAt: -1 });

if (mongoose.models.InventoryRequest) {
  delete mongoose.models.InventoryRequest;
}

export default mongoose.model('InventoryRequest', InventoryRequestSchema);
