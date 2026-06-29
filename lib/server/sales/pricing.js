import 'server-only';

import Product from '@/lib/models/Product';

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

/** Lowest price salesman may offer after applying max discount %. */
export function getMinAllowedPricePaise(listPricePaise, maxDiscountPercent) {
  const list = Math.max(0, Number(listPricePaise) || 0);
  const maxDisc = Math.min(100, Math.max(0, Number(maxDiscountPercent) || 0));
  if (list === 0) return 0;
  return Math.ceil(list * (1 - maxDisc / 100));
}

export function getCostPricePaise(product) {
  return toPaise(product, 'costPrice');
}

/**
 * Validate offered rate against max discount. Returns { ok, error?, minAllowedPaise }.
 */
export function validateOfferedRate({ listPricePaise, maxDiscountPercent, offeredRatePaise }) {
  const list = Math.max(0, Number(listPricePaise) || 0);
  const maxDisc = Math.min(100, Math.max(0, Number(maxDiscountPercent) || 0));
  const offered = Math.max(0, Number(offeredRatePaise) || 0);

  if (list === 0) {
    return { ok: true, minAllowedPaise: 0 };
  }

  const minAllowed = getMinAllowedPricePaise(list, maxDisc);
  if (offered < minAllowed) {
    return {
      ok: false,
      minAllowedPaise: minAllowed,
      error: `Offered rate cannot be below ₹${(minAllowed / 100).toFixed(2)} (max ${maxDisc}% discount)`,
    };
  }

  const discountPercent = Math.round((1 - offered / list) * 10000) / 100;
  return { ok: true, minAllowedPaise: minAllowed, discountPercent };
}

export async function loadProductForSales(productId) {
  const product = await Product.findOne({
    _id: productId,
    deletedAt: null,
    productType: { $in: ['standalone', 'child'] },
  })
    .select(
      'title slug sku barcode brand mrp sellingPrice price maxDiscountPercent moneyInPaise heroImage stockUnit productStatus'
    )
    .lean();

  if (!product) return null;
  return product;
}
