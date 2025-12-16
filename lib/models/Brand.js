/**
 * Brand Model
 * 
 * Defines the hierarchical brand structure for products.
 * Brands can have multiple levels: department -> category -> subcategory
 */

import mongoose from 'mongoose';

const BrandSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true, // Indexed for URL lookups
  },
  level: {
    type: String,
    enum: ['department', 'category', 'subcategory'],
    required: true,
    index: true, // Indexed for level filtering
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Brand',
    default: null,
    index: true, // Indexed for parent-child queries
  },
  image: {
    type: String,
    default: '',
  },
  tagline: {
    type: String,
    trim: true,
    default: '',
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Index for parent-child relationships
BrandSchema.index({ parent: 1, level: 1 });

// Virtual for getting children brands
BrandSchema.virtual('children', {
  ref: 'Brand',
  localField: '_id',
  foreignField: 'parent',
  justOne: false,
});

// Virtual for getting parent brand
BrandSchema.virtual('parentBrand', {
  ref: 'Brand',
  localField: 'parent',
  foreignField: '_id',
  justOne: true,
});

// Static method to build brand tree
BrandSchema.statics.buildTree = async function(parentId = null) {
  const brands = await this.find({ parent: parentId }).sort({ name: 1 });
  const tree = [];
  
  for (const brand of brands) {
    const children = await this.buildTree(brand._id);
    tree.push({
      ...brand.toObject(),
      children: children.length > 0 ? children : undefined,
    });
  }
  
  return tree;
};

// Static method to get brand ancestry (all parents)
BrandSchema.statics.getAncestry = async function(brandId) {
  const ancestry = {};
  let current = await this.findById(brandId);
  
  while (current) {
    ancestry[current.level] = current._id;
    if (current.parent) {
      current = await this.findById(current.parent);
    } else {
      break;
    }
  }
  
  return ancestry;
};

// Pre-save middleware to generate slug if not provided
BrandSchema.pre('save', function(next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

// Export the model
const Brand = mongoose.models.Brand || mongoose.model('Brand', BrandSchema);
export default Brand;

