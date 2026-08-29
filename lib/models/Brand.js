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
  sortOrder: {
    type: Number,
    default: 0,
    index: true,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Index for parent-child relationships
BrandSchema.index({ parent: 1, level: 1 });
BrandSchema.index({ parent: 1, sortOrder: 1 });

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
// OPTIMIZED: Single DB query + in-memory tree build (matches Category.buildTree)
BrandSchema.statics.buildTree = async function(parentId = null) {
  const all = await this.find({})
    .select('name slug level parent image tagline sortOrder createdAt updatedAt')
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  const serialize = (brand) => ({
    ...brand,
    _id: brand._id?.toString ? brand._id.toString() : String(brand._id || ''),
    parent: brand.parent
      ? (brand.parent.toString ? brand.parent.toString() : String(brand.parent))
      : null,
    createdAt: brand.createdAt instanceof Date ? brand.createdAt.toISOString() : brand.createdAt,
    updatedAt: brand.updatedAt instanceof Date ? brand.updatedAt.toISOString() : brand.updatedAt,
  });

  const childrenByParent = new Map();
  for (const brand of all) {
    const pid = brand.parent ? (brand.parent.toString ? brand.parent.toString() : String(brand.parent)) : null;
    if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
    childrenByParent.get(pid).push(brand);
  }

  for (const [, arr] of childrenByParent) {
    arr.sort((a, b) => {
      const orderA = Number(a.sortOrder ?? 0);
      const orderB = Number(b.sortOrder ?? 0);
      if (orderA !== orderB) return orderA - orderB;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
  }

  const build = (pid) => {
    const kids = childrenByParent.get(pid) || [];
    return kids.map((brand) => {
      const node = serialize(brand);
      const children = build(node._id);
      return {
        ...node,
        children: children.length > 0 ? children : undefined,
      };
    });
  };

  const pid = parentId
    ? (parentId.toString ? parentId.toString() : String(parentId))
    : null;
  return build(pid);
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

