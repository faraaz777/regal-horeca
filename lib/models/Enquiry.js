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
  state: {
    type: String,
    trim: true,
    default: '',
  },
  
  // Enquiry details
  source: {
    type: String,
    enum: ['website-form', 'whom-we-serve', 'product-card', 'product-detail', 'cart', 'whatsapp', 'phone', 'email', 'manual'],
    default: 'website-form',
  },
  type: {
    type: String,
    enum: ['cart + enquiry', 'enquiry only'],
    default: 'enquiry only',
  },
  userType: {
    type: String,
    enum: ['business', 'customer', 'unknown'],
    default: 'unknown',
    // Index defined below with schema.index()
  },
  enquiryId: {
    type: String,
    unique: true, // unique: true automatically creates an index
    sparse: true, // Allow null values but ensure uniqueness when present
    trim: true,
    // Index defined below with schema.index()
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

// Pre-save middleware to generate enquiryId if not provided
EnquirySchema.pre('save', async function(next) {
  if (!this.enquiryId) {
    // Generate enquiryId: ENQ-{timestamp}-{random}
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.enquiryId = `ENQ-${timestamp}-${random}`;
  }
  next();
});

// Indexes for faster queries
EnquirySchema.index({ createdAt: -1 });
EnquirySchema.index({ status: 1 });
EnquirySchema.index({ customerId: 1 });
EnquirySchema.index({ email: 1 });
EnquirySchema.index({ assignedTo: 1 });
EnquirySchema.index({ priority: 1 });
EnquirySchema.index({ userType: 1 });
// enquiryId index is automatically created by unique: true, no need to define separately

// Virtual to get customer details
EnquirySchema.virtual('customer', {
  ref: 'Customer',
  localField: 'customerId',
  foreignField: '_id',
  justOne: true,
});

const Enquiry = mongoose.models.Enquiry || mongoose.model('Enquiry', EnquirySchema);

export default Enquiry;

