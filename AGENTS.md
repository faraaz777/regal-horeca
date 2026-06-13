# AGENTS.md

## Project Mission

Regal Horeca is a B2B HoReCa ERP and eCommerce platform designed for:

- Product Management
- Inventory Management
- Inquiry Management
- Catalog Generation
- Customer Management
- Pricing Management
- Sales Operations

Primary users:

- Product Managers
- Inventory Supervisors
- Sales Executives
- Management
- Developers
- Customers

# Commenting Standards

## Philosophy

Comments should explain:

* WHY something exists
* WHY a decision was made
* Business rules
* Edge cases
* Performance considerations

Comments should NOT explain:

* Obvious code
* Syntax
* Language features

Good comments explain intent.

Bad comments explain implementation.

---

# Golden Rule

Code explains HOW.

Comments explain WHY.

---

# Never Write Comments Like This

```ts
// Get products
const products = await Product.find()

// Loop through products
products.forEach(product => {})

// Increment count
count++

// Return response
return response
```

These comments add no value.

---

# Write Comments Like This

```ts
/**
 * We intentionally use lean() here because
 * product listings can exceed 50,000 records.
 *
 * Returning full mongoose documents creates
 * unnecessary memory overhead.
 */
```

---

# Business Rule Comments

Required whenever business logic exists.

Example:

```ts
/**
 * Inventory stock must never be updated directly.
 *
 * Every stock change must pass through
 * an inventory transaction so that
 * stock movement remains auditable.
 */
```

---

# Pricing Rule Comments

Example:

```ts
/**
 * Wholesale customers receive pricing
 * from tier tables instead of product MSRP.
 *
 * Never use MRP directly during quotation
 * generation.
 */
```

---

# Variant Generation Comments

Example:

```ts
/**
 * Shape is not considered a variant.
 *
 * Size, Color, Weight and Unit Count
 * create variants.
 *
 * Shape changes create a new product.
 */
```

---

# Catalog Comments

Example:

```ts
/**
 * Only products marked as catalog visible
 * should appear in generated PDF catalogs.
 *
 * Hidden products remain available internally.
 */
```

---

# Permission Comments

Example:

```ts
/**
 * Product Managers may create and update products
 * but cannot permanently delete products.
 *
 * Product deletion requires Developer permission.
 */
```

---

# API Comments

Every exported API route should have:

```ts
/**
 * POST /api/products
 *
 * Creates a parent product and optionally
 * generates variants.
 *
 * Permissions:
 * Product Manager+
 */
```

---

# Service Comments

Every service should have:

```ts
/**
 * Product Service
 *
 * Responsible for:
 * - Product Creation
 * - Product Updates
 * - Variant Generation
 * - Product Validation
 *
 * Does NOT handle inventory.
 */
```

---

# Model Comments

Example:

```ts
/**
 * InventoryTransaction
 *
 * Source of truth for all stock movement.
 *
 * Stock levels are derived from transactions.
 */
```

---

# Utility Comments

Required only when logic is complex.

Good:

```ts
/**
 * Normalizes product filters so the same
 * logic can be reused by:
 *
 * - Catalog APIs
 * - Search APIs
 * - Admin Listings
 */
```

Bad:

```ts
// Function to normalize filters
```

---

# Complex Logic Rule

If a developer needs more than
30 seconds to understand a block,
it needs documentation.

Example:

```ts
/**
 * Variant Matrix Generator
 *
 * Input:
 * Color = [Red, Blue]
 * Size = [10, 20]
 *
 * Output:
 * Red-10
 * Red-20
 * Blue-10
 * Blue-20
 *
 * Cartesian product generation.
 */
```

---

# Database Query Comments

Required when query behavior
is not immediately obvious.

```ts
/**
 * We intentionally project only
 * required fields because catalog
 * generation can process thousands
 * of products at once.
 */
```

---

# Performance Comments

Required when optimization exists.

```ts
/**
 * Cached for 15 minutes.
 *
 * Product categories rarely change
 * and are requested on every page.
 */
```

---

# TODO Rules

Allowed:

```ts
// TODO(REGAL-421):
// Add branch-specific inventory allocation.
```

Not Allowed:

```ts
// TODO: fix later
```

Every TODO must:

* Have reason
* Have identifier
* Be actionable

---

# FIXME Rules

Example:

```ts
// FIXME(REGAL-233):
// Mongo aggregation becomes slow
// beyond 100k products.
```

---

# HACK Rules

Example:

```ts
// HACK(REGAL-89):
// Temporary workaround until
// barcode service migration completes.
```

---

# AI Generated Code Rules

AI-generated code must:

* Preserve existing comments
* Update outdated comments
* Never remove business-rule comments
* Never replace detailed comments with generic comments

