import 'server-only';

import Location from '@/lib/models/Location';
import Stock from '@/lib/models/Stock';
import Product from '@/lib/models/Product';
import { LOCATION_PATH_SEP, STATUS_BUCKET_LABELS, ACTIVE_LOCATION_LEVELS, LEGACY_LOCATION_LEVELS } from '@/lib/shared/inventoryConstants';
import { formatBranchFloorRackPath } from '@/lib/shared/locationDisplay';

/**
 * Build a code-based display path (b1 › f1 › sec1 › z1 › R12 › Shelf 3)
 * by walking ancestors and using each node's `code`.
 */
/**
 * @deprecated Legacy full-code path (includes section/zone/shelf). Use formatBranchFloorRackPath in active workflows.
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
    displayPath: formatBranchFloorRackPath(String(loc._id), byId),
    itemCount: countProductsInSubtree(id, byParent, productSetsByLoc),
    children,
  };
}

/**
 * Remove legacy section/zone/shelf nodes and promote their descendants.
 * Racks under legacy intermediates appear directly under the nearest active ancestor.
 */
export function stripLegacyNodesFromTree(nodes) {
  if (!nodes?.length) return [];

  const result = [];
  for (const node of nodes) {
    const isLegacy = node.isLegacy || LEGACY_LOCATION_LEVELS.includes(node.level);
    if (isLegacy) {
      result.push(...stripLegacyNodesFromTree(node.children || []));
      continue;
    }

    result.push({
      ...node,
      children: stripLegacyNodesFromTree(node.children || []),
    });
  }
  return result;
}

export async function getLocationTree() {
  const locations = await Location.find({ isActive: true }).lean();
  if (locations.length === 0) {
    return { tree: [], levels: ACTIVE_LOCATION_LEVELS };
  }

  const byId = new Map(locations.map((l) => [String(l._id), l]));
  const byParent = buildChildrenMap(locations);
  const productSetsByLoc = await getProductSetsByLocation();

  const roots = byParent.get('root') || [];
  const tree = stripLegacyNodesFromTree(
    roots.map((root) => buildTreeNode(root, byParent, byId, productSetsByLoc))
  );

  return {
    tree,
    levels: ACTIVE_LOCATION_LEVELS,
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
    statusBucket: { $in: ['sellable', 'dead_stock'] },
  }).lean();

  if (stocks.length === 0) {
    return {
      location: {
        _id: location._id,
        label: formatNodeLabel(location),
        displayPath: formatBranchFloorRackPath(String(location._id), byId),
        level: location.level,
      },
      items: [],
      total: 0,
    };
  }

  const productIds = [...new Set(stocks.map((s) => s.productId))];
  const products = await Product.find({ _id: { $in: productIds }, deletedAt: null })
    .select('title sku stockUnit moneyInPaise heroImage')
    .lean();
  const productById = new Map(products.map((p) => [String(p._id), p]));

  const items = stocks
    .map((row) => {
      const product = productById.get(String(row.productId));
      if (!product) return null;
      const loc = byId.get(String(row.locationId));
      const fullPath = loc
        ? formatBranchFloorRackPath(String(row.locationId), byId)
        : '';

      const sellableQty = row.statusBucket === 'sellable' ? row.qty : 0;
      const bucketLabel =
        row.statusBucket === 'sellable'
          ? `${row.qty} Sellable`
          : STATUS_BUCKET_LABELS[row.statusBucket] || row.statusBucket.replace('_', ' ');

      return {
        _id: `${row.productId}-${row.locationId}-${row.statusBucket}`,
        productId: row.productId,
        title: product.title,
        sku: product.sku || '',
        heroImage: product.heroImage || '',
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
      displayPath: formatBranchFloorRackPath(String(location._id), byId),
      level: location.level,
    },
    items,
    total: items.length,
  };
}

/**
 * Add distinct product count and total unit qty for each location (includes descendants).
 * Uses the same descendant + Stock query rules as getItemsAtLocation().
 */
export async function attachLocationStockCounts(locations) {
  if (!locations.length) return locations;

  const allLocs = await Location.find({ isActive: true }).lean();
  const byParent = buildChildrenMap(allLocs);

  const descendantsByLocation = new Map(
    locations.map((loc) => [
      String(loc._id),
      collectDescendantIds(String(loc._id), byParent),
    ])
  );

  const allDescendantIds = [
    ...new Set([...descendantsByLocation.values()].flat().map(String)),
  ];

  const stocks =
    allDescendantIds.length === 0
      ? []
      : await Stock.find({
          locationId: { $in: allDescendantIds },
          qty: { $gt: 0 },
        })
          .select('productId locationId qty')
          .lean();

  return locations.map((loc) => {
    const descendants = new Set(descendantsByLocation.get(String(loc._id)) || []);
    const products = new Set();
    let totalQty = 0;

    for (const row of stocks) {
      if (!descendants.has(String(row.locationId))) continue;
      products.add(String(row.productId));
      totalQty += row.qty;
    }

    return { ...loc, itemCount: products.size, totalQty };
  });
}
