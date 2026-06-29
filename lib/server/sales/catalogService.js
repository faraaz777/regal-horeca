import 'server-only';

import Product from '@/lib/models/Product';
import { getBatchProductStockSummaries } from '@/lib/server/sales/batchStockService';
import { buildSalesCatalogQuery } from '@/lib/server/sales/catalogQueryBuilder';
import { getInStockProductIds } from '@/lib/server/sales/stockFilterService';
import {
  getListPricePaise,
  getMinAllowedPricePaise,
  toPaise,
} from '@/lib/server/sales/pricing';

export async function searchSalesCatalog({
  q = '',
  page = 1,
  limit = 24,
  sort = 'title',
  brands = '',
  priceMin,
  priceMax,
  stock = 'all',
  category = '',
}) {
  const needsStockIds = ['in_stock', 'out'].includes(String(stock).toLowerCase());
  const inStockIds = needsStockIds ? await getInStockProductIds() : null;

  const query = await buildSalesCatalogQuery({
    q,
    brands,
    priceMin,
    priceMax,
    stock,
    category,
    inStockIds,
  });

  const skip = (page - 1) * limit;

  let sortSpec = { title: 1 };
  if (sort === 'price_asc') sortSpec = { sellingPrice: 1 };
  if (sort === 'price_desc') sortSpec = { sellingPrice: -1 };

  const [products, total] = await Promise.all([
    Product.find(query)
      .select(
        'title slug sku barcode brand heroImage stockUnit mrp sellingPrice price maxDiscountPercent moneyInPaise categoryId parentProductId productType'
      )
      .populate('categoryId', 'name')
      .sort(sortSpec)
      .skip(skip)
      .limit(limit)
      .lean(),
    Product.countDocuments(query),
  ]);

  const productIds = products.map((p) => p._id);
  const stockMap = await getBatchProductStockSummaries(productIds);

  const items = products.map((p) => {
    const pid = String(p._id);
    const stockRow = stockMap.get(pid) || {
      sellableQty: 0,
      holdQty: 0,
      stockStatus: 'out',
      primaryLocationId: null,
    };
    const listPricePaise = getListPricePaise(p);
    const maxDiscountPercent = p.maxDiscountPercent ?? 0;
    const minOfferPricePaise = getMinAllowedPricePaise(listPricePaise, maxDiscountPercent);

    return {
      id: pid,
      title: p.title,
      slug: p.slug,
      sku: p.sku || '',
      barcode: p.barcode || '',
      brand: p.brand || '',
      heroImage: p.heroImage || '',
      stockUnit: p.stockUnit || 'Pcs',
      categoryName: p.categoryId?.name || '',
      sellableQty: stockRow.sellableQty,
      holdQty: stockRow.holdQty,
      stockStatus: stockRow.stockStatus,
      primaryLocationId: stockRow.primaryLocationId,
      listPricePaise,
      maxDiscountPercent,
      minOfferPricePaise,
      mrpPaise: toPaise(p, 'mrp'),
    };
  });

  if (sort === 'availability') {
    items.sort((a, b) => b.sellableQty - a.sellableQty);
  }

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}
