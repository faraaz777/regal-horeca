/**
 * Enquiry Model
 * 
 * Defines the schema for customer enquiries submitted through the enquiry form.
 */

import mongoose from 'mongoose';

const EnquirySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  company: {
    type: String,
    trim: true,
    default: '',
  },
  categories: [{
    type: String,
    trim: true,
  }],
  message: {
    type: String,
    trim: true,
    default: '',
  },
  cartItems: [{
    productId: {
      type: String,
      required: true,
    },
    productName: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
  }],
  status: {
    type: String,
    enum: ['new', 'contacted', 'resolved', 'closed'],
    default: 'new',
  },
  notes: {
    type: String,
    trim: true,
    default: '',
  },
}, {
  timestamps: true, // Adds createdAt and updatedAt fields
});

// Index for faster queries
EnquirySchema.index({ createdAt: -1 });
EnquirySchema.index({ status: 1 });
EnquirySchema.index({ email: 1 });

const Enquiry = mongoose.models.Enquiry || mongoose.model('Enquiry', EnquirySchema);

export default Enquiry;

