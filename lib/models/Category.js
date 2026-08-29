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
CategorySchema.index({ parent: 1, level: 1 });
CategorySchema.index({ parent: 1, sortOrder: 1 });

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
// OPTIMIZED: Single DB query + in-memory tree build (avoids N+1 recursion queries)
// Returns plain objects suitable for Client Components.
CategorySchema.statics.buildTree = async function(parentId = null) {
  const all = await this.find({})
    .select('name slug level parent image tagline sortOrder createdAt updatedAt')
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  const serialize = (category) => ({
    ...category,
    _id: category._id?.toString ? category._id.toString() : String(category._id || ''),
    parent: category.parent
      ? (category.parent.toString ? category.parent.toString() : String(category.parent))
      : null,
    createdAt: category.createdAt instanceof Date ? category.createdAt.toISOString() : category.createdAt,
    updatedAt: category.updatedAt instanceof Date ? category.updatedAt.toISOString() : category.updatedAt,
  });

  // Group by parent (string) for quick lookup.
  const childrenByParent = new Map();
  for (const cat of all) {
    const pid = cat.parent ? (cat.parent.toString ? cat.parent.toString() : String(cat.parent)) : null;
    if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
    childrenByParent.get(pid).push(cat);
  }

  // Ensure sibling order is stable (sortOrder asc, then name asc).
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
    return kids.map((cat) => {
      const node = serialize(cat);
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

