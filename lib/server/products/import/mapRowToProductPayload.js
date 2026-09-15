/**
 * Map a validated Excel product (+ optional variant rows) into the payload
 * ProductForm already hydrates from Duplicate — no _id, so Save creates.
 *
 * Do not set productType to parent here. The form treats embedded variants[]
 * as incoming SKU rows only when the document is not already a parent carrier.
 */

import { splitUrlList } from '@/lib/server/products/import/validateImportRows';

const KNOWN_COLOR_HEX = {
  blue: '#0000FF',
  green: '#008000',
  red: '#FF0000',
  yellow: '#FFFF00',
  purple: '#800080',
  orange: '#FFA500',
  pink: '#FFC0CB',
  brown: '#A52A2A',
  gray: '#808080',
  black: '#000000',
  white: '#FFFFFF',
  silver: '#C0C0C0',
  gold: '#D4AF37',
  beige: '#F5F5DC',
  'rose gold': '#B76E79',
};

function plainTextToHtml(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return '';
  return trimmed
    .split(/\n\n+/)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function titleCaseColor(name) {
  return String(name || '')
    .trim()
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function resolveColor(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return { colorName: '', colorHex: '', colorDetails: null };
  const hex = KNOWN_COLOR_HEX[trimmed.toLowerCase()] || '#CCCCCC';
  const colorName = titleCaseColor(trimmed);
  return {
    colorName,
    colorHex: hex,
    colorDetails: { colorName, colorHex: hex },
  };
}

function variantName(parentTitle, values) {
  const bits = [
    parentTitle,
    values.size,
    values.colour,
    values.weight,
    values.unit_count,
  ]
    .map((part) => String(part || '').trim())
    .filter(Boolean);
  return bits.join(' ').trim() || parentTitle;
}

export function mapRowToProductPayload(entry) {
  const v = entry.values;
  const r = entry.resolved;
  const sellingType = r.sellingType;
  const gallery = splitUrlList(v.gallery_urls).filter((url) => /^https?:\/\//i.test(url));
  const hero = String(v.hero_image_url || '').trim();

  const payload = {
    title: entry.title,
    brand: r.brandDisplayName || String(v.brand || '').trim(),
    brandCategoryId: r.brandCategoryId || '',
    brandCategoryIds: [],
    categoryId: r.categoryId || '',
    categoryIds: [],
    businessTypeSlugs: r.businessTypeSlugs || [],
    featured: Boolean(r.featured),
    summary: plainTextToHtml(v.summary),
    description: '',
    usageAndCare: '',
    whyBuyFrom: '',
    sku: sellingType === 'standalone' ? String(v.sku || '').trim() : '',
    barcode: sellingType === 'standalone' ? String(v.barcode || '').trim() : '',
    hsnCode: sellingType === 'standalone' ? String(v.hsn || '').trim() : '',
    gstPercent: sellingType === 'standalone' ? r.gst.value : 0,
    mrp: sellingType === 'standalone' ? r.mrp.value : 0,
    sellingPrice: sellingType === 'standalone' ? r.selling.value : 0,
    discountPercent: sellingType === 'standalone' ? r.discount.value : 0,
    marginPrice: sellingType === 'standalone' ? r.margin.value : 0,
    price: sellingType === 'standalone' ? r.selling.value : 0,
    unit: sellingType === 'standalone' ? String(v.unit || '').trim() : '',
    variationAttributes:
      sellingType === 'standalone' && String(v.unit || '').trim()
        ? { unit: String(v.unit || '').trim() }
        : {},
    heroImage: /^https?:\/\//i.test(hero) ? hero : '',
    gallery,
    blogUrl: String(v.blog_url || '').trim(),
    sizeChartUrl: '',
    brochureUrl: '',
    detailPhotos: [],
    specifications: [],
    faqs: [],
    testimonials: [],
    relatedProductIds: [],
    frequentlyOrderedTogetherProductIds: [],
    tags: [],
    tagsInput: '',
    filters: [
      { key: 'Material', values: [] },
      { key: 'Size', values: [] },
    ],
    colorVariants: [],
    variants: [],
    status: 'In Stock',
  };

  if (sellingType !== 'variants') {
    return payload;
  }

  const variantRows = entry.variantRows.map((row) => {
    const color = resolveColor(row.values.colour);
    const vr = row.resolved || {};
    return {
      name: variantName(entry.title, row.values),
      size: String(row.values.size || '').trim(),
      unit: String(row.values.unit || '').trim(),
      color: color.colorName,
      colorHex: color.colorHex,
      colorDetails: color.colorDetails,
      unitCount: String(row.values.unit_count || '').trim(),
      weight: String(row.values.weight || '').trim(),
      isDefault: Boolean(vr.isDefault),
      showInCatalog: vr.showInCatalog !== false,
      images: splitUrlList(row.values.image_urls),
      sku: String(row.values.sku || '').trim(),
      barcode: String(row.values.barcode || '').trim(),
      hsnCode: String(row.values.hsn || '').trim(),
      gstPercent: vr.gst?.value || 0,
      mrp: vr.mrp?.value || 0,
      sellingPrice: vr.selling?.value || 0,
      discountPercent: vr.discount?.value || 0,
      marginPrice: vr.margin?.value || 0,
      price: vr.selling?.value || 0,
    };
  });

  if (variantRows.length > 0 && !variantRows.some((row) => row.isDefault)) {
    variantRows[0].isDefault = true;
  }

  const colorVariants = [];
  const seen = new Set();
  for (const row of variantRows) {
    const key = String(row.color || '').trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    colorVariants.push({
      colorName: row.color,
      colorHex: row.colorHex || '#CCCCCC',
      images: [],
      isDefault: colorVariants.length === 0,
    });
  }

  payload.variants = variantRows;
  payload.colorVariants = colorVariants;
  return payload;
}
