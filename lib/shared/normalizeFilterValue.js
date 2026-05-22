/**
 * Normalize a single filter value to title case (first letter upper, rest lower).
 * Used so sidebar filters and product queries match regardless of how the value was entered.
 *
 * @param {string} value - Raw value (e.g. "stainless steel", "PORCELAIN")
 * @returns {string} Normalized value (e.g. "Stainless steel", "Porcelain")
 */
export function normalizeFilterValue(value) {
  if (value == null || typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

/**
 * Normalize an array of filter values to title case.
 *
 * @param {string[]} values - Array of raw values
 * @returns {string[]} Array of normalized values
 */
export function normalizeFilterValues(values) {
  if (!Array.isArray(values)) return values;
  return values.map((v) => normalizeFilterValue(v)).filter((v) => v != null && String(v).trim() !== '');
}
