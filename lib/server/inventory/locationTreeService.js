import 'server-only';

import Location from '@/lib/models/Location';
import Stock from '@/lib/models/Stock';
import Product from '@/lib/models/Product';
import {
  STATUS_BUCKET_LABELS,
  ACTIVE_LOCATION_LEVELS,
  LEGACY_LOCATION_LEVELS,
  LOCATION_ITEMS_MAX,
  LOCATION_SEARCH_STOCK_SCAN_MAX,
} from '@/lib/shared/inventoryConstants';
import { formatBranchFloorRackPath } from '@/lib/shared/locationDisplay';

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
  })
    .select('productId locationId qty statusBucket')
    .lean();

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
      meta: { truncated: false, limit: LOCATION_ITEMS_MAX },
    };
  }

  const productIds = [...new Set(stocks.map((s) => s.productId))];
  const products = await Product.find({ _id: { $in: productIds }, deletedAt: null })
    .select('title sku stockUnit')
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

      const bucketLabel =
        row.statusBucket === 'sellable'
          ? `${row.qty} Sellable`
          : STATUS_BUCKET_LABELS[row.statusBucket] || row.statusBucket.replace('_', ' ');

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

  const truncated = items.length > LOCATION_ITEMS_MAX;
  const capped = truncated ? items.slice(0, LOCATION_ITEMS_MAX) : items;

  return {
    location: {
      _id: location._id,
      label: formatNodeLabel(location),
      displayPath: formatBranchFloorRackPath(String(location._id), byId),
      level: location.level,
    },
    items: capped,
    total: items.length,
    meta: { truncated, limit: LOCATION_ITEMS_MAX },
  };
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collectAncestorIds(location, byId) {
  const ids = [];
  let current = location;
  const seen = new Set();
  while (current?.parentLocationId) {
    const pid = String(current.parentLocationId);
    if (seen.has(pid)) break;
    seen.add(pid);
    ids.push(pid);
    current = byId.get(pid);
  }
  return ids;
}

/**
 * Map a stock location (possibly legacy shelf/zone/section) to the nearest
 * Branch→Floor→Rack node that appears in the Locations tree UI.
 */
function resolveToTreeLocation(locationId, byId) {
  const chain = [];
  let current = byId.get(String(locationId));
  const seen = new Set();

  while (current && !seen.has(String(current._id))) {
    seen.add(String(current._id));
    chain.unshift(current);
    if (!current.parentLocationId) break;
    current = byId.get(String(current.parentLocationId));
  }

  return (
    chain.find((l) => l.level === 'rack') ||
    chain.find((l) => l.level === 'floor') ||
    chain.find((l) => l.level === 'branch') ||
    byId.get(String(locationId)) ||
    null
  );
}

const SEARCH_LEVEL_RANK = { rack: 0, floor: 1, branch: 2 };

/**
 * Search stock by product title/SKU/barcode (and optionally location code/name).
 * Hits are rolled up to tree-visible racks so the UI can highlight every match.
 *
 * Primary pick: rack with the most matching units, then floor/branch.
 */
