import 'server-only';

import Location from '@/lib/models/Location';
import Stock from '@/lib/models/Stock';
import Product from '@/lib/models/Product';
import { LOCATION_PATH_SEP } from '@/lib/shared/inventoryConstants';

/**
 * Build a code-based display path (b1 › f1 › sec1 › z1 › R12 › Shelf 3)
 * by walking ancestors and using each node's `code`.
 */
export function buildCodePath(location, byId) {
  const segments = [];
  let current = location;
  const seen = new Set();
  while (current) {
    if (seen.has(String(current._id))) break;
    seen.add(String(current._id));
    segments.unshift(current.code || current.name || '?');
    const parentId = current.parentLocationId;
    current = parentId ? byId.get(String(parentId)) : null;
  }
  return segments.join(LOCATION_PATH_SEP);
}

function buildChildrenMap(locations) {
  const byParent = new Map();
  for (const loc of locations) {
    const pid = loc.parentLocationId ? String(loc.parentLocationId) : 'root';
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid).push(loc);
  }
  for (const kids of byParent.values()) {
    kids.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  }
  return byParent;
}

function collectDescendantIds(nodeId, byParent) {
  const ids = [nodeId];
  const kids = byParent.get(String(nodeId)) || [];
  for (const child of kids) {
    ids.push(...collectDescendantIds(String(child._id), byParent));
  }
  return ids;
}

/**
 * Distinct products with qty > 0 per locationId (direct only).
 */
async function getProductSetsByLocation() {
  const stocks = await Stock.find({ qty: { $gt: 0 } }).select('productId locationId').lean();
  const byLoc = new Map();
  for (const row of stocks) {
    const lid = String(row.locationId);
    if (!byLoc.has(lid)) byLoc.set(lid, new Set());
    byLoc.get(lid).add(String(row.productId));
  }
  return byLoc;
}

function countProductsInSubtree(nodeId, byParent, productSetsByLoc) {
  const descendants = collectDescendantIds(nodeId, byParent);
  const products = new Set();
  for (const did of descendants) {
    const set = productSetsByLoc.get(did);
    if (set) set.forEach((p) => products.add(p));
  }
  return products.size;
}

function formatNodeLabel(loc) {
  if (loc.level === 'rack' && loc.name) {
    return `${loc.code} ${loc.name}`;
  }
  if (loc.name && loc.name !== loc.code) {
    return loc.name;
  }
  return loc.code;
}

function buildTreeNode(loc, byParent, byId, productSetsByLoc) {
  const id = String(loc._id);
  const children = (byParent.get(id) || []).map((child) =>
    buildTreeNode(child, byParent, byId, productSetsByLoc)
  );

  return {
    _id: loc._id,
    code: loc.code,
    name: loc.name,
    label: formatNodeLabel(loc),
    level: loc.level,
    displayPath: buildCodePath(loc, byId),
    itemCount: countProductsInSubtree(id, byParent, productSetsByLoc),
    children,
  };
}

export async function getLocationTree() {
  const locations = await Location.find({ isActive: true }).lean();
  if (locations.length === 0) {
    return { tree: [], levels: ['branch', 'floor', 'section', 'zone', 'rack', 'shelf'] };
  }

  const byId = new Map(locations.map((l) => [String(l._id), l]));
  const byParent = buildChildrenMap(locations);
  const productSetsByLoc = await getProductSetsByLocation();

  const roots = byParent.get('root') || [];
  const tree = roots.map((root) => buildTreeNode(root, byParent, byId, productSetsByLoc));

  return {
    tree,
    levels: ['branch', 'floor', 'section', 'zone', 'rack', 'shelf'],
  };
}

export async function getItemsAtLocation(locationId) {
  const location = await Location.findById(locationId).lean();
  if (!location) {
    throw new Error('Location not found');
  }

  const allLocs = await Location.find({ isActive: true }).lean();
  const byParent = buildChildrenMap(allLocs);
  const byId = new Map(allLocs.map((l) => [String(l._id), l]));

  const descendantIds = collectDescendantIds(String(locationId), byParent);

  const stocks = await Stock.find({
    locationId: { $in: descendantIds },
    qty: { $gt: 0 },
  }).lean();

  if (stocks.length === 0) {
    return {
      location: {
        _id: location._id,
        label: formatNodeLabel(location),
        displayPath: buildCodePath(location, byId),
        level: location.level,
      },
      items: [],
      total: 0,
    };
  }

  const productIds = [...new Set(stocks.map((s) => s.productId))];
  const products = await Product.find({ _id: { $in: productIds }, deletedAt: null })
    .select('title sku stockUnit moneyInPaise')
    .lean();
  const productById = new Map(products.map((p) => [String(p._id), p]));

  const items = stocks
    .map((row) => {
      const product = productById.get(String(row.productId));
      if (!product) return null;
      const loc = byId.get(String(row.locationId));
      const fullPath = loc ? buildCodePath(loc, byId) : '';

      const sellableQty = row.statusBucket === 'sellable' ? row.qty : 0;
      const bucketLabel =
        row.statusBucket === 'sellable'
          ? `${row.qty} Sellable`
          : row.statusBucket.replace('_', ' ');

      return {
        _id: `${row.productId}-${row.locationId}-${row.statusBucket}`,
        productId: row.productId,
        title: product.title,
        sku: product.sku || '',
        qty: row.qty,
        sellableQty: row.statusBucket === 'sellable' ? row.qty : 0,
        stockUnit: product.stockUnit || 'Pcs',
        statusBucket: row.statusBucket,
        statusLabel: bucketLabel,
        fullPath,
        locationId: row.locationId,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.title.localeCompare(b.title));

  return {
    location: {
      _id: location._id,
      label: formatNodeLabel(location),
      displayPath: buildCodePath(location, byId),
      level: location.level,
    },
    items,
    total: items.length,
  };
}
