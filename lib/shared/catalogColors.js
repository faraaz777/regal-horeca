/**
 * Canonical storefront color names (admin picker + catalog filters).
 */

export const CATALOG_PREDEFINED_COLORS = [
  'Blue',
  'Green',
  'Red',
  'Yellow',
  'Purple',
  'Orange',
  'Pink',
  'Brown',
  'Gray',
  'Black',
  'White',
  'Silver',
  'Transparent',
  'Multicolour',
  'Gold',
  'Rose Gold',
  'Beige',
];

const LOWER_TO_CANONICAL = Object.fromEntries(
  CATALOG_PREDEFINED_COLORS.map((name) => [name.toLowerCase(), name])
);

/** Map any casing/spacing variant to the canonical filter name, or '' if not predefined. */
export function canonicalizeCatalogColorName(name) {
  const key = String(name ?? '').trim().toLowerCase();
  if (!key) return '';
  return LOWER_TO_CANONICAL[key] || '';
}

export function isCatalogPredefinedColor(name) {
  return Boolean(canonicalizeCatalogColorName(name));
}

/** Hex values for catalog filter swatches (keys are lowercase). */
export const CATALOG_COLOR_HEX_MAP = {
  blue: '#3B82F6',
  green: '#10B981',
  red: '#EF4444',
  yellow: '#F59E0B',
  purple: '#8B5CF6',
  orange: '#F97316',
  pink: '#EC4899',
  brown: '#92400E',
  gray: '#6B7280',
  grey: '#6B7280',
  black: '#121212',
  white: '#FAFAF9',
  silver: '#9CA3AF',
  transparent: '#FFFFFF',
  multicolour: '#888888',
  gold: '#D4AF37',
  'rose gold': '#B76E79',
  beige: '#F5F5DC',
};

export function getCatalogColorHex(colorName) {
  const key = String(colorName ?? '').trim().toLowerCase();
  return CATALOG_COLOR_HEX_MAP[key] || '#CCCCCC';
}

export function getCatalogColorSwatchStyle(colorName) {
  const key = String(colorName ?? '').trim().toLowerCase();
  if (key === 'transparent') {
    return {
      backgroundColor: '#FFFFFF',
      backgroundImage:
        'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%)',
      backgroundSize: '6px 6px',
      backgroundPosition: '0 0, 3px 3px',
    };
  }
  if (key === 'multicolour') {
    return {
      backgroundImage: 'linear-gradient(to bottom right, #ef4444, #facc15, #3b82f6)',
    };
  }
  return { backgroundColor: getCatalogColorHex(colorName) };
}
