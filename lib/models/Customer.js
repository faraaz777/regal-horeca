/**
 * Customer
 *
 * Permanent identity for a person or hotel. Created only when a real
 * phone or email exists. Sales buckets and website enquiries link here.
 *
 * Does not invent temp emails or placeholder phones.
 */

import mongoose from 'mongoose';
import {
  isPlaceholderName,
  isRealEmail,
  isRealPhone,
  normalizeCustomerIdentity,
} from '@/lib/shared/customerIdentity';

const CustomerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: '',
    },
    companyName: {
      type: String,
      trim: true,
      default: '',
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
      index: true,
      validate: {
        validator(value) {
          if (!value) return true;
          return /^\S+@\S+\.\S+$/.test(value);
        },
        message: 'Please provide a valid email address',
      },
    },
    phone: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
  },
  {
    timestamps: true,
  }
);

CustomerSchema.index({ email: 1, phone: 1 });

/**
 * Find by phone (preferred) or email. Create only when identity exists.
 */
CustomerSchema.statics.findOrCreate = async function findOrCreate(customerData) {
  const identity = normalizeCustomerIdentity(customerData);
  if (!identity.hasIdentity) return null;

  const searchQuery = identity.phone
    ? { phone: identity.phone }
    : { email: identity.email };

  let customer = await this.findOne(searchQuery);

  if (!customer) {
    customer = new this({
      name: identity.name,
      companyName: identity.companyName,
      email: identity.email,
      phone: identity.phone,
      tags: [],
    });
    await customer.save();
    return customer;
  }

  let updated = false;

  if (identity.name && customer.name !== identity.name && isPlaceholderName(customer.name)) {
    customer.name = identity.name;
    updated = true;
  }

  if (identity.companyName && customer.companyName !== identity.companyName) {
    customer.companyName = identity.companyName;
    updated = true;
  }

  if (identity.email && customer.email !== identity.email && !isRealEmail(customer.email)) {
    customer.email = identity.email;
    updated = true;
  }

  if (identity.phone && customer.phone !== identity.phone && !isRealPhone(customer.phone)) {
    customer.phone = identity.phone;
    updated = true;
  }

  if (updated) {
    await customer.save();
  }

  return customer;
};

const Customer = mongoose.models.Customer || mongoose.model('Customer', CustomerSchema);

export default Customer;
