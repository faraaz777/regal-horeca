import mongoose from 'mongoose';
import Product from '@/lib/models/Product';
import { connectToDatabase } from '@/lib/db/connect';
import { getCategoryIdsWithChildren } from '@/lib/utils/categoryCache';
import { unstable_cache } from 'next/cache';

const PREDEFINED_COLORS = [
  'Blue',
  'Green',
  'Red',
  'Yellow',
  'Purple',
  'Orange',
  'Pink',
  'Brown',
  'Gray',
  'Black',
  'White',
  'Silver',
];

function normalizeTitleCaseExpr(inputExpr) {
  // Title-case (first char upper, rest lower) with trimming.
  // Safe for empty/1-char strings.
  return {
    $let: {
      vars: {
        s: { $trim: { input: inputExpr } },
        len: { $strLenCP: { $trim: { input: inputExpr } } },
      },
      in: {
        $cond: [
          { $gt: ['$$len', 0] },
          {
            $cond: [
              { $gt: ['$$len', 1] },
              {
                $concat: [
                  { $toUpper: { $substrCP: ['$$s', 0, 1] } },
                  { $toLower: { $substrCP: ['$$s', 1, { $subtract: ['$$len', 1] }] } },
                ],
              },
              { $toUpper: '$$s' },
            ],
          },
          '',
        ],
      },
    },
  };
}

function toObjectIds(ids) {
  return (ids || [])
    .map((id) => {
      try {
        return new mongoose.Types.ObjectId(String(id));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function buildBaseMatch({ categorySlug, businessSlug, searchQuery, featured, status, categoryIds }) {
  const query = {};
  const andConditions = [];

  const trimmedSearch = searchQuery && String(searchQuery).trim();
  const useTextSearch = !!trimmedSearch;
  const textSearchQuery = useTextSearch ? { $text: { $search: trimmedSearch } } : null;

  if (categorySlug && categoryIds && categoryIds.length > 0) {
    andConditions.push({
      $or: [{ categoryId: { $in: categoryIds } }, { categoryIds: { $in: categoryIds } }],
    });
  }

  if (businessSlug) {
    andConditions.push({ businessTypeSlugs: String(businessSlug) });
  }

  if (featured === 'true') {
    andConditions.push({ featured: true });
  }

  if (status) {
    andConditions.push({ status: String(status) });
  }

  if (useTextSearch) {
    if (andConditions.length > 0) query.$and = [textSearchQuery, ...andConditions];
    else Object.assign(query, textSearchQuery);
  } else if (andConditions.length > 0) {
    query.$and = andConditions;
  }

  return query;
}

/**
 * Compute sidebar facets using MongoDB aggregation:
 * - avoids loading all products into Node
 * - returns the same response shape used by the UI
 */
export async function queryProductFacets({
  categorySlug,
  businessSlug,
  searchQuery,
  featured,
  status,
} = {}) {
  return cachedQueryProductFacets({
    categorySlug,
    businessSlug,
    searchQuery,
    featured,
    status,
  });
}

const cachedQueryProductFacets = unstable_cache(
  async ({ categorySlug, businessSlug, searchQuery, featured, status } = {}) => {
  await connectToDatabase();

  let categoryObjectIds = [];
  if (categorySlug) {
    const categoryIds = await getCategoryIdsWithChildren(String(categorySlug));
    categoryObjectIds = toObjectIds(categoryIds);
  }

  const match = buildBaseMatch({
    categorySlug,
    businessSlug,
    searchQuery,
    featured,
    status,
    categoryIds: categoryObjectIds,
  });

  // Normalize legacy filter object format into an array so `$unwind` works.
  const filtersNormalizedExpr = {
    $let: {
      vars: { f: '$filters' },
      in: {
        $cond: [
          { $isArray: '$$f' },
          '$$f',
          {
            $cond: [
              { $eq: [{ $type: '$$f' }, 'object'] },
              {
                $map: {
                  input: { $objectToArray: '$$f' },
                  as: 'kv',
                  in: {
                    key: normalizeTitleCaseExpr('$$kv.k'),
                    values: {
                      $cond: [{ $isArray: '$$kv.v' }, '$$kv.v', []],
                    },
                  },
                },
              },
              [],
            ],
          },
        ],
      },
    },
  };

  const pipeline = [
    { $match: match },
    { $addFields: { _filtersArr: filtersNormalizedExpr } },
    {
      $facet: {
        colors: [
          { $unwind: { path: '$colorVariants', preserveNullAndEmptyArrays: false } },
          { $project: { c: '$colorVariants.colorName' } },
          { $match: { c: { $in: PREDEFINED_COLORS } } },
          { $group: { _id: '$c' } },
          { $sort: { _id: 1 } },
        ],
        brands: [
          {
            $project: {
              b: {
                $trim: { input: { $ifNull: ['$brand', ''] } },
              },
            },
          },
          { $match: { b: { $ne: '' } } },
          { $group: { _id: '$b' } },
          { $sort: { _id: 1 } },
        ],
        priceRange: [
          { $match: { price: { $type: 'number', $gte: 0 } } },
          { $group: { _id: null, min: { $min: '$price' }, max: { $max: '$price' } } },
        ],
        filters: [
          { $unwind: { path: '$_filtersArr', preserveNullAndEmptyArrays: false } },
          {
            $addFields: {
              k: normalizeTitleCaseExpr('$_filtersArr.key'),
            },
          },
          { $unwind: { path: '$_filtersArr.values', preserveNullAndEmptyArrays: false } },
          {
            $addFields: {
              v: normalizeTitleCaseExpr('$_filtersArr.values'),
            },
          },
          { $match: { k: { $ne: '' }, v: { $ne: '' } } },
          { $group: { _id: { key: '$k', value: '$v' }, count: { $sum: 1 } } },
          { $sort: { '_id.key': 1, '_id.value': 1 } },
          {
            $group: {
              _id: '$_id.key',
              values: { $push: { value: '$_id.value', count: '$count' } },
            },
          },
          { $sort: { _id: 1 } },
        ],
        total: [{ $count: 'count' }],
      },
    },
  ];

  const [res] = await Product.aggregate(pipeline).allowDiskUse(true);

  const colors = (res?.colors || []).map((x) => x._id).filter(Boolean);
  const brands = (res?.brands || []).map((x) => x._id).filter(Boolean);

  const priceAgg = (res?.priceRange || [])[0] || null;
  const minPrice =
    priceAgg && typeof priceAgg.min === 'number' && Number.isFinite(priceAgg.min) ? Math.floor(priceAgg.min) : 0;
  const maxPrice =
    priceAgg && typeof priceAgg.max === 'number' && Number.isFinite(priceAgg.max) ? Math.ceil(priceAgg.max) : 0;

  const filtersWithCounts = {};
  (res?.filters || []).forEach((row) => {
    if (!row?._id) return;
    filtersWithCounts[row._id] = Array.isArray(row.values) ? row.values : [];
  });

  const totalProducts = (res?.total || [])[0]?.count || 0;

  return {
    colors,
    brands,
    filters: filtersWithCounts,
    priceRange: { min: minPrice, max: maxPrice },
    totalProducts,
  };
  },
  ['product-facets-v1'],
  { revalidate: 300, tags: ['facets'] }
);

