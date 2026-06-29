import 'server-only';

import Product from '@/lib/models/Product';
import Category from '@/lib/models/Category';

void Category;

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function salesCatalogBaseFilter() {
  return {
    deletedAt: null,
    productStatus: { $ne: 'inactive' },
    productType: { $ne: 'parent' },
  };
}

const PRODUCT_TEXT_FIELDS = (regex) => [
  { title: regex },
  { sku: regex },
  { barcode: regex },
  { brand: regex },
  { tags: regex },
  { searchBlob: regex },
  { hsnCode: regex },
  { summary: regex },
  { description: regex },
  { businessTypeSlugs: regex },
  { 'colorVariants.colorName': regex },
  { 'filters.values': regex },
  { 'variationAttributes.color': regex },
  { 'variationAttributes.size': regex },
];

async function categoryIdsForToken(token) {
  const regex = new RegExp(escapeRegex(token), 'i');
  const rows = await Category.find({ name: regex }).select('_id').limit(40).lean();
  return rows.map((r) => r._id);
}

async function parentIdsForToken(token) {
  const regex = new RegExp(escapeRegex(token), 'i');
  const rows = await Product.find({
    deletedAt: null,
    productType: 'parent',
    $or: PRODUCT_TEXT_FIELDS(regex),
  })
    .select('_id')
    .limit(80)
    .lean();
  return rows.map((r) => r._id);
}

function tokenMatchBranch(regex, categoryIds, parentIds) {
  const branches = [{ $or: PRODUCT_TEXT_FIELDS(regex) }];

  if (categoryIds.length > 0) {
    branches.push({
      $or: [
        { categoryId: { $in: categoryIds } },
        { categoryIds: { $in: categoryIds } },
      ],
    });
  }

  if (parentIds.length > 0) {
    branches.push({ parentProductId: { $in: parentIds } });
  }

  return branches.length === 1 ? branches[0] : { $or: branches };
}

export async function buildSalesCatalogSearchFilter(term) {
  const tokens = String(term || '')
    .trim()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (tokens.length === 0) return null;

  const lookups = await Promise.all(
    tokens.map(async (token) => {
      const [categoryIds, parentIds] = await Promise.all([
        categoryIdsForToken(token),
        parentIdsForToken(token),
      ]);
      const regex = new RegExp(escapeRegex(token), 'i');
      return tokenMatchBranch(regex, categoryIds, parentIds);
    })
  );

  if (lookups.length === 1) return lookups[0];
  return { $and: lookups };
}
