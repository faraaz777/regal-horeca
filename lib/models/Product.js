/**
 * Product Model
 * 
 * Defines the schema for products in the catalog.
 * Products can have multiple images, color variants, specifications, and filters.
 */

import mongoose from 'mongoose';

const ProductSpecificationSchema = new mongoose.Schema({
  label: {
    type: String,
    required: true,
    trim: true,
  },
  value: {
    type: String,
    required: true,
    trim: true,
  },
  unit: {
    type: String,
    trim: true,
    default: '',
  },
}, { _id: false });

const ColorVariantSchema = new mongoose.Schema({
  colorName: {
    type: String,
    required: true,
    trim: true,
  },
  colorHex: {
    type: String,
    required: true,
    match: /^#[0-9A-Fa-f]{6}$/, // Valid hex color format
  },
  images: [{
    type: String,
    required: true,
  }],
}, { _id: false });

const ProductFiltersSchema = new mongoose.Schema({
  material: [{
    type: String,
    trim: true,
  }],
  color: [{
    type: String,
    trim: true,
  }],
  usage: [{
    type: String,
    trim: true,
  }],
}, { _id: false });

const ProductSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    index: true, // Indexed for search performance
  },
  slug: {
    type: String,
    required: false, // Auto-generated from title if not provided
    unique: true,
    lowercase: true,
    trim: true,
    index: true, // Indexed for URL lookups
  },
  summary: {
    type: String,
    trim: true,
    default: '',
  },
  description: {
    type: String,
    trim: true,
    default: '',
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: false, // Optional - can be set later (kept for backward compatibility)
    index: true, // Indexed for category filtering
  },
  categoryIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: false,
  }],
  businessTypeSlugs: [{
    type: String,
    trim: true,
  }],
  brand: {
    type: String,
    trim: true,
    default: '',
    index: true, // Indexed for brand filtering
  },
  brandCategoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Brand',
    required: false,
    index: true, // Indexed for brand category filtering
  },
  brandCategoryIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Brand',
    required: false,
  }],
  sku: {
    type: String,
    trim: true,
    default: '',
    index: true, // Indexed for SKU lookups
  },
  price: {
    type: Number,
    required: false, // Optional - can be set later
    default: 0,
    min: 0,
    index: true, // Indexed for price sorting
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true, // Normalize tags to lowercase
  }],
  heroImage: {
    type: String,
    required: true,
  },
  gallery: [{
    type: String,
  }],
  specifications: [ProductSpecificationSchema],
  colorVariants: [ColorVariantSchema],
  filters: {
    type: ProductFiltersSchema,
    default: () => ({
      material: [],
      color: [],
      usage: [],
    }),
  },
  relatedProductIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
  }],
  featured: {
    type: Boolean,
    default: false,
    index: true, // Indexed for featured product queries
  },
  status: {
    type: String,
    enum: ['In Stock', 'Out of Stock', 'Pre-Order'],
    default: 'In Stock',
    index: true, // Indexed for status filtering
  },
  isPremium: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Compound indexes for common query patterns
ProductSchema.index({ categoryId: 1, featured: 1 });
ProductSchema.index({ categoryIds: 1, featured: 1 });
ProductSchema.index({ businessTypeSlugs: 1, status: 1 });
ProductSchema.index({ title: 'text', brand: 'text', tags: 'text' }); // Text search index

// Virtual for getting category details (populated on demand)
ProductSchema.virtual('category', {
  ref: 'Category',
  localField: 'categoryId',
  foreignField: '_id',
  justOne: true,
});

// Pre-save middleware to generate slug if not provided
ProductSchema.pre('save', function(next) {
  if (!this.slug && this.title) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

// Static method to find products by category slug
ProductSchema.statics.findByCategorySlug = async function(categorySlug) {
  const Category = mongoose.model('Category');
  const category = await Category.findOne({ slug: categorySlug });
  if (!category) return [];
  
  // Get all subcategories recursively
  const getAllSubcategoryIds = async (parentId) => {
    const children = await Category.find({ parent: parentId });
    let ids = [parentId];
    for (const child of children) {
      ids = ids.concat(await getAllSubcategoryIds(child._id));
    }
    return ids;
  };
  
  const categoryIds = await getAllSubcategoryIds(category._id);
  return this.find({ 
    $or: [
      { categoryId: { $in: categoryIds } },
      { categoryIds: { $in: categoryIds } }
    ]
  });
};

// Export the model
const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);
export default Product;

