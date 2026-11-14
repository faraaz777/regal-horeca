/**
 * Product Link Service
 *
 * Responsible for:
 * - SKU search for the mapping workspace
 * - Listing a SKU's linked alternatives with live stock, MRP and selling price
 * - Creating star or mesh (all-to-all) undirected links
 * - Removing one pair or detaching a SKU from its connected group
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
  PRODUCT_LINK_MODE_MESH,
  PRODUCT_LINK_MODE_STAR,
  PRODUCT_LINK_MODES,
  PRODUCT_LINK_NOTE_MAX,
  PRODUCT_LINK_UNLINK_GROUP,
  PRODUCT_LINK_UNLINK_PAIR,
  PRODUCT_LINK_UNLINK_SCOPES,
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

function toObjectId(id) {
  const s = String(id || '').trim();
  if (!mongoose.Types.ObjectId.isValid(s)) return null;
  return new mongoose.Types.ObjectId(s);
}

function pairObjectIds(left, right) {
  const [a, b] = orderedProductPair(left, right);
  return [toObjectId(a), toObjectId(b)];
}

/**
 * Connected component of undirected ProductLink edges starting at `startId`.
 * Components stay small (cap 30 links/SKU), so BFS is fine.
 */
async function connectedComponentIds(startId) {
  const start = String(startId);
  if (!isValidId(start)) return new Set();
  const seen = new Set([start]);
  const queue = [start];

  while (queue.length) {
    const cur = queue.shift();
    const oid = toObjectId(cur);
    if (!oid) continue;
    const edges = await ProductLink.find({
      $or: [{ productA: oid }, { productB: oid }],
    })
      .select('productA productB')
      .lean();
    for (const edge of edges) {
      const peer = otherId(edge, cur);
      if (!peer || seen.has(peer)) continue;
      seen.add(peer);
      queue.push(peer);
    }
  }
  return seen;
}

async function linkCountFor(productId) {
  const oid = toObjectId(productId);
  if (!oid) return 0;
  return ProductLink.countDocuments({
    $or: [{ productA: oid }, { productB: oid }],
  });
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

  /**
   * For unlink UI: how many edges fall if this peer is removed from the
   * whole connected group (vs deleting only the source↔peer edge).
   */
  const component = await connectedComponentIds(source._id);
  const componentOids = [...component].map(toObjectId).filter(Boolean);
  const componentEdges =
    componentOids.length > 1
      ? await ProductLink.find({
          productA: { $in: componentOids },
          productB: { $in: componentOids },
        })
          .select('productA productB')
          .lean()
      : [];

  const rows = [];
  for (const link of links) {
    const peerKey = otherId(link, source._id);
    const view = presented.get(peerKey);
    if (!view) continue;
    let groupDetachCount = 1;
    if (component.size > 2) {
      groupDetachCount = componentEdges.filter(
        (edge) => String(edge.productA) === peerKey || String(edge.productB) === peerKey
      ).length;
    }
    rows.push({
      id: String(link._id),
      note: link.note || '',
      priceDifference: Math.round((view.sellingPrice - sourceView.sellingPrice) * 100) / 100,
      groupDetachCount,
      product: view,
    });
  }

  rows.sort((a, b) => {
    const stockRank = Number(b.product.stockQty > 0) - Number(a.product.stockQty > 0);
    if (stockRank) return stockRank;
    return a.product.sellingPrice - b.product.sellingPrice;
  });

  return { source: sourceView, links: rows, groupSize: component.size };
}

/**
 * @param {{ productId: string, otherProductId: string, note?: string, createdBy?: string }} input
 */
export async function createProductLink(input) {
  return createProductLinks({
    productId: input.productId,
    otherProductIds: [input.otherProductId],
    mode: PRODUCT_LINK_MODE_STAR,
    note: input.note,
    createdBy: input.createdBy,
  });
}

/**
 * Create star (master↔each pick) or mesh (all pairs among master+picks) links.
 *
 * @param {{
 *   productId: string,
 *   otherProductIds: string[],
 *   mode?: string,
 *   note?: string,
 *   createdBy?: string,
 * }} input
 */
