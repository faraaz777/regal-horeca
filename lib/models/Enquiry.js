/**
 * Enquiry Model
 * 
 * Defines the schema for customer enquiries submitted through the enquiry form.
 * Enhanced with CRM features: customer linking, status tracking, priority, assignment.
 */

import mongoose from 'mongoose';

const EnquirySchema = new mongoose.Schema({
  // Customer relationship (new CRM structure)
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: false, // Optional for backward compatibility
    index: true,
  },
  
  // Legacy fields (kept for backward compatibility)
  name: {
    type: String,
    required: false, // Not required if customerId is provided
    trim: true,
  },
  email: {
    type: String,
    required: false, // Not required if customerId is provided
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
  },
  phone: {
    type: String,
    required: false, // Not required if customerId is provided
    trim: true,
  },
  company: {
    type: String,
    trim: true,
    default: '',
  },
  
  // Enquiry details
  source: {
    type: String,
    enum: ['website-form', 'whatsapp', 'phone', 'email', 'manual'],
    default: 'website-form',
  },
  type: {
    type: String,
    enum: ['cart + enquiry', 'enquiry only'],
    default: 'enquiry only',
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
  
  // Legacy cartItems (kept for backward compatibility)
  // New structure uses EnquiryItem model
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
  
  // CRM fields
  status: {
    type: String,
    enum: ['new', 'in-progress', 'awaiting-customer', 'closed', 'spam'],
    default: 'new',
    index: true,
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high'],
    default: 'normal',
  },
  assignedTo: {
    type: String,
    trim: true,
    default: '', // Admin email/name who is handling this enquiry
  },
  notes: {
    type: String,
    trim: true,
    default: '',
  },
}, {
  timestamps: true, // Adds createdAt and updatedAt fields
});

// Indexes for faster queries
EnquirySchema.index({ createdAt: -1 });
EnquirySchema.index({ status: 1 });
EnquirySchema.index({ customerId: 1 });
EnquirySchema.index({ email: 1 });
EnquirySchema.index({ assignedTo: 1 });
EnquirySchema.index({ priority: 1 });

// Virtual to get customer details
EnquirySchema.virtual('customer', {
  ref: 'Customer',
  localField: 'customerId',
  foreignField: '_id',
  justOne: true,
});

const Enquiry = mongoose.models.Enquiry || mongoose.model('Enquiry', EnquirySchema);

export default Enquiry;

