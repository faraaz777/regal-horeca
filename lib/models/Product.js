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

const ProductPriceBySizeSchema = new mongoose.Schema({
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  size: {
    type: String,
    trim: true,
    default: '',
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
  isDefault: {
    type: Boolean,
    default: false, // Only one color variant should have isDefault: true
  },
}, { _id: false });

const ProductFilterSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    trim: true,
  },
  values: [{
    type: String,
    trim: true,
  }],
}, { _id: false });

const ProductFaqSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
    trim: true,
  },
  answer: {
    type: String,
    required: true,
    trim: true,
  },
}, { _id: false });

const ProductTestimonialSchema = new mongoose.Schema({
  quote: {
    type: String,
    required: true,
    trim: true,
  },
  authorName: {
    type: String,
    trim: true,
    default: '',
  },
  authorRole: {
    type: String,
    trim: true,
    default: '',
  },
  companyName: {
    type: String,
    trim: true,
    default: '',
  },
  companyLogo: {
    type: String,
    trim: true,
    default: '',
  },
}, { _id: false });

const ProductGeneratedVariantSchema = new mongoose.Schema({
  /** Stable id for cart, quotes, and APIs (assigned in admin when missing). */
  variantId: {
    type: String,
    trim: true,
    default: '',
  },
  name: {
    type: String,
    trim: true,
    default: '',
  },
  size: {
    type: String,
    trim: true,
    default: '',
  },
  /** Selling / packaging unit (e.g. kg, pc, set), same idea as price-by-size unit. */
  unit: {
    type: String,
    trim: true,
    default: '',
  },
  color: {
    type: String,
    trim: true,
    default: '',
  },
  unitCount: {
    type: String,
    trim: true,
    default: '',
  },
  weight: {
    type: String,
    trim: true,
    default: '',
  },
  isDefault: {
    type: Boolean,
    default: false,
  },
  images: [{
    type: String,
    trim: true,
  }],
  sku: {
    type: String,
    trim: true,
    default: '',
  },
  barcode: {
    type: String,
    trim: true,
    default: '',
  },
  hsnCode: {
    type: String,
    trim: true,
    default: '',
  },
  gstPercent: {
    type: Number,
    min: 0,
    default: 0,
  },
  mrp: {
    type: Number,
    min: 0,
    default: 0,
  },
  sellingPrice: {
    type: Number,
    min: 0,
    default: 0,
  },
  discountPercent: {
    type: Number,
    min: 0,
    default: 0,
  },
  marginPrice: {
    type: Number,
    min: 0,
    default: 0,
  },
  price: {
    type: Number,
    min: 0,
    default: 0,
  },
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
    lowercase: true,
    trim: true,
    // Indexing: see `slug_unique_active` partial index (unique among non-deleted rows)
  },
  /** Canonical slug before soft-delete archived the URL (used on restore). */
  previousSlug: {
    type: String,
    lowercase: true,
    trim: true,
    default: null,
  },
  deletedAt: {
    type: Date,
    default: null,
    index: true,
  },
  // Parent/child variant relationship (Amazon-style).
  // - 'standalone': normal product (no variants). Today's default and back-compat shape.
  // - 'parent':     hidden carrier; non-buyable on storefront. Owns shared catalog content.
  // - 'child':      a real variant with its own slug, pricing, SKU, and per-row visibility.
  productType: {
    type: String,
    enum: ['standalone', 'parent', 'child'],
    default: 'standalone',
    index: true,
  },
  parentProductId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    default: null,
    index: true,
  },
  // Variation theme drives PDP swatch pickers (e.g. ['size','color']).
  variationTheme: {
    type: [String],
    default: [],
  },
  // Per-child override values used by storefront filters and PDP labels.
  variationAttributes: {
    size: { type: String, default: '' },
    color: { type: String, default: '' },
    weight: { type: String, default: '' },
    unitCount: { type: String, default: '' },
  },
  // Per-row client visibility. Parents are forced-hidden; children/standalones honor this flag.
  visibleOnClient: {
    type: Boolean,
    default: true,
    index: true,
  },
  // Child-only: when true, this variant also appears as its own product card in the
  // storefront catalog. PDP variant pickers list all non-deleted children regardless.
  showInCatalog: {
    type: Boolean,
  },
  // Child the parent prefers to show (PDP redirect target, default catalog card swatch).
  defaultChildProductId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    default: null,
  },
  // Legacy embedded variant.variantId, copied onto migrated children so old localStorage
  // cart entries can be resolved to the new child product without losing the line.
  legacyParentVariantId: {
    type: String,
    default: '',
    index: true,
  },
  // Denormalized text used by the unified text index. Built at write time as
  // [parent.title, parent.brand, parent.sku, child.sku, attrs...].join(' ').
  searchBlob: {
    type: String,
    default: '',
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
  usageAndCare: {
    type: String,
    trim: true,
    default: '',
  },
  whyBuyFrom: {
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
  manufacturer: {
    type: String,
    trim: true,
    default: '',
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
  },
  barcode: {
    type: String,
    trim: true,
    default: '',
  },
  hsnCode: {
    type: String,
    trim: true,
    default: '',
  },
  /** Per-product (and per-child variant row) pricing breakdown — used by admin + storefront. */
  gstPercent: {
    type: Number,
    min: 0,
    default: 0,
  },
  mrp: {
    type: Number,
    min: 0,
    default: 0,
  },
  sellingPrice: {
    type: Number,
    min: 0,
    default: 0,
  },
  discountPercent: {
    type: Number,
    min: 0,
    default: 0,
  },
  marginPrice: {
    type: Number,
    min: 0,
    default: 0,
  },
  price: {
    type: Number,
    required: false, // Optional - can be set later
    default: 0,
    min: 0,
    index: true, // Indexed for price sorting
  },
  priceBySize: {
    type: [ProductPriceBySizeSchema],
    default: [],
  },
  originalPrice: {
    type: Number,
    required: false,
    default: null,
    min: 0,
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true, // Normalize tags to lowercase
  }],
  heroImage: {
    type: String,
    // Children fall back to the parent's heroImage at resolve time, so they may have none of their own.
    required: function () {
      return this.productType !== 'child';
    },
  },
  gallery: [{
    type: String,
  }],
  variants: {
    type: [ProductGeneratedVariantSchema],
    default: [],
  },
  specifications: [ProductSpecificationSchema],
  colorVariants: [ColorVariantSchema],
  filters: [ProductFilterSchema],
  faqs: {
    type: [ProductFaqSchema],
    default: [],
  },
  testimonials: {
    type: [ProductTestimonialSchema],
    default: [],
  },
  detailPhotos: {
    type: [String],
    default: [],
  },
  frequentlyOrderedTogetherProductIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
  }],
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
  availableSizes: {
    type: String,
    trim: true,
    default: '', // Optional field for comma-separated sizes (e.g., "22,24,26,28,30")
  },
  sizeChartUrl: {
    type: String,
    trim: true,
    default: '',
  },
  brochureUrl: {
    type: String,
    trim: true,
    default: '',
  },
  blogUrl: {
    type: String,
    trim: true,
    default: '',
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
ProductSchema.index({ featured: 1, status: 1 });
ProductSchema.index({ status: 1, createdAt: -1 });
ProductSchema.index({ categoryIds: 1, featured: 1, status: 1 });
ProductSchema.index({ businessTypeSlugs: 1, status: 1, createdAt: -1 });
// Text search index with weighted fields for better relevance.
// MongoDB allows only ONE text index per collection — children carry a denormalized
// `searchBlob` (built at write time) so admin search hits parents, children, and
// standalones in a single pass.
//
// IMPORTANT: SKU/barcode/HSN are alphanumeric codes that don't tokenize well under
// MongoDB's text index — `$text` only matches whole tokens (with stemming), so
// "5567" will NOT find SKU "556771". The query layer (queryProducts.js) layers a
// case-insensitive regex search across these fields on top of `$text` so admins
// get the partial-match behavior they expect from a SKU/barcode lookup.
//
// If an old `text_search_index` exists in production with a different field set,
// drop it before redeploy: db.products.dropIndex("text_search_index").
ProductSchema.index(
  {
    title: 'text',
    brand: 'text',
    sku: 'text',
    barcode: 'text',
    hsnCode: 'text',
    description: 'text',
    tags: 'text',
    searchBlob: 'text',
  },
  {
    weights: {
      title: 10,
      sku: 8,
      barcode: 8,
      hsnCode: 7,
      searchBlob: 6,
      brand: 5,
      description: 2,
      tags: 1,
    },
    name: 'text_search_index',
  }
);

// Plain B-tree indexes for the regex-fallback fast paths used by admin search.
// These are case-sensitive but the prefix portion (^...) of the regex is index-friendly.
ProductSchema.index({ sku: 1 });
ProductSchema.index({ barcode: 1 });
ProductSchema.index({ hsnCode: 1 });

// Additional indexes for array fields used in queries (safely added - will build in background)
ProductSchema.index({ categoryIds: 1 }); // For categoryIds filtering
ProductSchema.index({ businessTypeSlugs: 1 }); // For businessTypeSlugs filtering
ProductSchema.index({ 'variants.sku': 1 });
ProductSchema.index({ 'variants.variantId': 1 });

// Indexes to speed up sidebar filter queries (products route)
// Note: We intentionally avoid compound indexes involving multiple array paths because
// MongoDB does not allow compound multikey indexes with more than one array field.
ProductSchema.index({ 'colorVariants.colorName': 1 }); // For color filtering
ProductSchema.index({ 'filters.key': 1 }); // Helps $elemMatch by key
ProductSchema.index({ 'filters.values': 1 }); // Helps $elemMatch by values

// Helps category browsing sorted by newest without relying on in-memory sort
ProductSchema.index({ categoryIds: 1, createdAt: -1 });

// Parent/child variant query patterns.
ProductSchema.index({ parentProductId: 1, visibleOnClient: 1 });
ProductSchema.index({ productType: 1, visibleOnClient: 1, status: 1 });
ProductSchema.index({ productType: 1, showInCatalog: 1 });

// Slug unique among non-deleted products only (soft-deleted rows may share slug with a new active product).
// If the DB still has a legacy global unique index on `slug` (e.g. slug_1), drop it after deploy:
// db.products.dropIndex("slug_1")
ProductSchema.index(
  { slug: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: null },
    name: 'slug_unique_active',
  }
);

