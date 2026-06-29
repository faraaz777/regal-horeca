import 'server-only';

import Product from '@/lib/models/Product';
import { salesCatalogBaseFilter, buildSalesCatalogSearchFilter } from '@/lib/server/sales/catalogSearch';
import { getInStockProductIds, stockFilterToQuery } from '@/lib/server/sales/stockFilterService';
import { getListPricePaise } from '@/lib/server/sales/pricing';
import { getCategoryIdsWithChildren } from '@/lib/utils/categoryCache';

function parseBrandList(brands) {
  if (!brands) return [];
  if (Array.isArray(brands)) return brands.map((b) => String(b).trim()).filter(Boolean);
  return String(brands)
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean);
}

/** Price filter in rupees; handles moneyInPaise and legacy rupee fields. */
export function buildSalesPriceCondition(priceMin, priceMax) {
  const min = priceMin != null && priceMin !== '' ? Number(priceMin) : null;
  const max = priceMax != null && priceMax !== '' ? Number(priceMax) : null;
  if ((min == null || Number.isNaN(min)) && (max == null || Number.isNaN(max))) {
    return null;
  }

  const rupeeRange = {};
  const paiseRange = {};
  if (min != null && !Number.isNaN(min)) {
    rupeeRange.$gte = min;
    paiseRange.$gte = Math.round(min * 100);
  }
  if (max != null && !Number.isNaN(max)) {
    rupeeRange.$lte = max;
    paiseRange.$lte = Math.round(max * 100);
  }

  const or = [];
  if (Object.keys(rupeeRange).length) {
    or.push({ moneyInPaise: { $ne: true }, sellingPrice: rupeeRange });
    or.push({ moneyInPaise: { $ne: true }, price: rupeeRange });
  }
  if (Object.keys(paiseRange).length) {
    or.push({ moneyInPaise: true, sellingPrice: paiseRange });
    or.push({ moneyInPaise: true, price: paiseRange });
  }
  return or.length ? { $or: or } : null;
}

export async function buildSalesCatalogQuery({
  q = '',
  brands = [],
  priceMin,
  priceMax,
  stock = 'all',
  category = '',
  inStockIds = null,
}) {
  const base = salesCatalogBaseFilter();
  const and = [base];

  const brandList = parseBrandList(brands);
  if (brandList.length > 0) {
    and.push({ brand: { $in: brandList } });
  }

  const priceCond = buildSalesPriceCondition(priceMin, priceMax);
  if (priceCond) and.push(priceCond);

  const term = String(q || '').trim();
  if (term) {
    const searchFilter = await buildSalesCatalogSearchFilter(term);
    if (searchFilter) and.push(searchFilter);
  }

  const categorySlug = String(category || '').trim();
  if (categorySlug) {
    const categoryIds = await getCategoryIdsWithChildren(categorySlug);
    if (categoryIds.length > 0) {
      and.push({
        $or: [{ categoryId: { $in: categoryIds } }, { categoryIds: { $in: categoryIds } }],
      });
    } else {
      and.push({ _id: null });
    }
  }

  const stockMode = String(stock || 'all').toLowerCase();
  if (stockMode === 'in_stock' || stockMode === 'out') {
    const ids = inStockIds ?? (await getInStockProductIds());
    const stockCond = stockFilterToQuery(stockMode, ids);
    if (stockCond) and.push(stockCond);
  }

  if (and.length === 1) return and[0];
  return { $and: and };
}

export async function getSalesCatalogFacets({ q = '' } = {}) {
  const base = salesCatalogBaseFilter();
  const and = [base];

  const term = String(q || '').trim();
  if (term) {
    const searchFilter = await buildSalesCatalogSearchFilter(term);
    if (searchFilter) and.push(searchFilter);
  }

  const match = and.length === 1 ? and[0] : { $and: and };

  const [brandRows, priceSample] = await Promise.all([
    Product.aggregate([
      { $match: { ...match, brand: { $exists: true, $nin: [null, ''] } } },
      { $group: { _id: '$brand', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $limit: 80 },
    ]),
    Product.find(match)
      .select('sellingPrice price mrp moneyInPaise')
      .limit(2000)
      .lean(),
  ]);

  let minPaise = Infinity;
  let maxPaise = 0;
  for (const p of priceSample) {
    const paise = getListPricePaise(p);
    if (paise > 0) {
      minPaise = Math.min(minPaise, paise);
      maxPaise = Math.max(maxPaise, paise);
    }
  }

  return {
    brands: brandRows.map((r) => ({ name: r._id, count: r.count })),
    priceRange: {
      min: minPaise === Infinity ? 0 : Math.floor(minPaise / 100),
      max: maxPaise === 0 ? 0 : Math.ceil(maxPaise / 100),
    },
  };
}
