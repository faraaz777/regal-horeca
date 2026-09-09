/**
 * Shared variant/color picker helpers (storefront PDP + sales detail modal).
 */

import { canonicalizeCatalogColorName, getCatalogColorHex } from '@/lib/shared/catalogColors';

export function normalizeVariantAttr(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function filterVariantsByColor(variants, selectedColor) {
  const list = Array.isArray(variants) ? variants : [];
  const colorName = normalizeVariantAttr(selectedColor?.colorName);
  if (!colorName) return list;
  return list.filter((v) => normalizeVariantAttr(v?.color) === colorName);
}

export function variantsHaveSecondaryDimension(variants) {
  const list = Array.isArray(variants) ? variants : [];
  if (list.length <= 1) return false;
  const keys = new Set();
  for (const v of list) {
    const label =
      normalizeVariantAttr(v?.size) ||
      normalizeVariantAttr(v?.weight) ||
      normalizeVariantAttr(v?.unitCount) ||
      normalizeVariantAttr(v?.sku);
    if (label) keys.add(label);
  }
  return keys.size > 1;
}

export function variantChipLabel(variant, index = 0) {
  return (
    String(variant?.size || '').trim() ||
    String(variant?.weight || '').trim() ||
    String(variant?.unitCount || '').trim() ||
    String(variant?.sku || '').trim() ||
    `Option ${index + 1}`
  );
}

export function buildColorVariantsForPicker(colorVariants, variants) {
  const palette = Array.isArray(colorVariants) ? colorVariants : [];
  const variantList = Array.isArray(variants) ? variants : [];
  if (variantList.length === 0) return palette;

  const colorsInStock = new Set(
    variantList.map((v) => normalizeVariantAttr(v?.color)).filter(Boolean)
  );
  if (colorsInStock.size === 0) return palette;

  const matched = palette.filter((cv) =>
    colorsInStock.has(normalizeVariantAttr(cv?.colorName))
  );
  const matchedKeys = new Set(matched.map((cv) => normalizeVariantAttr(cv?.colorName)));

    const extras = [...colorsInStock]
      .filter((key) => !matchedKeys.has(key))
      .map((key) => {
        const canonical = canonicalizeCatalogColorName(key) || key;
        const fromPalette = palette.find(
          (cv) => normalizeVariantAttr(cv?.colorName) === normalizeVariantAttr(canonical)
        );
        if (fromPalette) return fromPalette;

        // Check if any variant with this color has a stored colorHex / colorDetails
        const matchingVariant = variantList.find(
          (v) => normalizeVariantAttr(v?.color) === key
        );
        const storedHex =
          matchingVariant?.colorHex ||
          matchingVariant?.colorDetails?.colorHex ||
          matchingVariant?.variationAttributes?.colorHex ||
          matchingVariant?.variationAttributes?.colorDetails?.colorHex;
        const storedSwatch =
          matchingVariant?.colorSwatch ||
          matchingVariant?.colorDetails?.swatch ||
          matchingVariant?.variationAttributes?.colorSwatch ||
          matchingVariant?.variationAttributes?.colorDetails?.swatch;

        return {
          colorName: canonical,
          colorHex: storedHex || getCatalogColorHex(canonical),
          swatch: storedSwatch || '',
          isDefault: false,
        };
      });

  return [...matched, ...extras];
}
