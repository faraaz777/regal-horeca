/**
 * Product Link Service
 *
 * Responsible for:
 * - SKU search for the mapping workspace
 * - Listing a SKU's linked alternatives with live stock, MRP and selling price
 * - Creating and removing one undirected link
 *
 * Does NOT update relatedProductIds, inventory, or storefront merchandising.
 * Links have no type or audience — linkage alone is the concept.
 */

import 'server-only';

import mongoose from 'mongoose';
import Product from '@/lib/models/Product';
import ProductLink from '@/lib/models/ProductLink';
import Stock from '@/lib/models/Stock';
import Brand from '@/lib/models/Brand';
import Category from '@/lib/models/Category';
import InventoryRule from '@/lib/models/InventoryRule';
import { getListPricePaise, toPaise } from '@/lib/server/sales/pricing';
import { articleStatusFromRule, ARTICLE_MAINTAINED } from '@/lib/shared/maintainedArticle';
import {
  PRODUCT_LINK_CAP,
  PRODUCT_LINK_NOTE_MAX,
  orderedProductPair,
} from '@/lib/shared/productLink';

const SKU_SELECT =
  'title sku barcode brand productType parentProductId variationAttributes specifications categoryId sellingPrice price mrp moneyInPaise heroImage deletedAt';

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(String(id || ''));
}

function otherId(link, productId) {
  const self = String(productId);
  return String(link.productA) === self ? String(link.productB) : String(link.productA);
}

function variantBits(product) {
  const attrs = product?.variationAttributes || {};
  return {
    size: String(attrs.size || '').trim(),
    color: String(attrs.color || '').trim(),
  };
}

function sellingRupees(product) {
  return Math.round(getListPricePaise(product)) / 100;
}

function mrpRupees(product) {
  return Math.round(toPaise(product, 'mrp')) / 100;
}

async function sellableQtyByProduct(ids) {
  if (!ids.length) return new Map();
  const rows = await Stock.aggregate([
    {
      $match: {
        productId: { $in: ids },
        statusBucket: 'sellable',
        qty: { $gt: 0 },
      },
    },
    { $group: { _id: '$productId', qty: { $sum: '$qty' } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), Number(row.qty) || 0]));
}

async function loadSellableSku(id) {
  if (!isValidId(id)) return null;
  const doc = await Product.findOne({
    _id: id,
    deletedAt: null,
    productType: { $in: ['child', 'standalone'] },
  })
    .select(SKU_SELECT)
    .lean();
  return doc;
}

/**
 * @param {string} q
 * @param {number} [limit]
 */
export async function searchMappableSkus(q, limit = 20) {
  const term = String(q || '').trim();
  if (term.length < 2) return [];
  const capped = Math.min(Math.max(Number(limit) || 20, 1), 80);
  const pattern = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

  const docs = await Product.find({
    deletedAt: null,
    productType: { $in: ['child', 'standalone'] },
    $or: [{ title: pattern }, { sku: pattern }, { barcode: pattern }, { brand: pattern }],
  })
    .select(SKU_SELECT)
    .sort({ title: 1 })
    .limit(capped)
    .lean();

  const presented = await presentSkus(docs);
  return docs.map((doc) => presented.get(String(doc._id))).filter(Boolean);
}

/**
 * Workbench candidate pool for one master SKU.
 *
 * Prefer same category / parent family, then title-token overlap.
 * Used when the Link Workbench opens so the operator sees alternatives
 * without typing first.
 *
 * @param {string} sourceId
 * @param {{ q?: string, limit?: number }} [opts]
 */