---

# Required Comment Locations

Mandatory:

* API Routes
* Services
* Inventory Logic
* Pricing Logic
* Permission Logic
* Variant Logic
* Catalog Logic
* Complex Queries
* Scheduled Jobs
* Report Generators

Optional:

* UI Components
* Simple Utilities
* Form Components

---

# Comment Density Rule

Target:

1 meaningful comment per
50–100 lines of code.

Avoid:

* Commenting every line
* Commenting obvious code

Focus on documenting decisions,
business rules and assumptions.



# Performance & Scalability Rules

## Core Principle

The system must be built for:

* Fast product search
* Large inventory data
* Bulk catalog generation
* High inquiry volume
* Multi-branch expansion
* Future mobile app usage

Never optimize blindly.

Always optimize based on:

* Database load
* API response time
* Frontend rendering
* Memory usage
* Real user experience

---

# Golden Rule

Fast code is not only short code.

Fast code is:

* Simple
* Measurable
* Indexed
* Paginated
* Cached
* Reusable
* Easy to maintain

---

# Database Performance Rules

## Always Use Pagination

Never fetch unlimited records.

Bad:

```ts
const products = await Product.find()
```

Good:

```ts
const products = await Product.find(query)
  .limit(limit)
  .skip(skip)
  .lean()
```

---

## Use lean() For Read-Only Queries

Use `lean()` when data is only being read.

```ts
const products = await Product.find(query).lean()
```

Reason:

Mongoose documents are heavier than plain objects.

---

## Use Field Projection

Fetch only required fields.

Bad:

```ts
const products = await Product.find(query)
```

Good:

```ts
const products = await Product.find(query)
  .select("name sku price images stock category")
  .lean()
```

---

## Use Indexes

Indexes are required for:

* SKU
* Barcode
* Product Name
* Category
* Brand
* Status
* Catalog Visibility
* Branch
* Created Date

Example:

```ts
ProductSchema.index({ sku: 1 })
ProductSchema.index({ barcode: 1 })
ProductSchema.index({ category: 1, brand: 1 })
ProductSchema.index({ isCatalogVisible: 1, status: 1 })
```

---

## Avoid N+1 Queries

Bad:

```ts
const products = await Product.find()

for (const product of products) {
  product.brand = await Brand.findById(product.brandId)
}
```

Good:

```ts
const products = await Product.find()
  .populate("brandId")
  .lean()
```

Better for large data:

```ts
const products = await Product.aggregate([
  {
    $lookup: {
      from: "brands",
      localField: "brandId",
      foreignField: "_id",
      as: "brand"
    }
  }
])
```

---

# API Performance Rules

## Standard API Response Shape

Every API should return predictable data.

```ts
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 500
  }
}
```

---

## Never Send Huge Payloads

Bad:

```ts
return allProductsWithFullDescriptionAndImages
```

Good:

```ts
return productListItemsOnly
```

List APIs should return summary data.

Detail APIs should return full data.

---

## Use Server-Side Filtering

Filtering must happen in database queries.

Bad:

```ts
const products = await Product.find()
const filtered = products.filter(product => product.brand === brand)
```

Good:

```ts
const products = await Product.find({ brand })
```

---

## Use Server-Side Sorting

Bad:

```ts
products.sort()
```

Good:

```ts
Product.find(query).sort({ createdAt: -1 })
```

---

## Add Request Limits

Every list API must have a maximum limit.

```ts
const limit = Math.min(Number(searchParams.get("limit")) || 20, 100)
```

Never allow unlimited results from frontend.

---

# Frontend Performance Rules

## Use Server Components Where Possible

Prefer Server Components for:

* Product listing pages
* Catalog pages
* Category pages
* Static content
* SEO pages

Use Client Components only when needed for:

* Forms
* Modals
* Filters
* Interactive dashboards

---

## Avoid Unnecessary Re-Renders

Use:

* memo
* useMemo
* useCallback

Only when it actually reduces re-render cost.

Do not wrap everything blindly.

---

## Lazy Load Heavy Components

Lazy load:

* Charts
* Image editors
* PDF generators
* Rich text editors
* Large modals

Example:

```ts
const Chart = dynamic(() => import("@/components/Chart"), {
  ssr: false
})
```

---

## Image Optimization Rules

Use Next.js Image component.

```tsx
<Image
  src={product.image}
  alt={product.name}
  width={400}
  height={400}
/>
```

Always include:

* width
* height
* alt

Avoid loading full-size 2048px images in product cards.

Use thumbnails for listings.

---

# Product Search Performance

Product search must support:

* SKU search
* Name search
* Brand search
* Category filter
* Stock filter
* Catalog visibility filter

Use normalized search fields.

Example:

