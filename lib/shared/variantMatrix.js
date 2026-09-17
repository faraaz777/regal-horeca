/**
 * Variant matrix helpers for the product form.
 *
 * Shape is never a variant axis. Size, Colour, Weight, and Unit Count are —
 * at most two at once. Generate builds a cartesian product of the selected
 * axes (1 axis → m rows; 2 axes → m×n rows).
 */

export const VARIANT_AXIS_KEYS = ['size', 'color', 'weight', 'unitCount'];

export const EMPTY_VARIANT_FIELD_SELECTION = Object.freeze({
  size: false,
  color: false,
  weight: false,
  unitCount: false,
});

/**
 * Parse chip / comma-separated option strings into unique trimmed values
 * (case-insensitive dedupe, first spelling wins).
 */
export function parseOptionValues(raw) {
  const seen = new Set();
  const out = [];
  for (const part of String(raw || '').split(',')) {
    const value = part.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

/**
 * Stable combo key used to merge regenerate with existing SKU rows.
 */
export function getVariantCombinationKey(combo = {}) {
  return [combo.size || '', combo.color || '', combo.weight || '', combo.unitCount || '']
    .map((value) => String(value).toLowerCase())
    .join('|');
}

/**
 * Cartesian product of 1–2 axis dimensions.
 *
 * Input:  [{ key: 'size', values: ['S','M'] }, { key: 'color', values: ['Red'] }]
 * Output: [{ size: 'S', color: 'Red' }, { size: 'M', color: 'Red' }]
 *
 * One axis alone yields m rows (not an error). Zero axes yields [].
 */
export function buildVariantCombinations(dimensions = []) {
  const dims = (Array.isArray(dimensions) ? dimensions : [])
    .map((dim) => ({
      key: dim?.key,
      values: Array.isArray(dim?.values)
        ? dim.values.map((v) => String(v ?? '').trim()).filter(Boolean)
        : [],
    }))
    .filter((dim) => dim.key && dim.values.length > 0);

  if (dims.length === 0) return [];
  if (dims.length > 2) {
    throw new Error('Variant matrix supports at most 2 axes.');
  }

  return dims.reduce(
    (acc, dim) => acc.flatMap((base) => dim.values.map((value) => ({ ...base, [dim.key]: value }))),
    [{}]
  );
}

/**
 * When the operator adds a blank SKU row with no axes ticked, Size and Colour
 * must appear in the table so those mandatory fields can be filled.
 * If axes are already selected, keep them — do not override weight/unitCount.
 */
export function ensureBlankRowVariantFieldSelection(selection = {}) {
  const next = {
    size: Boolean(selection.size),
    color: Boolean(selection.color),
    weight: Boolean(selection.weight),
    unitCount: Boolean(selection.unitCount),
  };
  const selectedCount = VARIANT_AXIS_KEYS.filter((key) => next[key]).length;
  if (selectedCount > 0) return next;
  return { ...EMPTY_VARIANT_FIELD_SELECTION, size: true, color: true };
}

/**
 * Infer which columns to show when loading an existing parent.
 * Prefer saved variationTheme; fall back to non-empty row attribute values.
 */
export function inferVariantFieldSelection({ rows = [], variationTheme = [] } = {}) {
  const theme = Array.isArray(variationTheme)
    ? variationTheme.map((t) => String(t || '').trim().toLowerCase()).filter(Boolean)
    : [];

  const fromTheme = {
    size: theme.includes('size'),
    color: theme.includes('color') || theme.includes('colour'),
    weight: theme.includes('weight'),
    unitCount: theme.includes('unitcount') || theme.includes('unit_count') || theme.includes('unit count'),
  };

  if (VARIANT_AXIS_KEYS.some((key) => fromTheme[key])) {
    return fromTheme;
  }

  const list = Array.isArray(rows) ? rows : [];
  return {
    size: list.some((row) => String(row?.size || '').trim()),
    color: list.some((row) => String(row?.color || '').trim()),
    weight: list.some((row) => String(row?.weight || '').trim()),
    unitCount: list.some((row) => String(row?.unitCount || '').trim()),
  };
}

/**
 * Rebuild chip input strings from existing variant rows (edit hydrate).
 */
export function buildVariantBuilderInputsFromRows(rows = []) {
  const uniqueFor = (field) => {
    const seen = new Set();
    const values = [];
    for (const row of rows || []) {
      const value = String(row?.[field] || '').trim();
      if (!value) continue;
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      values.push(value);
    }
    return values.join(', ');
  };

  return {
    size: uniqueFor('size'),
    color: uniqueFor('color'),
    weight: uniqueFor('weight'),
    unitCount: uniqueFor('unitCount'),
  };
}

/**
 * Selected axes must be filled on every surviving variant row.
 * Returns a human-readable error or null when valid.
 */
export function validateVariantRowsAgainstAxes(rows = [], selection = {}) {
  const required = VARIANT_AXIS_KEYS.filter((key) => selection?.[key]);
  if (required.length === 0) return null;

  const labels = {
    size: 'Size',
    color: 'Colour',
    weight: 'Weight',
    unitCount: 'Unit Count',
  };

  for (let i = 0; i < (rows || []).length; i += 1) {
    const row = rows[i] || {};
    const missing = required.filter((key) => !String(row[key] || '').trim());
    if (missing.length === 0) continue;
    const labelList = missing.map((key) => labels[key] || key).join(' and ');
    const summary =
      [row.size, row.color, row.weight, row.unitCount].map((v) => String(v || '').trim()).filter(Boolean).join(' / ') ||
      String(row.name || '').trim() ||
      String(row.sku || '').trim() ||
      `row ${i + 1}`;
    return `Variant "${summary}" is missing ${labelList}. Fill every selected axis on each row.`;
  }

  return null;
}
