/**
 * Variant matrix row → child product payload (client save + server routes).
 */

export const CHILD_VARIATION_KEYS = ['size', 'color', 'weight', 'unitCount', 'unit'];

/** Fields owned by the parent Variants section — not editable on direct child save. */
export const CHILD_VARIANT_OWNED_FIELDS = [
  'title',
  'sku',
  'barcode',
  'hsnCode',
  'gstPercent',
  'mrp',
  'sellingPrice',
  'discountPercent',
  'marginPrice',
  'price',
  'priceBySize',
  'variants',
  'variationTheme',
  'variationAttributes',
  'heroImage',
  'gallery',
  'colorVariants',
  'showInCatalog',
  'visibleOnClient',
];

function normalizeBarcode(value) {
  return String(value ?? '').trim();
}

export function sanitizeChildVariationAttributes(input) {
  const out = {};
  CHILD_VARIATION_KEYS.forEach((k) => {
    out[k] = String(input?.[k] ?? '').trim();
  });
  return out;
}

export function deriveChildTitle(parentTitle, attrs, explicitName = '') {
  const name = String(explicitName || '').trim();
  if (name) return name;

  const tail = ['size', 'color', 'weight', 'unitCount', 'unit']
    .map((k) => String(attrs?.[k] || '').trim())
    .filter(Boolean)
    .join(' / ');
  const base = String(parentTitle || '').trim() || 'Product';
  if (!tail) return base;
  return `${base} - ${tail}`;
}

export function buildChildPayloadFromVariantRow(row, { parent, variationTheme } = {}) {
  const variationAttributes = sanitizeChildVariationAttributes({
    size: row?.size,
    color: row?.color,
    weight: row?.weight,
    unitCount: row?.unitCount,
    unit: row?.unit,
  });

  const images = Array.isArray(row?.images) ? row.images.filter(Boolean) : [];
  const sellingPrice = Number(row?.sellingPrice ?? row?.price ?? 0);

  return {
    title: deriveChildTitle(parent?.title, variationAttributes, row?.name),
    variationAttributes,
    sku: String(row?.sku || '').trim(),
    barcode: normalizeBarcode(row?.barcode),
    hsnCode: String(row?.hsnCode || '').trim(),
    gstPercent: Number(row.gstPercent || 0),
    mrp: Number(row?.mrp || 0),
    sellingPrice,
    discountPercent: Number(row?.discountPercent || 0),
    marginPrice: Number(row?.marginPrice || 0),
    price: Number(row?.price ?? sellingPrice ?? 0),
    images,
    heroImage: images[0] || '',
    visibleOnClient: row?.visibleOnClient !== false,
    showInCatalog: row?.showInCatalog === true,
    isDefault: Boolean(row?.isDefault),
    legacyParentVariantId: String(row?._legacyParentVariantId || row?.variantId || '').trim(),
    ...(Array.isArray(variationTheme) && variationTheme.length > 0 ? { variationTheme } : {}),
  };
}

export function stripChildVariantOwnedFields(updateData) {
  if (!updateData || typeof updateData !== 'object') return updateData;
  CHILD_VARIANT_OWNED_FIELDS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(updateData, key)) {
      delete updateData[key];
    }
  });
  return updateData;
}
