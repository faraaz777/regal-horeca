# Department Bar Product Fetching Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER HOVERS OVER DEPARTMENT                  │
│              (e.g., "BARWARE", "TABLEWARE", etc.)                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  onMouseEnter={() => setActiveDepartment(dept.slug)}            │
│  (Line 546 in Header.jsx)                                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│         activeDepartment STATE UPDATES                          │
│         (e.g., activeDepartment = "barware")                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│         useMemo: activeDept COMPUTATION                           │
│         (Lines 262-267)                                          │
│                                                                  │
│  activeDept = departments.find(d =>                              │
│    d.slug === activeDepartment                                  │
│  )                                                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│         SWR HOOK TRIGGERS                                        │
│         (Lines 270-281)                                          │
│                                                                  │
│  Key: activeDept?.slug ?                                        │
│    `/api/products?category=${activeDept.slug}                  │
│     &featured=true&limit=10`                                    │
│    : null                                                        │
│                                                                  │
│  Options:                                                        │
│  - dedupingInterval: 300000 (5 min cache)                        │
│  - fallbackData: cached products if available                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│         API REQUEST SENT                                         │
│         GET /api/products?category=barware&featured=true&limit=10│
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│         API ROUTE: app/api/products/route.js                     │
│         (Line 40: GET handler)                                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│         EXTRACT PARAMETERS                                       │
│         - categorySlug = "barware"                                │
│         - featured = "true"                                      │
│         - limit = 10                                             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│         CATEGORY LOOKUP                                          │
│         (Line 80: getCategoryIdsWithChildren)                   │
│                                                                  │
│  1. Check categoryIdsCache[categorySlug]                        │
│     └─> If cached, return immediately                           │
│                                                                  │
│  2. If not cached:                                               │
│     ├─> Fetch category from DB: Category.findOne({slug})        │
│     ├─> Get cached category tree (10 min cache)                 │
│     ├─> Find category in tree recursively                       │
│     ├─> Collect all descendant category IDs                     │
│     └─> Cache result in categoryIdsCache                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│         BUILD MONGODB QUERY                                      │
│         (Lines 67-184)                                           │
│                                                                  │
│  query = {                                                       │
│    $and: [                                                       │
│      {                                                           │
│        $or: [                                                    │
│          { categoryId: { $in: [catId1, catId2, ...] } },        │
│          { categoryIds: { $in: [catId1, catId2, ...] } }         │
│        ]                                                         │
│      },                                                          │
│      { featured: true },                                         │
│      { status: "active" }                                        │
│    ]                                                             │
│  }                                                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│         EXECUTE DATABASE QUERY                                   │
│         (Lines 214-237)                                          │
│                                                                  │
│  Product.find(query)                                            │
│    .select('title slug heroImage ...')  // Only needed fields   │
│    .populate('categoryId', 'name slug level')                   │
│    .populate('categoryIds', 'name slug level')                   │
│    .sort({ createdAt: -1 })                                     │
│    .limit(10)                                                    │
│    .lean()  // Returns plain objects (faster)                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│         RETURN RESPONSE                                          │
│         (Lines 276-295)                                          │
│                                                                  │
│  {                                                               │
│    success: true,                                                │
│    products: [                                                   │
│      { _id, title, slug, heroImage, price, ... },                │
│      ...                                                         │
│    ]                                                             │
│  }                                                               │
│                                                                  │
│  Headers:                                                        │
│  - Cache-Control: public, s-maxage=300                           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│         SWR RECEIVES RESPONSE                                    │
│         Updates productsData state                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│         useEffect TRIGGERS                                       │
│         (Lines 284-294)                                          │
│                                                                  │
│  if (activeDept?.slug && productsData?.success) {               │
│    setDepartmentProducts(prev => ({                             │
│      ...prev,                                                    │
│      [activeDept.slug]: productsData.products                    │
│    }))                                                           │
│  }                                                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│         EXTRACT PRODUCTS FOR DISPLAY                             │
│         (Line 492 in DepartmentsBar)                             │
│                                                                  │
│  activeDeptProducts =                                            │
│    departmentProducts[activeDept.slug] || []                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│         PASS TO FeaturedProductsSection                         │
│         (Line 676)                                               │
│                                                                  │
│  <FeaturedProductsSection                                       │
│    department={activeDept}                                       │
│    products={activeDeptProducts}                                 │
│    isLoading={productsLoading}                                   │
│  />                                                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│         DISPLAY FEATURED PRODUCT                                 │
│         (Lines 690-769)                                          │
│                                                                  │
│  1. Extract first product: products[0]                          │
│  2. Show loading skeleton if isLoading                          │
│  3. Display product image, title, price                         │
│  4. Link to /products/{slug}                                    │
└─────────────────────────────────────────────────────────────────┘
```

## Key Performance Optimizations

1. **Caching Layers:**
   - Category IDs cache (10 min) - `categoryIdsCache`
   - Category tree cache (10 min) - `categoryTreeCache`
   - SWR cache (5 min) - `dedupingInterval: 300000`
   - API response cache (5 min) - `s-maxage=300`
   - Department products state cache - `departmentProducts`

2. **Database Optimizations:**
   - `.lean()` for faster queries (plain objects)
   - `.select()` to fetch only needed fields
   - Indexes on `categoryId`, `categoryIds`, `featured`, `status`
   - Compound indexes for common query patterns

3. **Prefetching:**
   - Catalog page prefetch on hover (200ms debounce)
   - API data prefetch in parallel

## Timing Breakdown (Typical)

- **First hover (no cache):** ~300-500ms
  - Category lookup: ~50-100ms
  - Database query: ~100-200ms
  - Network: ~50-100ms
  - Rendering: ~50-100ms

- **Subsequent hovers (cached):** ~50-100ms
  - SWR cache hit: ~10ms
  - State update: ~10ms
  - Rendering: ~30-80ms

- **After prefetch:** ~0-50ms (instant)
  - Data already in cache
  - Just state update and render
