/**
 * Client-safe sales pricing helpers.
 *
 * Wholesale offered rates must stay at or above Product.marginPrice.
 * Missing/zero margin means no negotiation — floor equals list price.
 * Server validates the same rules in lib/server/sales/pricing.js.
 *
 * Sales UI must never show the rupee floor — only a derived negotiation %.
 */

export const OFFER_BELOW_RANGE_ERROR =
  'Offer is below the allowed negotiation range.';

/**
 * Lowest price a salesman may offer.
 * Margin is the floor when it is set and not above list; otherwise list.
 */
export function getMinAllowedPricePaise(listPricePaise, marginPricePaise) {
  const list = Math.max(0, Number(listPricePaise) || 0);
  const margin = Math.max(0, Number(marginPricePaise) || 0);
  if (list === 0) return 0;
  if (margin > 0 && margin <= list) return Math.ceil(margin);
  return list;
}

/** Derived % from list down to the margin floor. Not a stored Product field. */
export function getNegotiablePercent(listPricePaise, minOfferPricePaise) {
  const list = Math.max(0, Number(listPricePaise) || 0);
  const min = Math.max(0, Number(minOfferPricePaise) || 0);
  if (list <= 0 || min >= list) return 0;
  return Math.round((1 - min / list) * 10000) / 100;
}

/**
 * One decimal, rounded down so the salesman never thinks they have more room
 * than the real margin floor allows (10.82% → 10.8%).
 */
export function toDisplayNegotiablePercent(percent) {
  const n = Math.max(0, Number(percent) || 0);
  if (n <= 0) return 0;
  return Math.floor(n * 10) / 10;
}

/**
 * Validate offered rate against margin floor.
 * Returns { ok, error?, minAllowedPaise, discountPercent? }.
 */
export function validateOfferedRate({ listPricePaise, marginPricePaise, offeredRatePaise }) {
  const list = Math.max(0, Number(listPricePaise) || 0);
  const margin = Math.max(0, Number(marginPricePaise) || 0);
  const offered = Math.max(0, Number(offeredRatePaise) || 0);

  if (list === 0) {
    return { ok: true, minAllowedPaise: 0, discountPercent: 0 };
  }

  const minAllowed = getMinAllowedPricePaise(list, margin);
  if (offered < minAllowed) {
    return {
      ok: false,
      minAllowedPaise: minAllowed,
      error: OFFER_BELOW_RANGE_ERROR,
    };
  }

  const discountPercent = Math.round((1 - offered / list) * 10000) / 100;
  return { ok: true, minAllowedPaise: minAllowed, discountPercent };
}

export function paiseToRupeesString(paise) {
  return ((Number(paise) || 0) / 100).toFixed(2);
}

export function rupeesStringToPaise(rupeesStr) {
  const n = Number(String(rupeesStr).replace(/,/g, '').trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function lineTotalPaise(line) {
  return (Number(line.offeredRatePaise) || 0) * (Number(line.quantity) || 0);
}

export function quoteGrandTotalPaise(lines = []) {
  return lines.reduce((sum, line) => sum + lineTotalPaise(line), 0);
}