```ts
searchText: "mazda stainless napkin holder black gold"
```

Use indexes on search fields.

---

# Inventory Performance Rules

Inventory can grow very large.

Never calculate stock by scanning all transactions during every request.

Bad:

```ts
const transactions = await InventoryTransaction.find({ productId })
const stock = transactions.reduce(...)
```

Good:

Maintain current stock snapshot:

```ts
InventoryStock {
  productId,
  variantId,
  branchId,
  currentQty
}
```

Keep transactions as audit history.

Use stock snapshot for fast reads.

Use transactions for reports.

---

# Inventory Transaction Rules

Every inventory transaction must update:

1. InventoryTransaction
2. InventoryStock Snapshot

Both must stay consistent.

Use database transaction/session where possible.

---

# Reporting Performance Rules

Reports should not block normal APIs.

For heavy reports:

* Use aggregation
* Use date filters
* Use background jobs
* Use cached summaries

Never generate large reports from raw data on every request.

---

# Catalog Performance Rules

Catalog generation can be heavy.

Rules:

* Use selected fields only
* Use thumbnails when possible
* Process in batches
* Cache generated PDFs
* Avoid regenerating unchanged catalogs

Catalog cache key should include:

* Product IDs
* Updated dates
* Catalog template
* Language
* Price type

---

# Caching Rules

Cache data that changes rarely:

* Categories
* Brands
* Product Types
* Static Catalog Data
* Homepage Sections

Do not cache:

* Live Stock
* Live Pricing
* User Permissions
* Active Sessions

---

# Scalability Rules

Design every module for future:

* Multi-branch
* Multi-warehouse
* Role permissions
* Mobile app
* Vendor portal
* Customer portal
* Barcode system

Do not hardcode:

* Branch ID
* Warehouse ID
* User role names
* Currency assumptions
* GST assumptions

Use constants/config files.

---

# Bulk Operation Rules

Bulk operations must:

* Validate all rows first
* Report row-level errors
* Use batch inserts/updates
* Avoid one database call per row

Bad:

```ts
for (const row of rows) {
  await Product.create(row)
}
```

Good:

```ts
await Product.insertMany(validRows, { ordered: false })
```

---

# Error Handling Performance

Do not expose full stack traces.

Do not log huge payloads.

Log only useful context:

```ts
logger.error("Product import failed", {
  userId,
  rowNumber,
  sku,
  reason
})
```

---

# Monitoring Rules

Track:

* Slow APIs
* Failed APIs
* Database query time
* Product import time
* Catalog generation time
* Inventory adjustment failures

Any API taking more than 1 second should be reviewed.

---

# Code Splitting Rules

Split large modules by responsibility.

Bad:

```ts
productController.ts
```

with 2,000 lines.

Good:

```ts
product.service.ts
product.validation.ts
product.repository.ts
product.transformer.ts
product.types.ts
```

---

# Reusable Logic Rules

If logic appears in more than one place, move it to:

* lib/
* services/
* utils/
* constants/

Never duplicate:

* Product filters
* Permission checks
* Database connection
* API response handling
* Pagination logic
* Error handling

---

# Environment Rules

Use environment variables for:

* Database URI
* JWT Secret
* Cloudinary Keys
* API URLs
* Feature Flags

Never hardcode production values.

---

# Testing Performance Rules

Test:

* Product listing with 10,000 products
* Inventory transactions with 100,000 records
* Catalog generation with 1,000 products
* Search with large data
* Bulk product import

Performance-sensitive code must be tested with realistic data volume.

---

# AI Agent Performance Instructions

Before writing performance code:

1. Check existing patterns
2. Check database indexes
3. Avoid duplicate queries
4. Avoid loading unnecessary fields
5. Use pagination
6. Use lean()
7. Use reusable helpers

Never claim something is optimized unless the change clearly improves:

* Query count
* Response size
* Rendering cost
* Memory usage
* Database load

---

# Performance Review Checklist

Before completing any feature, verify:

* Does this API paginate?
* Does this query use indexes?
* Does this fetch only required fields?
* Does this avoid N+1 queries?
* Does this avoid duplicate logic?
* Does this work with 10x more data?
* Does this preserve existing business rules?
* Does this avoid loading 2048px images unnecessarily?
* Does this keep inventory reads fast?
* Does this keep catalog generation scalable?

---

# Definition Of Scalable Code

Scalable code means:

* More products do not make the system unusable
* More inventory transactions do not slow product pages
* More users do not break permissions
* More branches do not require rewriting modules
* More catalog data does not require rebuilding the system

When in doubt:

Choose the design that will still work when Regal Horeca has:

* 100,000 products
* 1,000,000 inventory transactions
* Multiple branches
* Multiple warehouses
* Multiple user roles
