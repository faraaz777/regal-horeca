import 'server-only';

import { getNegotiablePercent, toDisplayNegotiablePercent } from '@/lib/shared/salesPricing';

/**
 * Strip rupee-floor fields before a payload leaves the sales APIs.
 * Sales sees leftover % under selling only (negotiablePercent).
 */
export function presentSalesLine(line) {
  if (!line) return line;
  const raw = typeof line.toObject === 'function' ? line.toObject() : { ...line };
  const list = Number(raw.listPricePaise) || 0;
  const storedMin = Number(raw.minOfferPricePaise) || 0;
  const min = storedMin > 0 ? storedMin : list;

  delete raw.marginPricePaise;
  delete raw.minOfferPricePaise;
  delete raw.maxDiscountPercent;

  return {
    ...raw,
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
