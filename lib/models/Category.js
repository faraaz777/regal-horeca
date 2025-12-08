/**
 * Category Model
 * 
 * Defines the hierarchical category structure for products.
 * Categories can have multiple levels: department -> category -> subcategory -> type
 */

import mongoose from 'mongoose';

const CategorySchema = new mongoose.Schema({
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
    enum: ['department', 'category', 'subcategory', 'type'],
    required: true,
    index: true, // Indexed for level filtering
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
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
CategorySchema.index({ parent: 1, level: 1 });

// Virtual for getting children categories
CategorySchema.virtual('children', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parent',
  justOne: false,
});

// Virtual for getting parent category
CategorySchema.virtual('parentCategory', {
  ref: 'Category',
  localField: 'parent',
  foreignField: '_id',
  justOne: true,
});

// Static method to build category tree
CategorySchema.statics.buildTree = async function(parentId = null) {
  const categories = await this.find({ parent: parentId }).sort({ name: 1 });
  const tree = [];
  
  for (const category of categories) {
    const children = await this.buildTree(category._id);
    tree.push({
      ...category.toObject(),
      children: children.length > 0 ? children : undefined,
    });
  }
  
  return tree;
};

// Static method to get category ancestry (all parents)
CategorySchema.statics.getAncestry = async function(categoryId) {
  const ancestry = {};
  let current = await this.findById(categoryId);
  
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
CategorySchema.pre('save', function(next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

// Export the model
const Category = mongoose.models.Category || mongoose.model('Category', CategorySchema);
export default Category;

