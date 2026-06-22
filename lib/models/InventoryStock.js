/**
 * Current stock snapshot per product (and optional location).
 * Sellable qty is the live projection; hold/damage change condition, not sellable qty.
 */

import mongoose from 'mongoose';

const STOCK_CONDITIONS = ['normal', 'hold', 'damaged', 'dead'];

const InventoryStockSchema = new mongoose.Schema(
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
      default: null,
      index: true,
    },
    sellableQty: {
      type: Number,
      default: 0,
      min: 0,
    },
    holdQty: {
      type: Number,
      default: 0,
      min: 0,
    },
    damagedQty: {
      type: Number,
      default: 0,
      min: 0,
    },
    condition: {
      type: String,
      enum: STOCK_CONDITIONS,
      default: 'normal',
    },
    lowStockThreshold: {
      type: Number,
      default: 10,
      min: 0,
    },
  },
  { timestamps: true }
);

InventoryStockSchema.index({ productId: 1, locationId: 1 }, { unique: true });

export { STOCK_CONDITIONS };

if (mongoose.models.InventoryStock) {
  delete mongoose.models.InventoryStock;
}

const InventoryStock = mongoose.model('InventoryStock', InventoryStockSchema);

export default InventoryStock;
