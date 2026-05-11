import Product from '@/lib/models/Product';
import Category from '@/lib/models/Category';
import Brand from '@/lib/models/Brand';
import { connectToDatabase } from '@/lib/db/connect';
import { getCategoryIdsWithChildren } from '@/lib/utils/categoryCache';

function parseCsv(param) {
  if (!param) return [];
  return String(param)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseFiltersParam(filtersParam) {
  if (!filtersParam) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(filtersParam));
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function normalizeTitleCase(str) {
  const s = String(str || '').trim();
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function normalizeLegacyFilters(filters) {
  if (!filters) return [];
  if (Array.isArray(filters)) return filters;
  if (typeof filters !== 'object') return [];

  const out = [];
  const oldFilters = filters;

  if (oldFilters.material && Array.isArray(oldFilters.material) && oldFilters.material.length > 0) {
    out.push({ key: 'Material', values: oldFilters.material });
  }
  if (oldFilters.size && Array.isArray(oldFilters.size) && oldFilters.size.length > 0) {
    out.push({ key: 'Size', values: oldFilters.size });
  }
  if (oldFilters.color && Array.isArray(oldFilters.color) && oldFilters.color.length > 0) {
    out.push({ key: 'Color', values: oldFilters.color });
  }
  if (oldFilters.usage && Array.isArray(oldFilters.usage) && oldFilters.usage.length > 0) {
    out.push({ key: 'Usage', values: oldFilters.usage });
  }

  Object.keys(oldFilters).forEach((key) => {
    if (['material', 'size', 'color', 'usage'].includes(key.toLowerCase())) return;
    if (Array.isArray(oldFilters[key]) && oldFilters[key].length > 0) {
      out.push({ key: normalizeTitleCase(key), values: oldFilters[key] });
    }
  });

  return out;
}

/**
 * Shared server-side product query used by:
 * - API route handlers (no duplication)
 * - Server Components (avoids self-HTTP fetch)
 */
export async function queryProducts({
  categorySlug,
  businessSlug,
  searchQuery,
  featured,
  status,
  idsParam,
  priceMin,
  priceMax,
  colorsParam,
  brandsParam,
  filtersParam,
  sortBy = 'newest',
  page = 1,
  limit = 24,
  includePopulates = true,
  /** 'active' (default): not soft-deleted | 'deleted': only soft-deleted | 'all': every row */
  listMode = 'active',
  /** When false (default = storefront), parents are hidden and per-row visibility is enforced. */
  adminMode = false,
  /** Optional admin-only filters for the unified product list. */
  productType,
  parentProductId,
} = {}) {
  // Ensure populate refs are registered (Mongoose requires models to be loaded).
  void Category;
  void Brand;

  await connectToDatabase();

  const pageNum = Number(page) || 1;
  const limitNum = Number(limit) || 24;
  const skip = (pageNum - 1) * limitNum;

  const query = {};
  const andConditions = [];

  if (listMode === 'deleted') {
    andConditions.push({ deletedAt: { $ne: null } });
  } else if (listMode !== 'all') {
    andConditions.push({ deletedAt: null });
  }

  // Storefront chokepoint: hide parent carriers and respect per-row visibility flag.
  // Admin lists pass adminMode: true to see everything (parents + hidden children).
  if (!adminMode) {
    andConditions.push({ productType: { $ne: 'parent' } });
    andConditions.push({
      $or: [{ productType: { $ne: 'child' } }, { visibleOnClient: true }],
    });
  } else {
    if (productType) {
      andConditions.push({ productType: String(productType) });
    }
    if (parentProductId) {
      andConditions.push({ parentProductId });
    }
  }

  // Search composition.
  // ─────────────────────────────────────────────────────────────────────────────
  // We deliberately use case-insensitive substring regex (not MongoDB `$text`):
  //
  // 1. SKU/barcode/HSN are alphanumeric codes; `$text` does whole-token matching
  //    with stemming, so "5567" would NOT find SKU "556771".
  // 2. `$text` inside `$or` plus `$meta: 'textScore'` sort has version-specific
  //    quirks and breaks if the deployed `text_search_index` has a different
  //    field set than the model defines (Mongoose can't change an existing text
  //    index in place — it has to be dropped and rebuilt).
  // 3. The denormalized `searchBlob` field already concatenates everything we
  //    care about (title, brand, sku, barcode, hsnCode, tags, embedded variants),
  //    so a regex against it is functionally equivalent to a token search.
  //
  // The OR list covers every place a code can live:
  //   - root fields                         → standalones + real child documents
  //   - searchBlob                          → denormalized parent/child fields
  //   - subdocument `variants.*` fields     → legacy embedded variants array
  //   - legacyParentVariantId               → migrated rows still resolvable
  //
  // Regex input is `escapeRegex`'d to neutralise crafted special characters.
  const trimmedSearch = searchQuery && String(searchQuery).trim();
  const useSearch = !!trimmedSearch;

  function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  let textSearchQuery = null;
  if (useSearch) {
    const regex = new RegExp(escapeRegex(trimmedSearch), 'i');
    textSearchQuery = {
      $or: [
        // Root-level fields — covers standalones and child products (each child
        // is its own document with its own sku/barcode/hsnCode/title).
        { title: regex },
        { sku: regex },
        { barcode: regex },
        { hsnCode: regex },
        { brand: regex },
        { tags: regex },
        { searchBlob: regex },
        { legacyParentVariantId: regex },

        // Subdocument array fields — covers parents that still carry their
        // variants inside the embedded `variants[]` array (pre-migration data).
        // Mongo treats these as "any element of the array whose field matches".
        { 'variants.name': regex },
        { 'variants.sku': regex },
        { 'variants.barcode': regex },
        { 'variants.hsnCode': regex },
      ],
    };
  }
  // Renamed: we no longer use MongoDB `$text`, but the variable stays for the
  // existing branches that reference it (mostly for the textScore sort guard
  // which is now a no-op when search is regex-only).
  const useTextSearch = useSearch;

  // Category
  if (categorySlug) {
    const categoryIds = await getCategoryIdsWithChildren(String(categorySlug));
    if (categoryIds.length > 0) {
      andConditions.push({
        $or: [{ categoryId: { $in: categoryIds } }, { categoryIds: { $in: categoryIds } }],
      });
    }
  }

  // Business
  if (businessSlug) {
    andConditions.push({ businessTypeSlugs: String(businessSlug) });
  }

  // Featured
  if (featured === 'true') {
    andConditions.push({ featured: true });
  }

  // Status
  if (status) {
    andConditions.push({ status: String(status) });
  }

  // IDs
  if (idsParam) {
    const ids = parseCsv(idsParam);
    if (ids.length > 0) {
      andConditions.push({ _id: { $in: ids } });
    }
  }

  // Price
  const priceConditions = {};
  if (priceMin !== undefined && priceMin !== null && priceMin !== '') {
    const min = parseFloat(priceMin);
    if (!Number.isNaN(min)) priceConditions.$gte = min;
  }
  if (priceMax !== undefined && priceMax !== null && priceMax !== '') {
    const max = parseFloat(priceMax);
    if (!Number.isNaN(max)) priceConditions.$lte = max;
  }
  if (Object.keys(priceConditions).length > 0) {
    andConditions.push({ price: priceConditions });
  }

  // Brand
  if (brandsParam) {
    const brands = parseCsv(brandsParam);
    if (brands.length > 0) {
      andConditions.push({ brand: { $in: brands } });
    }
  }

  // Color
  if (colorsParam) {
    const colors = parseCsv(colorsParam);
    if (colors.length > 0) {
      andConditions.push({ 'colorVariants.colorName': { $in: colors } });
    }
  }

  // Dynamic filters (new format only; legacy object format is normalized on write)
  const parsedFilters = parseFiltersParam(filtersParam);
  if (parsedFilters) {
    Object.entries(parsedFilters).forEach(([filterKey, filterValues]) => {
      if (!Array.isArray(filterValues) || filterValues.length === 0) return;
      const normalizedKey = normalizeTitleCase(filterKey);
      const normalizedValues = filterValues.map((v) => normalizeTitleCase(v));
      andConditions.push({
        filters: {
          $elemMatch: {
            key: normalizedKey,
            values: { $in: normalizedValues },
          },
        },
      });
    });
  }

  // Combine
  if (useTextSearch) {
    if (andConditions.length > 0) query.$and = [textSearchQuery, ...andConditions];
    else Object.assign(query, textSearchQuery);
  } else if (andConditions.length > 0) {
    query.$and = andConditions;
  }

  // Sort. We dropped MongoDB `$text` in favour of regex-only search (see comment
  // above the search composition block) so the previous `$meta: 'textScore'`
  // ordering is no longer valid here. Search results just fall back to recency.
  let sortObject = {};
  switch (sortBy) {
    case 'price-asc':
      sortObject = { price: 1 };
      break;
    case 'price-desc':
      sortObject = { price: -1 };
      break;
    case 'newest':
    default:
      sortObject = { createdAt: -1 };
      break;
  }

  // List payload optimization (mirrors existing API behavior).
  // Includes parent/child marker fields so the admin list and storefront resolver
  // can distinguish standalones, parents, and children without an extra fetch.
  // `barcode` and `hsnCode` are pulled so admin search hits can preview the
  // matched code without an extra round-trip.
  const isListQuery = limitNum > 1;
  const selectFields = isListQuery
    ? 'title slug heroImage gallery price brand categoryId featured status createdAt sku barcode hsnCode tags colorVariants filters variants deletedAt productType parentProductId variationTheme variationAttributes visibleOnClient defaultChildProductId legacyParentVariantId'
    : undefined;

  let queryBuilder = Product.find(query);

  if (selectFields) {
    queryBuilder = queryBuilder.select(selectFields);
  }

  if (includePopulates) {
    queryBuilder = queryBuilder
      .populate('categoryId', 'name slug level')
      .populate('categoryIds', 'name slug level')
      .populate('brandCategoryId', 'name slug level')
      .populate('brandCategoryIds', 'name slug level');
  }

  const [products, total] = await Promise.all([
    queryBuilder.sort(sortObject).limit(limitNum).skip(skip).lean(),
    Product.countDocuments(query),
  ]);

  const totalPages = Math.ceil(total / limitNum);

  return {
    products: (products || []).map((p) => ({
      ...p,
      filters: normalizeLegacyFilters(p.filters),
    })),
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1,
    },
  };
}

