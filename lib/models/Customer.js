/**
 * Customer Model
 * 
 * Defines the schema for customers who submit enquiries.
 * Used to avoid duplicate info when the same person enquires multiple times.
 */

import mongoose from 'mongoose';
import { normalizePhone } from '@/lib/utils/phone';

const CustomerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  companyName: {
    type: String,
    trim: true,
    default: '',
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    index: true,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
  }],
}, {
  timestamps: true, // Adds createdAt and updatedAt fields
});

// Compound index for finding customers by email or phone
CustomerSchema.index({ email: 1, phone: 1 });

// Static method to find or create customer
CustomerSchema.statics.findOrCreate = async function(customerData) {
  const { email, phone, name, companyName } = customerData;
  
  // Normalize phone number for consistent matching
  const normalizedPhone = normalizePhone(phone);
  
  // Build search query - prioritize phone matching
  const searchQuery = {};
  if (normalizedPhone) {
    searchQuery.phone = normalizedPhone;
  } else if (email) {
    searchQuery.email = email.toLowerCase();
  } else {
    // If no phone or email, can't find/create customer
    return null;
  }
  
  // Try to find existing customer by normalized phone or email
  let customer = await this.findOne(searchQuery);

  if (!customer) {
    // Create new customer with normalized phone
    customer = new this({
      name: name || 'Guest User',
      companyName: companyName || '',
      email: email?.toLowerCase() || `${normalizedPhone}@temp.regal-horeca.com`,
      phone: normalizedPhone,
      tags: [],
    });
    await customer.save();
  } else {
    // Update existing customer info if needed
    let updated = false;
    if (name && customer.name !== name && customer.name === 'Guest User') {
      customer.name = name;
      updated = true;
    }
    if (companyName && customer.companyName !== companyName) {
      customer.companyName = companyName;
      updated = true;
    }
    // Update email if it was a temp email and now we have a real one
    if (email && customer.email?.includes('@temp.regal-horeca.com') && !email.includes('@temp.regal-horeca.com')) {
      customer.email = email.toLowerCase();
      updated = true;
    }
    // Ensure phone is normalized
    if (customer.phone !== normalizedPhone && normalizedPhone) {
      customer.phone = normalizedPhone;
      updated = true;
    }
    if (updated) {
      await customer.save();
    }
  }

  return customer;
};

const Customer = mongoose.models.Customer || mongoose.model('Customer', CustomerSchema);

export default Customer;

