import 'server-only';

import mongoose from 'mongoose';
import Product from '@/lib/models/Product';
import Stock from '@/lib/models/Stock';
import Location from '@/lib/models/Location';
import Category from '@/lib/models/Category';
import { salesCatalogBaseFilter } from '@/lib/server/sales/catalogSearch';
import { getBatchProductStockSummaries } from '@/lib/server/sales/batchStockService';
import { resolveProduct, getSiblingChildren } from '@/lib/server/products/resolveProduct';
import {
  getListPricePaise,
  getMinAllowedPricePaise,
  toPaise,
} from '@/lib/server/sales/pricing';

function collectImageUrls(product) {
  const urls = [];
  const add = (url) => {
    const u = String(url || '').trim();
    if (u && !urls.includes(u)) urls.push(u);
  };
  add(product?.heroImage);
  if (Array.isArray(product?.gallery)) product.gallery.forEach(add);
  if (Array.isArray(product?.images)) product.images.forEach(add);
  return urls;
}

async function getStockByLocation(productId) {
  const pid = new mongoose.Types.ObjectId(String(productId));

  const stockRows = await Stock.find({
    productId: pid,
    qty: { $gt: 0 },
    statusBucket: 'sellable',
  })
    .select('locationId qty')
    .lean();

  const byLocation = new Map();

  for (const row of stockRows) {
    const lid = String(row.locationId);
    byLocation.set(lid, (byLocation.get(lid) || 0) + (row.qty || 0));
  }

  if (byLocation.size === 0) return [];

  const locationIds = [...byLocation.keys()];
  const locations = await Location.find({
    _id: { $in: locationIds.map((id) => new mongoose.Types.ObjectId(id)) },
  })
    .select('name code')
    .lean();

  const locMap = new Map(locations.map((l) => [String(l._id), l]));

  return [...byLocation.entries()]
    .map(([locationId, sellableQty]) => {
      const loc = locMap.get(locationId);
      return {
        locationId,
        name: loc?.name || 'Unknown location',
        code: loc?.code || '',
        sellableQty,
        holdQty: 0,
      };
    })
    .filter((row) => row.sellableQty > 0)
    .sort((a, b) => b.sellableQty - a.sellableQty);
}

function mapChildVariant(child, stockMap) {
  const pid = String(child._id);
  const attrs = child.variationAttributes || {};
  const stock = stockMap.get(pid) || { sellableQty: 0, holdQty: 0, stockStatus: 'out' };
  const listPricePaise = getListPricePaise(child);
  const maxDiscountPercent = child.maxDiscountPercent ?? 0;

  return {
    id: pid,
    title: child.title,
    sku: child.sku || '',
    barcode: child.barcode || '',
    color: attrs.color || child.colour || '',
    size: attrs.size || '',
    weight: attrs.weight || '',
    unitCount: attrs.unitCount || '',
    unit: attrs.unit || '',
    mrpPaise: toPaise(child, 'mrp'),
    sellingPricePaise: toPaise(child, 'sellingPrice') || toPaise(child, 'price'),
    listPricePaise,
    maxDiscountPercent,
    minOfferPricePaise: getMinAllowedPricePaise(listPricePaise, maxDiscountPercent),
    sellableQty: stock.sellableQty,
    stockStatus: stock.stockStatus,
    heroImage: child.heroImage || '',
  };
}

function mapProductCore(resolved, productId, stockSummary) {
  const listPricePaise = getListPricePaise(resolved);
  const maxDiscountPercent = resolved.maxDiscountPercent ?? 0;
  const isDeadStock = Boolean(stockSummary.isDeadStock || stockSummary.deadStockMarked);

  return {
    id: String(productId),
    title: resolved.title,
    slug: resolved.slug,
    sku: resolved.sku || '',
    barcode: resolved.barcode || '',
    brand: resolved.brand || '',
    categoryName: '',
    stockUnit: resolved.stockUnit || 'Pcs',
    gstPercent: resolved.gstPercent ?? 0,
    sellableQty: stockSummary.sellableQty,
    isDeadStock,
    deadStockMarked: isDeadStock,
    condition: stockSummary.condition || 'NORMAL',
    stockStatus: stockSummary.stockStatus,
    images: collectImageUrls(resolved),
    mrpPaise: toPaise(resolved, 'mrp'),
    sellingPricePaise: toPaise(resolved, 'sellingPrice') || toPaise(resolved, 'price'),
    listPricePaise,
    maxDiscountPercent,
    minOfferPricePaise: getMinAllowedPricePaise(listPricePaise, maxDiscountPercent),
  };
}

export async function getSalesProductDetail(productId) {
  const base = salesCatalogBaseFilter();
  const raw = await Product.findOne({ ...base, _id: productId })
    .select('_id parentProductId productType')
    .lean();

  if (!raw) return null;

  const resolved = await resolveProduct(productId);
  if (!resolved) return null;

  const parentId =
    raw.parentProductId ||
    (raw.productType === 'parent' ? raw._id : null);

  const children = parentId ? await getSiblingChildren(parentId) : [];
  const siblingIds = children.map((c) => String(c._id));
  const stockMap = await getBatchProductStockSummaries([String(productId), ...siblingIds]);

  const stockSummary = stockMap.get(String(productId)) || {
    sellableQty: 0,
    holdQty: 0,
    stockStatus: 'out',
    isDeadStock: false,
    condition: 'NORMAL',
  };

  const stockLocations = await getStockByLocation(productId);

  let categoryName = resolved.categoryId?.name || '';
  if (!categoryName && resolved.categoryId) {
    const cat = await Category.findById(resolved.categoryId).select('name').lean();
    categoryName = cat?.name || '';
  }

  const variants = children.map((child) => mapChildVariant(child, stockMap));

  const colorVariants = (resolved.colorVariants || []).map((cv) => ({
    colorName: cv.colorName,
    colorHex: cv.colorHex,
    isDefault: Boolean(cv.isDefault),
  }));

  const specifications = (resolved.specifications || [])
    .filter((s) => s?.label && s?.value)
    .map((s) => ({ label: s.label, value: s.value }));

  return {
    ...mapProductCore(resolved, productId, stockSummary),
    categoryName,
    stockLocations,
    summary: resolved.summary || '',
    specifications,
    colorVariants,
    variants,
    hasVariants: variants.length > 0,
  };
}
