/**
 * Client-safe sales pricing helpers.
 *
 * MAX DISCOUNT % (Product.discountPercent, else leftover maxDiscountPercent)
 * is a cap from MRP, not a second cut on selling.
 *
 * Floor = MRP × (1 − max%). If that is selling or higher, no extra room.
 * Sales sees only leftover % under selling — never the rupee floor.
 *
 * MRP ₹1,000, selling ₹700, max 30% → floor ₹700, no negotiation.
 * Same prices, max 40% → floor ₹600, "Up to ~14.2%" under selling.
 * Margin price is owner-only and is not used here.
 */

export const OFFER_BELOW_RANGE_ERROR =
  'Offer is below the allowed negotiation range.';

export function clampDiscountPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(100, n);
}

/**
 * MAX DISCOUNT % from the product form column, then the leftover inventory field.
 */
export function getProductMaxDiscountPercent(product) {
  const fromColumn = clampDiscountPercent(product?.discountPercent);
  if (fromColumn > 0) return fromColumn;
  return clampDiscountPercent(product?.maxDiscountPercent);
}

/**
 * Lowest price a salesman may offer.
 * Applies MAX DISCOUNT % to MRP, then never above selling (list).
 * Missing MRP or zero max % → no extra room (floor = selling).
 */
export function getMinAllowedPricePaise(
  listPricePaise,
  maxDiscountPercent,
  mrpPricePaise = 0
) {
  const list = Math.max(0, Number(listPricePaise) || 0);
  const mrp = Math.max(0, Number(mrpPricePaise) || 0);
  const maxDisc = clampDiscountPercent(maxDiscountPercent);
  if (list === 0) return 0;
  if (maxDisc === 0 || mrp === 0) return list;

  const floorFromMrp = Math.ceil(mrp * (1 - maxDisc / 100));
  if (floorFromMrp >= list) return list;
  return Math.max(0, floorFromMrp);
}

/** Leftover % from selling (list) down to the MRP-based floor. */
export function getNegotiablePercent(listPricePaise, minOfferPricePaise) {
  const list = Math.max(0, Number(listPricePaise) || 0);
  const min = Math.max(0, Number(minOfferPricePaise) || 0);
  if (list <= 0 || min >= list) return 0;
  return Math.round((1 - min / list) * 10000) / 100;
}

/**
 * One decimal, rounded down so the salesman never thinks they have more room
 * than the floor allows (10.82% → 10.8%).
 */
export function toDisplayNegotiablePercent(percent) {
  const n = Math.max(0, Number(percent) || 0);
  if (n <= 0) return 0;
  return Math.floor(n * 10) / 10;
}

/**
 * Validate offered rate against the MRP-based max-discount floor.
 * Returns { ok, error?, minAllowedPaise, discountPercent? }.
 */
export function validateOfferedRate({
  listPricePaise,
  maxDiscountPercent,
  mrpPaise,
  offeredRatePaise,
}) {
  const list = Math.max(0, Number(listPricePaise) || 0);
  const offered = Math.max(0, Number(offeredRatePaise) || 0);

  if (list === 0) {
    return { ok: true, minAllowedPaise: 0, discountPercent: 0 };
  }

  const minAllowed = getMinAllowedPricePaise(
    list,
    maxDiscountPercent,
    mrpPaise
  );
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