export async function browseMappableSkus(sourceId, opts = {}) {
  const source = await loadSellableSku(sourceId);
  if (!source) return [];

  const capped = Math.min(Math.max(Number(opts.limit) || 60, 1), 80);
  const term = String(opts.q || '').trim();
  const exclude = source._id;

  if (term.length >= 2) {
    const pattern = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const docs = await Product.find({
      _id: { $ne: exclude },
      deletedAt: null,
      productType: { $in: ['child', 'standalone'] },
      $or: [{ title: pattern }, { sku: pattern }, { barcode: pattern }, { brand: pattern }],
    })
      .select(SKU_SELECT)
      .sort({ title: 1 })
      .limit(capped)
      .lean();
    const presented = await presentSkus(docs);
    return docs.map((doc) => presented.get(String(doc._id))).filter(Boolean);
  }

  const parent = source.parentProductId
    ? await Product.findOne({ _id: source.parentProductId, deletedAt: null })
        .select('categoryId title')
        .lean()
    : null;
  const categoryId = source.categoryId || parent?.categoryId || null;

  /**
   * Title tokens used for soft matching when category alone is too narrow.
   * Skip tiny filler words so "Dinner Plate 11" still finds other plates.
   */
  const stop = new Set(['and', 'the', 'for', 'with', 'inch', 'in', 'mm', 'cm', 'pcs', 'pc']);
  const tokens = String(source.title || '')
    .split(/[^a-zA-Z0-9]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3 && !stop.has(part.toLowerCase()))
    .slice(0, 4);

  const orClauses = [];
  if (categoryId) orClauses.push({ categoryId });
  if (source.parentProductId) {
    orClauses.push({ parentProductId: source.parentProductId });
  }
  for (const token of tokens) {
    orClauses.push({ title: new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') });
  }
  if (!orClauses.length && source.brand) {
    orClauses.push({ brand: source.brand });
  }
  if (!orClauses.length) return [];

  const docs = await Product.find({
    _id: { $ne: exclude },
    deletedAt: null,
    productType: { $in: ['child', 'standalone'] },
    $or: orClauses,
  })
    .select(SKU_SELECT)
    .sort({ title: 1 })
    .limit(capped)
    .lean();

  const presented = await presentSkus(docs);
  return docs.map((doc) => presented.get(String(doc._id))).filter(Boolean);
}

function specValue(specs, pattern) {
  const row = (specs || []).find((item) => pattern.test(String(item?.label || '')));
  if (!row) return '';
  return [row.value, row.unit].filter(Boolean).join(' ').trim();
}

function categoryLabels(categoryId, byId) {
  const names = { category: '', subcategory: '' };
  let current = categoryId ? byId.get(String(categoryId)) : null;
  const seen = new Set();
  while (current && !seen.has(String(current._id))) {
    seen.add(String(current._id));
    if (current.level === 'subcategory' || current.level === 'type') names.subcategory = names.subcategory || current.name;
    if (current.level === 'category') names.category = current.name;
    if (current.level === 'department' && !names.category) names.category = current.name;
    current = current.parent ? byId.get(String(current.parent)) : null;
  }
  return names;
}

/**
 * Live stock, planning rule, brand logo, and catalog labels for the mapping table.
 * Price stays a live read. Nothing here is copied onto the link.
 */
async function presentSkus(docs) {
  const list = (docs || []).filter(Boolean);
  if (!list.length) return new Map();

  const ids = list.map((doc) => doc._id);
  const parentIds = list
    .filter((doc) => doc.productType === 'child' && doc.parentProductId && !(doc.specifications || []).length)
    .map((doc) => doc.parentProductId);

  const [qty, rules, parents, brands, directCategories] = await Promise.all([
    sellableQtyByProduct(ids),
    InventoryRule.find({ productId: { $in: ids } }).select('productId minStock maxStock').lean(),
    parentIds.length
      ? Product.find({ _id: { $in: parentIds }, deletedAt: null }).select('specifications categoryId').lean()
      : [],
    Brand.find({ level: 'department' }).select('name image').lean(),
    Category.find({
      _id: {
        $in: list.map((doc) => doc.categoryId).filter(Boolean),
      },
    }).select('name level parent').lean(),
  ]);

  const parentById = new Map(parents.map((doc) => [String(doc._id), doc]));
  const ruleById = new Map(rules.map((rule) => [String(rule.productId), rule]));
  const brandByName = new Map(brands.map((brand) => [String(brand.name || '').trim().toLowerCase(), brand.image || '']));

  const categoryIds = new Set(directCategories.map((row) => String(row._id)));
  directCategories.forEach((row) => {
    if (row.parent) categoryIds.add(String(row.parent));
  });
  parents.forEach((parent) => {
    if (parent.categoryId) categoryIds.add(String(parent.categoryId));
  });
  const categories = await Category.find({ _id: { $in: [...categoryIds] } }).select('name level parent').lean();
  const extraParents = categories.map((row) => row.parent).filter((id) => id && !categoryIds.has(String(id)));
  if (extraParents.length) {
    const more = await Category.find({ _id: { $in: extraParents } }).select('name level parent').lean();
    categories.push(...more);
  }
  const categoryById = new Map(categories.map((row) => [String(row._id), row]));

  const presented = new Map();
  for (const doc of list) {
    const parent = parentById.get(String(doc.parentProductId || ''));
    const specs = (doc.specifications || []).length ? doc.specifications : parent?.specifications || [];
    const categoryId = doc.categoryId || parent?.categoryId || null;
    const labels = categoryLabels(categoryId, categoryById);
    const bits = variantBits(doc);
    const stockQty = qty.get(String(doc._id)) || 0;
    const rule = ruleById.get(String(doc._id)) || null;
    const maintained = articleStatusFromRule(rule) === ARTICLE_MAINTAINED;
    const minStock = rule ? Number(rule.minStock) || 0 : null;
    const maxStock = rule ? Number(rule.maxStock) || 0 : null;
    let stockLabel = 'In Stock';
    if (stockQty <= 0) stockLabel = 'Out of Stock';
    else if (maintained && minStock != null && stockQty < minStock) stockLabel = 'Below Min';

    presented.set(String(doc._id), {
      id: String(doc._id),
      title: doc.title || '',
      sku: doc.sku || '',
      barcode: doc.barcode || '',
      brand: doc.brand || '',
      brandImage: brandByName.get(String(doc.brand || '').trim().toLowerCase()) || '',
      size: bits.size,
      color: bits.color,
      material: specValue(specs, /material/i),
      category: labels.category,
      subcategory: labels.subcategory,
      productType: doc.productType || '',
      imageUrl: doc.heroImage || '',
      stockQty,
      minStock,
      maxStock,
      maintained,
      stockLabel,
      mrp: mrpRupees(doc),
      sellingPrice: sellingRupees(doc),
    });
  }
  return presented;
}

/**
 * Alternatives for one sellable SKU, with live commercial fields.
 * @param {string} productId
 */
export async function listProductLinks(productId) {
  const source = await loadSellableSku(productId);
  if (!source) {
    return { error: 'Choose a sellable SKU (variant or standalone), not a parent family.' };
  }

  const oid = source._id;
  const links = await ProductLink.find({ $or: [{ productA: oid }, { productB: oid }] })
    .sort({ updatedAt: -1 })
    .lean();

  const peerIds = links.map((link) => otherId(link, source._id)).filter(isValidId);
  const peers = peerIds.length
    ? await Product.find({
        _id: { $in: peerIds },
        deletedAt: null,
        productType: { $in: ['child', 'standalone'] },
      })
        .select(SKU_SELECT)
        .lean()
    : [];
  const presented = await presentSkus([source, ...peers]);
  const sourceView = presented.get(String(source._id));

  const rows = [];
  for (const link of links) {
    const view = presented.get(otherId(link, source._id));
    if (!view) continue;
    rows.push({
      id: String(link._id),
      note: link.note || '',
      priceDifference: Math.round((view.sellingPrice - sourceView.sellingPrice) * 100) / 100,
      product: view,
    });
  }

  rows.sort((a, b) => {
    const stockRank = Number(b.product.stockQty > 0) - Number(a.product.stockQty > 0);
    if (stockRank) return stockRank;
    return a.product.sellingPrice - b.product.sellingPrice;
  });

  return { source: sourceView, links: rows };
}

/**
 * @param {{ productId: string, otherProductId: string, note?: string, createdBy?: string }} input
 */
export async function createProductLink(input) {
  const left = await loadSellableSku(input.productId);
  const right = await loadSellableSku(input.otherProductId);
  if (!left || !right) {
    return { error: 'Both sides must be sellable SKUs. Parent families cannot be mapped.' };
  }
  if (String(left._id) === String(right._id)) {
    return { error: 'A SKU cannot be mapped to itself.' };
  }

  const note = String(input.note || '').trim().slice(0, PRODUCT_LINK_NOTE_MAX);
  const [productA, productB] = orderedProductPair(left._id, right._id);

  const existing = await ProductLink.findOne({ productA, productB }).select('_id').lean();
  if (existing) {
    return { error: 'These two SKUs are already mapped. Remove the existing link to change it.' };
  }

  const capFor = (productId) =>
    ProductLink.countDocuments({
      $or: [{ productA: productId }, { productB: productId }],
    });
  const [leftCount, rightCount] = await Promise.all([capFor(left._id), capFor(right._id)]);
  if (leftCount >= PRODUCT_LINK_CAP || rightCount >= PRODUCT_LINK_CAP) {
    return {
      error: `A SKU can have at most ${PRODUCT_LINK_CAP} links. Remove one before adding another.`,
    };
  }

  const doc = await ProductLink.create({
    productA,
    productB,
    note,
    createdBy: String(input.createdBy || ''),
  });

  return { linkId: String(doc._id) };
}

export async function deleteProductLink(linkId) {
  if (!isValidId(linkId)) return { error: 'Mapping not found.' };
  const removed = await ProductLink.findByIdAndDelete(linkId).lean();
  if (!removed) return { error: 'Mapping not found.' };
  return { ok: true };
}