// Virtual for getting category details (populated on demand)
ProductSchema.virtual('category', {
  ref: 'Category',
  localField: 'categoryId',
  foreignField: '_id',
  justOne: true,
});

// Slugify helper used by both fallback slug generation and child-suffix derivation.
function _slugifySegment(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Build searchBlob payload from a parent + child pair. Parents store their own as a
// concatenation of their own fields. Children additionally include parent fields so a
// search for "red mug" hits both the parent listing and the matching child SKU.
//
// Barcode and HSN code are denormalized into the blob so admins can paste a child's
// barcode and find the parent listing too.
//
// `parent.variants[]` (the legacy embedded variant array) is also flattened into the
// blob so admins can search for an embedded variant's SKU/barcode/HSN/name even when
// the listing has not been migrated to real child documents. Without this, embedded
// variants would be completely invisible to the search UI.
function _buildSearchBlob({ parent, child }) {
  const parts = [];
  if (parent) {
    parts.push(
      parent.title,
      parent.brand,
      parent.sku,
      parent.barcode,
      parent.hsnCode,
      ...(Array.isArray(parent.tags) ? parent.tags : [])
    );

    if (Array.isArray(parent.variants)) {
      parent.variants.forEach((v) => {
        if (!v) return;
        parts.push(
          v.name,
          v.sku,
          v.barcode,
          v.hsnCode,
          v.size,
          v.color,
          v.weight,
          v.unitCount,
          v.unit
        );
      });
    }
  }
  if (child) {
    parts.push(child.title, child.sku, child.barcode, child.hsnCode);
    const attrs = child.variationAttributes || {};
    parts.push(attrs.size, attrs.color, attrs.weight, attrs.unitCount);
  }
  return parts
    .map((p) => String(p || '').trim())
    .filter(Boolean)
    .join(' ');
}

// Pre-save middleware: slug fallback + searchBlob refresh.
//
// `searchBlob` is the only place where embedded `variants[]` fields are exposed to
// the text index, so we recompute it on every save. For child documents the admin
// routes pass explicit (parent, child) pairs — but the storefront/standalone path
// flows through here too, and rebuilding the blob here is cheap (string join) and
// idempotent.
//
// Children should normally receive an explicit slug from the create/update route
// (which has the parent loaded); this hook is the last-resort fallback that uses
// only the child's own title — admin routes are responsible for uniqueness.
ProductSchema.pre('save', function (next) {
  if (!this.slug && this.title) {
    this.slug = _slugifySegment(this.title);
  }

  // Rebuild only when relevant fields changed to avoid pointless writes on
  // unrelated mutations (e.g. flipping `featured` shouldn't rewrite the blob).
  const watchedKeys = [
    'title', 'brand', 'sku', 'barcode', 'hsnCode', 'tags', 'variants',
  ];
  const shouldRefresh = this.isNew || watchedKeys.some((k) => this.isModified(k));

  if (shouldRefresh && this.productType !== 'child') {
    this.searchBlob = _buildSearchBlob({ parent: this });
  }

  next();
});

// Post-save propagation: when a parent's mirrored fields change, update every child.
// `findOneAndUpdate` does NOT trigger this hook — admin update routes call the
// `propagateParentToChildren` static below explicitly.
ProductSchema.post('save', async function (doc) {
  try {
    if (!doc || doc.productType !== 'parent') return;
    const ProductModel = mongoose.model('Product');
    const children = await ProductModel.find({ parentProductId: doc._id, deletedAt: null }).lean();
    if (!children.length) return;
    const ops = children.map((child) => ({
      updateOne: {
        filter: { _id: child._id },
        update: {
          $set: {
            categoryId: doc.categoryId || null,
            categoryIds: Array.isArray(doc.categoryIds) ? doc.categoryIds : [],
            brand: doc.brand || '',
            businessTypeSlugs: Array.isArray(doc.businessTypeSlugs) ? doc.businessTypeSlugs : [],
            searchBlob: _buildSearchBlob({ parent: doc, child }),
          },
        },
      },
    }));
    if (ops.length) await ProductModel.bulkWrite(ops, { ordered: false });
  } catch (err) {
    // Never block the parent save on propagation issues; surface for ops visibility only.
    console.error('Product post(save) child propagation failed:', err?.message || err);
  }
});

// Static helper that admin update routes can call after `findOneAndUpdate` because
// document middleware doesn't fire on raw update operators.
ProductSchema.statics.propagateParentToChildren = async function (parentId) {
  const ProductModel = this;
  const parent = await ProductModel.findById(parentId).lean();
  if (!parent || parent.productType !== 'parent') return;
  const children = await ProductModel.find({ parentProductId: parent._id, deletedAt: null }).lean();
  if (!children.length) return;
  const ops = children.map((child) => ({
    updateOne: {
      filter: { _id: child._id },
      update: {
        $set: {
          categoryId: parent.categoryId || null,
          categoryIds: Array.isArray(parent.categoryIds) ? parent.categoryIds : [],
          brand: parent.brand || '',
          businessTypeSlugs: Array.isArray(parent.businessTypeSlugs) ? parent.businessTypeSlugs : [],
          searchBlob: _buildSearchBlob({ parent, child }),
        },
      },
    },
  }));
  if (ops.length) await ProductModel.bulkWrite(ops, { ordered: false });
};

// Static helper for child create/update routes to compute a safe child slug.
// Suffixes the parent slug with non-empty variation attribute values so siblings
// never collide. Uniqueness is enforced via generateUniqueSlug at the call site.
ProductSchema.statics.buildChildSlugBase = function (parent, variationAttributes) {
  const parentSlug = _slugifySegment(parent?.slug || parent?.title || '');
  const attrParts = ['size', 'color', 'weight', 'unitCount']
    .map((k) => _slugifySegment(variationAttributes?.[k] || ''))
    .filter(Boolean);
  const tail = attrParts.length ? `-${attrParts.join('-')}` : '';
  return `${parentSlug}${tail}`;
};

// Expose searchBlob builder for routes/migration scripts.
ProductSchema.statics.buildSearchBlob = function (parent, child) {
  return _buildSearchBlob({ parent, child });
};

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
    deletedAt: null,
    $or: [
      { categoryId: { $in: categoryIds } },
      { categoryIds: { $in: categoryIds } }
    ]
  });
};

// Export the model
// In Next.js dev mode, Mongoose models can be cached across hot reloads.
// When the schema changes (like adding `faqs`), the cached model may not pick it up.
// Re-register the model in non-production to ensure new schema fields persist.
if (process.env.NODE_ENV !== 'production') {
  try {
    if (mongoose.models.Product) {
      mongoose.deleteModel('Product');
    }
  } catch {
    // ignore
  }
}

const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);
export default Product;

