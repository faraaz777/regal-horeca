import 'server-only';

import Product from '@/lib/models/Product';
import {
  getMinAllowedPricePaise,
  getNegotiablePercent,
  getProductMaxDiscountPercent,
  toDisplayNegotiablePercent,
  validateOfferedRate,
} from '@/lib/shared/salesPricing';

export {
  getMinAllowedPricePaise,
  getNegotiablePercent,
  getProductMaxDiscountPercent,
  toDisplayNegotiablePercent,
  validateOfferedRate,
};

/** Normalize product monetary fields to paise for sales calculations. */
export function toPaise(product, field) {
  const raw = Number(product?.[field] ?? 0);
  if (!raw) return 0;
  return product?.moneyInPaise ? raw : Math.round(raw * 100);
}

export function getListPricePaise(product) {
  const selling = toPaise(product, 'sellingPrice');
  const price = toPaise(product, 'price');
  const mrp = toPaise(product, 'mrp');
  return selling || price || mrp || 0;
}

export function getCostPricePaise(product) {
  return toPaise(product, 'costPrice');
}

/**
 * List / max-discount snapshot for catalog cards, detail, and quote lines.
 * Floor = MRP × (1 − MAX DISCOUNT %), capped at selling.
 * Sales sees leftover % under selling only.
 */
export function getProductSalesPricing(product) {
  const listPricePaise = getListPricePaise(product);
  const mrpPaise = toPaise(product, 'mrp');
  const maxDiscountPercent = getProductMaxDiscountPercent(product);
  const minOfferPricePaise = getMinAllowedPricePaise(
    listPricePaise,
    maxDiscountPercent,
    mrpPaise
  );
  const negotiablePercent = toDisplayNegotiablePercent(
    getNegotiablePercent(listPricePaise, minOfferPricePaise)
  );
  return {
    listPricePaise,
    mrpPaise,
    maxDiscountPercent,
    minOfferPricePaise,
    negotiablePercent,
  };
}

/**
 * Children often have no hero of their own — same fallback as inventory listings.
 */
export function resolveSalesHeroImage(product) {
  if (product?.heroImage?.trim()) return product.heroImage.trim();
  const galleryImage = Array.isArray(product?.gallery) ? product.gallery.find(Boolean) : '';
  if (galleryImage) return String(galleryImage).trim();
  const parent = product?.parentProductId;
  if (parent && typeof parent === 'object') {
    if (parent.heroImage?.trim()) return parent.heroImage.trim();
    const parentGallery = Array.isArray(parent.gallery) ? parent.gallery.find(Boolean) : '';
    if (parentGallery) return String(parentGallery).trim();
  }
  return '';
}

export async function loadProductForSales(productId) {
  const product = await Product.findOne({
    _id: productId,
    deletedAt: null,
    productType: { $in: ['standalone', 'child'] },
  })
    .select(
      'title slug sku barcode brand mrp sellingPrice price discountPercent maxDiscountPercent moneyInPaise heroImage gallery parentProductId stockUnit productStatus'
    )
    .populate('parentProductId', 'heroImage gallery')
    .lean();

  if (!product) return null;
  return { ...product, heroImage: resolveSalesHeroImage(product) };
}
