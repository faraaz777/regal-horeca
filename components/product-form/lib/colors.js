/**
 * Catalog colour swatches + display resolution.
 *
 * Marketing colours (parent colorVariants) and SKU Colour (child variationAttributes)
 * share this palette so hex/swatch stay consistent after save.
 */

export const AVAILABLE_COLORS = [
  { name: 'Blue', hex: '#0000FF' },
  { name: 'Green', hex: '#008000' },
  { name: 'Red', hex: '#FF0000' },
  { name: 'Yellow', hex: '#FFFF00' },
  { name: 'Purple', hex: '#800080' },
  { name: 'Orange', hex: '#FFA500' },
  { name: 'Pink', hex: '#FFC0CB' },
  { name: 'Brown', hex: '#A52A2A' },
  { name: 'Gray', hex: '#808080' },
  { name: 'Black', hex: '#000000' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Silver', hex: '#C0C0C0' },
  { name: 'Transparent', hex: '#FFFFFF', swatch: 'transparent' },
  { name: 'Multicolour', hex: '#888888', swatch: 'multicolour' },
  { name: 'Gold', hex: '#D4AF37' },
  { name: 'Rose Gold', hex: '#B76E79' },
  { name: 'Beige', hex: '#F5F5DC' },
];

export function getPredefinedColorSwatchClassName(color) {
  if (color?.swatch === 'transparent') {
    return 'bg-[length:6px_6px] bg-[position:0_0,3px_3px] bg-[image:linear-gradient(45deg,#ccc_25%,transparent_25%),linear-gradient(-45deg,#ccc_25%,transparent_25%)]';
  }
  if (color?.swatch === 'multicolour') {
    return 'bg-gradient-to-br from-red-500 via-yellow-400 to-blue-500';
  }
  return '';
}

export function resolveColorDisplay(nameOrObj, colorVariants = []) {
  if (!nameOrObj) return null;
  const trimmed = String(
    typeof nameOrObj === 'object'
      ? (nameOrObj.colorName || nameOrObj.color || nameOrObj.name || '')
      : nameOrObj || ''
  ).trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  const predefined = AVAILABLE_COLORS.find((c) => c.name.toLowerCase() === lower);
  if (predefined) {
    return {
      colorName: predefined.name,
      colorHex: predefined.hex,
      swatch: predefined.swatch,
    };
  }
  const fromVariants = (colorVariants || []).find(
    (v) => String(v?.colorName || '').trim().toLowerCase() === lower
  );
  if (fromVariants) {
    return {
      colorName: fromVariants.colorName,
      colorHex: fromVariants.colorHex,
      swatch: fromVariants.swatch,
    };
  }
  if (typeof nameOrObj === 'object' && nameOrObj.colorHex) {
    return {
      colorName: trimmed,
      colorHex: nameOrObj.colorHex,
      swatch: nameOrObj.swatch || nameOrObj.colorSwatch || undefined,
    };
  }
  return {
    colorName: trimmed,
    colorHex: '#CCCCCC',
    swatch: undefined,
  };
}
