/**
 * Customer Model
 * 
 * Defines the schema for customers who submit enquiries.
 * Used to avoid duplicate info when the same person enquires multiple times.
 */

import mongoose from 'mongoose';

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
  
  // Try to find existing customer by email or phone
  let customer = await this.findOne({
    $or: [
      { email: email?.toLowerCase() },
      { phone: phone }
    ]
  });

  if (!customer) {
    // Create new customer
    customer = new this({
      name,
      companyName: companyName || '',
      email: email?.toLowerCase(),
      phone,
      tags: [],
    });
    await customer.save();
  } else {
    // Update existing customer info if needed
    let updated = false;
    if (name && customer.name !== name) {
      customer.name = name;
      updated = true;
    }
    if (companyName && customer.companyName !== companyName) {
      customer.companyName = companyName;
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

