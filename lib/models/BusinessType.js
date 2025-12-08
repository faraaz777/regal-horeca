/**
 * Business Type Model
 * 
 * Defines the business types that products can serve (e.g., Cafe, Restaurant, Hotel).
 * Used for the "We Serve" feature in the catalog.
 */

import mongoose from 'mongoose';

const BusinessTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true, // Indexed for URL lookups
  },
  image: {
    type: String,
    required: false,
    default: '',
  },
  description: {
    type: String,
    trim: true,
    default: '',
  },
}, {
  timestamps: true,
});

// Pre-save middleware to generate slug if not provided
BusinessTypeSchema.pre('save', function(next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

// Export the model
const BusinessType = mongoose.models.BusinessType || mongoose.model('BusinessType', BusinessTypeSchema);
export default BusinessType;

