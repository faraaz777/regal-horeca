import 'server-only';

import {
  getMinAllowedPricePaise,
  getNegotiablePercent,
  toDisplayNegotiablePercent,
} from '@/lib/shared/salesPricing';

/**
 * Strip internal floor fields before a payload leaves the sales APIs.
 * Margin stays on Product / bucket documents for server validation only.
 */
export function presentSalesLine(line) {
  if (!line) return line;
  const raw = typeof line.toObject === 'function' ? line.toObject() : { ...line };
  const {
    marginPricePaise,
    minOfferPricePaise,
    maxDiscountPercent,
    ...rest
  } = raw;

  const list = Number(rest.listPricePaise) || 0;
  const storedMin = Number(minOfferPricePaise) || 0;
  const min =
    storedMin > 0 ? storedMin : getMinAllowedPricePaise(list, marginPricePaise);

  return {
    ...rest,
    negotiablePercent: toDisplayNegotiablePercent(getNegotiablePercent(list, min)),
  };
}

export function presentSalesBucket(bucket) {
  if (!bucket) return bucket;
  const raw = typeof bucket.toObject === 'function' ? bucket.toObject() : { ...bucket };
  return {
    ...raw,
    lines: (raw.lines || []).map(presentSalesLine),
  };
}

export function presentSalesRequest(request) {
  if (!request) return request;
  const raw = typeof request.toObject === 'function' ? request.toObject() : { ...request };
  return {
    ...raw,
    lines: (raw.lines || []).map(presentSalesLine),
  };
}
