/**
 * EnquiryItem Model
 * 
 * Defines the schema for products in an enquiry (cart snapshot).
 * Denormalized product info in case product name changes later.
 */

import mongoose from 'mongoose';

const EnquiryItemSchema = new mongoose.Schema({
  enquiryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Enquiry',
    required: true,
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  productName: {
    type: String,
    required: true,
    trim: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  notes: {
    type: String,
    trim: true,
    default: '',
  },
}, {
  timestamps: true,
});

// Index for faster queries
EnquiryItemSchema.index({ enquiryId: 1 });

const EnquiryItem = mongoose.models.EnquiryItem || mongoose.model('EnquiryItem', EnquiryItemSchema);

export default EnquiryItem;