export async function searchLocationsByQuery(rawQuery) {
  const query = String(rawQuery || '').trim();
  if (query.length < 2) {
    return { query, primary: null, hits: [], highlightIds: [], items: [], totalHits: 0 };
  }

  const regex = new RegExp(escapeRegex(query), 'i');
  const allLocs = await Location.find({ isActive: true }).lean();
  const byId = new Map(allLocs.map((l) => [String(l._id), l]));

  const products = await Product.find({
    deletedAt: null,
    $or: [{ title: regex }, { sku: regex }, { barcode: regex }],
  })
    .select('_id title sku stockUnit')
    .limit(80)
    .lean();

  const productById = new Map(products.map((p) => [String(p._id), p]));
  const matchingProductIds = products.map((p) => p._id);

  /** @type {Map<string, number>} */
  const qtyByLocation = new Map();
  /** @type {Map<string, object[]>} */
  const stocksByLocation = new Map();
  /** @type {Map<string, boolean>} */
  const matchedByLocationName = new Map();

  if (matchingProductIds.length > 0) {
    const stocks = await Stock.find({
      productId: { $in: matchingProductIds },
      qty: { $gt: 0 },
      statusBucket: { $in: ['sellable', 'dead_stock'] },
      locationId: { $ne: null },
    })
      .select('productId locationId qty statusBucket')
      .limit(LOCATION_SEARCH_STOCK_SCAN_MAX)
      .lean();

    for (const row of stocks) {
      const resolved = resolveToTreeLocation(row.locationId, byId);
      if (!resolved) continue;
      const lid = String(resolved._id);
      qtyByLocation.set(lid, (qtyByLocation.get(lid) || 0) + row.qty);
      if (!stocksByLocation.has(lid)) stocksByLocation.set(lid, []);
      stocksByLocation.get(lid).push(row);
    }
  }

  for (const loc of allLocs) {
    if (!regex.test(loc.code || '') && !regex.test(loc.name || '')) continue;
    const resolved = resolveToTreeLocation(loc._id, byId);
    if (!resolved) continue;
    const lid = String(resolved._id);
    matchedByLocationName.set(lid, true);
  }

  const hitIds = new Set([
    ...qtyByLocation.keys(),
    ...matchedByLocationName.keys(),
  ]);

  const hits = [...hitIds]
    .map((lid) => {
      const loc = byId.get(lid);
      if (!loc) return null;
      const totalQty = qtyByLocation.get(lid) || 0;
      const matchCount = stocksByLocation.get(lid)?.length || 0;
      return {
        locationId: lid,
        level: loc.level,
        label: formatNodeLabel(loc),
        code: loc.code,
        name: loc.name || '',
        displayPath: formatBranchFloorRackPath(lid, byId),
        ancestorIds: collectAncestorIds(loc, byId),
        totalQty,
        matchCount,
        matchedByLocationName: Boolean(matchedByLocationName.get(lid)),
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const rankA = SEARCH_LEVEL_RANK[a.level] ?? 9;
      const rankB = SEARCH_LEVEL_RANK[b.level] ?? 9;
      if (rankA !== rankB) return rankA - rankB;
      if (b.totalQty !== a.totalQty) return b.totalQty - a.totalQty;
      return a.label.localeCompare(b.label);
    });

  const highlightIds = hits.map((h) => h.locationId);
  const primaryHit = hits[0] || null;
  if (!primaryHit) {
    return { query, primary: null, hits: [], highlightIds: [], items: [], totalHits: 0 };
  }

  const primaryLoc = byId.get(primaryHit.locationId);
  const primaryStocks = stocksByLocation.get(primaryHit.locationId) || [];

  /**
   * When the query matched products, show those stock rows at the primary rack.
   * Location-name-only matches fall back to the normal location item list shape
   * built from all stock at that node (caller can also load /items).
   */
  let items = [];
  if (primaryStocks.length > 0) {
    items = primaryStocks
      .map((row) => {
        const product = productById.get(String(row.productId));
        if (!product) return null;
        const resolved = resolveToTreeLocation(row.locationId, byId);
        const pathId = resolved ? String(resolved._id) : String(row.locationId);
        const fullPath = formatBranchFloorRackPath(pathId, byId);
        const bucketLabel =
          row.statusBucket === 'sellable'
            ? `${row.qty} Sellable`
            : STATUS_BUCKET_LABELS[row.statusBucket] || row.statusBucket.replace('_', ' ');

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
          locationId: pathId,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.title.localeCompare(b.title));

    if (items.length > LOCATION_ITEMS_MAX) {
      items = items.slice(0, LOCATION_ITEMS_MAX);
    }
  }

  return {
    query,
    primary: {
      locationId: primaryHit.locationId,
      level: primaryHit.level,
      label: primaryHit.label,
      code: primaryLoc?.code,
      name: primaryLoc?.name || '',
      displayPath: primaryHit.displayPath,
      ancestorIds: primaryHit.ancestorIds,
      _id: primaryHit.locationId,
    },
    hits,
    highlightIds,
    items,
    totalHits: hits.length,
  };
}