export async function createProductLinks(input) {
  const mode = String(input.mode || PRODUCT_LINK_MODE_STAR).trim();
  if (!PRODUCT_LINK_MODES.includes(mode)) {
    return { error: 'Choose star (to master) or mesh (all to each other).' };
  }

  const master = await loadSellableSku(input.productId);
  if (!master) {
    return { error: 'Choose a sellable SKU (variant or standalone), not a parent family.' };
  }

  const rawIds = Array.isArray(input.otherProductIds) ? input.otherProductIds : [];
  const uniqueOtherIds = [...new Set(rawIds.map((id) => String(id || '').trim()).filter(Boolean))];
  if (!uniqueOtherIds.length) {
    return { error: 'Pick at least one SKU to link.' };
  }

  const others = [];
  for (const id of uniqueOtherIds) {
    if (id === String(master._id)) continue;
    const doc = await loadSellableSku(id);
    if (!doc) {
      return { error: 'Both sides must be sellable SKUs. Parent families cannot be mapped.' };
    }
    others.push(doc);
  }
  if (!others.length) {
    return { error: 'Pick at least one SKU to link.' };
  }

  const memberIds =
    mode === PRODUCT_LINK_MODE_MESH
      ? [String(master._id), ...others.map((doc) => String(doc._id))]
      : null;

  /** @type {Array<[string, string]>} */
  const wantedPairs = [];
  if (mode === PRODUCT_LINK_MODE_MESH) {
    for (let i = 0; i < memberIds.length; i += 1) {
      for (let j = i + 1; j < memberIds.length; j += 1) {
        wantedPairs.push(orderedProductPair(memberIds[i], memberIds[j]));
      }
    }
  } else {
    for (const doc of others) {
      wantedPairs.push(orderedProductPair(master._id, doc._id));
    }
  }

  const pairKeys = wantedPairs.map(([a, b]) => `${a}|${b}`);
  const existing = await ProductLink.find({
    $or: wantedPairs.map(([a, b]) => {
      const [productA, productB] = pairObjectIds(a, b);
      return { productA, productB };
    }),
  })
    .select('productA productB')
    .lean();
  const existingKeys = new Set(
    existing.map((row) => orderedProductPair(row.productA, row.productB).join('|'))
  );

  const newPairs = wantedPairs.filter((_, index) => !existingKeys.has(pairKeys[index]));
  if (!newPairs.length) {
    return { error: 'These SKUs are already linked for the chosen mode.', created: 0, skipped: wantedPairs.length };
  }

  /**
   * Cap check: per SKU, existing degree + newly added incident edges
   * must stay within PRODUCT_LINK_CAP.
   */
  const addById = new Map();
  for (const [a, b] of newPairs) {
    addById.set(a, (addById.get(a) || 0) + 1);
    addById.set(b, (addById.get(b) || 0) + 1);
  }
  const involvedIds = [...addById.keys()];
  const degrees = await Promise.all(involvedIds.map((id) => linkCountFor(id)));
  for (let i = 0; i < involvedIds.length; i += 1) {
    if (degrees[i] + (addById.get(involvedIds[i]) || 0) > PRODUCT_LINK_CAP) {
      return {
        error: `A SKU can have at most ${PRODUCT_LINK_CAP} links. Mesh/star would exceed the cap.`,
      };
    }
  }

  const note = String(input.note || '').trim().slice(0, PRODUCT_LINK_NOTE_MAX);
  const createdBy = String(input.createdBy || '');
  const docs = newPairs.map(([a, b]) => {
    const [productA, productB] = pairObjectIds(a, b);
    return { productA, productB, note, createdBy };
  });

  try {
    await ProductLink.insertMany(docs, { ordered: false });
  } catch (error) {
    /**
     * Duplicate-key races are acceptable — treat as skipped.
     * Any other error bubbles up.
     */
    if (error?.code !== 11000 && !error?.writeErrors) throw error;
  }

  return {
    created: docs.length,
    skipped: wantedPairs.length - docs.length,
    mode,
    linkIds: [],
  };
}

/**
 * @param {string} linkId
 * @param {{ scope?: string, viewerProductId?: string }} [opts]
 */
export async function deleteProductLink(linkId, opts = {}) {
  if (!isValidId(linkId)) return { error: 'Mapping not found.' };
  const scope = String(opts.scope || PRODUCT_LINK_UNLINK_PAIR).trim();
  if (!PRODUCT_LINK_UNLINK_SCOPES.includes(scope)) {
    return { error: 'Unlink scope must be pair or group.' };
  }

  const edge = await ProductLink.findById(linkId).lean();
  if (!edge) return { error: 'Mapping not found.' };

  if (scope === PRODUCT_LINK_UNLINK_PAIR) {
    await ProductLink.findByIdAndDelete(linkId);
    return { ok: true, removed: 1, scope };
  }

  /**
   * Remove peer from the connected group visible from the viewer SKU.
   * Deletes every edge between the peer and any node in that component.
   */
  const viewerId = String(opts.viewerProductId || '').trim();
  const a = String(edge.productA);
  const b = String(edge.productB);
  let peerId = b;
  let anchorId = a;
  if (viewerId && (viewerId === a || viewerId === b)) {
    anchorId = viewerId;
    peerId = viewerId === a ? b : a;
  }

  const component = await connectedComponentIds(anchorId);
  if (!component.has(peerId)) {
    await ProductLink.findByIdAndDelete(linkId);
    return { ok: true, removed: 1, scope };
  }

  const memberOids = [...component].map(toObjectId).filter(Boolean);
  const peerOid = toObjectId(peerId);
  const result = await ProductLink.deleteMany({
    $or: [
      { productA: peerOid, productB: { $in: memberOids } },
      { productB: peerOid, productA: { $in: memberOids } },
    ],
  });

  return { ok: true, removed: result.deletedCount || 0, scope };
}
