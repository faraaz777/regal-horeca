import 'server-only';

import Location from '@/lib/models/Location';
import Stock from '@/lib/models/Stock';
import StockLedger from '@/lib/models/StockLedger';
import Product from '@/lib/models/Product';
import { LEGACY_LOCATION_LEVELS } from '@/lib/shared/inventoryConstants';
import {
  formatBranchFloorRackPath,
  formatBranchFloorRackPathCodesWithRackName,
} from '@/lib/shared/locationDisplay';
import { listCascadeRacks } from '@/lib/server/inventory/locationSelectService';
import { listAllLocations } from '@/lib/server/inventory/locationCrudService';
import { deriveStockStatus, getDefaultLowStockThreshold } from '@/lib/server/inventory/inventoryService';

export const DEFAULT_RACK_WIDTH = 120;
export const DEFAULT_RACK_HEIGHT = 80;

function aggregateRackStock(stockRows) {
  let sellableQty = 0;
  let holdQty = 0;
  let scrapQty = 0;

  for (const row of stockRows) {
    const qty = row.qty || 0;
    if (row.statusBucket === 'sellable') sellableQty += qty;
    else if (row.statusBucket === 'hold') holdQty += qty;
    else if (row.statusBucket === 'scrap') scrapQty += qty;
  }

  return {
    sellableQty,
    holdQty,
    scrapQty,
    totalQty: sellableQty + holdQty + scrapQty,
  };
}

export function deriveRackStockStatus({ sellableQty, holdQty, scrapQty }, threshold) {
  if (sellableQty > 0) return deriveStockStatus(sellableQty, threshold);
  if (holdQty > 0) return 'hold';
  if (scrapQty > 0) return 'scrap';
  return 'out';
}

function normalizePosition(position) {
  if (!position || position.x == null || position.y == null) return null;
  return {
    x: position.x,
    y: position.y,
    width: position.width ?? DEFAULT_RACK_WIDTH,
    height: position.height ?? DEFAULT_RACK_HEIGHT,
  };
}

function buildRackDto(rack, doc, stockAgg, threshold, byId) {
  const stockStatus = deriveRackStockStatus(stockAgg, threshold);
  const capacity = doc?.capacity ?? null;
  const fillPct =
    capacity && capacity > 0
      ? Math.min(1, stockAgg.totalQty / capacity)
      : null;
  return {
    _id: String(rack._id),
    code: rack.code,
    name: rack.name || '',
    displayPath: rack.displayPath || formatBranchFloorRackPath(String(rack._id), byId),
    displayPathShort: formatBranchFloorRackPathCodesWithRackName(String(rack._id), byId),
    sellableQty: stockAgg.sellableQty,
    holdQty: stockAgg.holdQty,
    scrapQty: stockAgg.scrapQty,
    totalQty: stockAgg.totalQty,
    capacity,
    fillPct,
    stockStatus,
    position: normalizePosition(doc?.position),
  };
}

async function assertActiveRack(rackId) {
  const rack = await Location.findById(rackId).lean();
  if (!rack || !rack.isActive) {
    throw new Error('Rack not found');
  }
  if (rack.level !== 'rack') {
    throw new Error('Position updates apply to rack locations only');
  }
  if (LEGACY_LOCATION_LEVELS.includes(rack.level)) {
    throw new Error('Legacy locations cannot be placed on the locator');
  }
  return rack;
}

/**
 * All active racks under a floor with stock summary and canvas position.
 */
export async function getFloorLayout(floorId) {
  const floor = await Location.findById(floorId).lean();
  if (!floor || floor.level !== 'floor' || !floor.isActive) {
    throw new Error('Floor not found');
  }

  const allLocs = await listAllLocations();
  const byId = new Map(allLocs.map((l) => [String(l._id), l]));
  const branch = floor.parentLocationId ? byId.get(String(floor.parentLocationId)) : null;

  const cascadeRacks = await listCascadeRacks(floorId);
  const rackIds = cascadeRacks.map((r) => r._id);

  const [rackDocs, stocks, threshold] = await Promise.all([
    rackIds.length
      ? Location.find({ _id: { $in: rackIds }, level: 'rack', isActive: true }).lean()
      : [],
    rackIds.length
      ? Stock.find({ locationId: { $in: rackIds }, qty: { $gt: 0 } }).lean()
      : [],
    getDefaultLowStockThreshold(),
  ]);

  const rackDocById = new Map(rackDocs.map((r) => [String(r._id), r]));
  const stockByRack = new Map();
  for (const row of stocks) {
    const rid = String(row.locationId);
    if (!stockByRack.has(rid)) stockByRack.set(rid, []);
    stockByRack.get(rid).push(row);
  }

  const placed = [];
  const unplaced = [];

  for (const rack of cascadeRacks) {
    const doc = rackDocById.get(String(rack._id));
    if (!doc) continue;

    const stockAgg = aggregateRackStock(stockByRack.get(String(rack._id)) || []);
    const dto = buildRackDto(rack, doc, stockAgg, threshold, byId);

    if (dto.position) placed.push(dto);
    else unplaced.push(dto);
  }

  const allRacks = [...placed, ...unplaced];
  const maxTotalQty = Math.max(1, ...allRacks.map((r) => r.totalQty));
  const anyCapacity = allRacks.some((r) => r.capacity && r.capacity > 0);

  return {
    floor: {
      _id: String(floor._id),
      code: floor.code,
      name: floor.name || '',
      displayPath: formatBranchFloorRackPath(String(floor._id), byId),
    },
    branch: branch
      ? { _id: String(branch._id), code: branch.code, name: branch.name || '' }
      : null,
    racks: placed,
    unplacedRacks: unplaced,
    maxTotalQty,
    hasCapacityData: anyCapacity,
    heatmapNote: anyCapacity
      ? 'Heatmap shows fill % (total qty ÷ rack capacity). Racks without a capacity fall back to relative qty.'
      : 'No rack capacities set yet — heatmap uses relative total qty on this floor. Set a rack capacity in its detail drawer for true fill %.',
  };
}

export async function updateRackPosition(rackId, { x, y, width, height }) {
  await assertActiveRack(rackId);

  const position = {
    x,
    y,
    width: width ?? DEFAULT_RACK_WIDTH,
    height: height ?? DEFAULT_RACK_HEIGHT,
  };

  const rack = await Location.findByIdAndUpdate(
    rackId,
    { $set: { position } },
    { new: true }
  ).lean();

  return { _id: String(rack._id), position: normalizePosition(rack.position) };
}

export async function bulkUpdateRackPositions(positions) {
  const ids = positions.map((p) => p.id);
  const racks = await Location.find({ _id: { $in: ids }, level: 'rack', isActive: true }).lean();
  const rackById = new Map(racks.map((r) => [String(r._id), r]));

  if (racks.length !== positions.length) {
    throw new Error('One or more rack ids are invalid');
  }

  const ops = positions.map((p) => {
    const existing = rackById.get(String(p.id));
    return {
      updateOne: {
        filter: { _id: p.id },
        update: {
          $set: {
            position: {
              x: p.x,
              y: p.y,
              width: p.width ?? existing?.position?.width ?? DEFAULT_RACK_WIDTH,
              height: p.height ?? existing?.position?.height ?? DEFAULT_RACK_HEIGHT,
            },
          },
        },
      },
    };
  });

  await Location.bulkWrite(ops);

  return {
    updated: positions.map((p) => ({
      _id: p.id,
      position: {
        x: p.x,
        y: p.y,
        width: p.width ?? rackById.get(String(p.id))?.position?.width ?? DEFAULT_RACK_WIDTH,
        height: p.height ?? rackById.get(String(p.id))?.position?.height ?? DEFAULT_RACK_HEIGHT,
      },
    })),
  };
}

/**
 * Rack detail for locator drawer — items at rack + last ledger movement.
 */
export async function getRackLocatorDetail(rackId) {
  const rack = await assertActiveRack(rackId);
  const allLocs = await listAllLocations();
  const byId = new Map(allLocs.map((l) => [String(l._id), l]));

  const stocks = await Stock.find({ locationId: rackId, qty: { $gt: 0 } }).lean();
  const productIds = [...new Set(stocks.map((s) => String(s.productId)))];

  const products = productIds.length
    ? await Product.find({ _id: { $in: productIds }, deletedAt: null })
        .select('title sku stockUnit')
        .lean()
    : [];
  const productById = new Map(products.map((p) => [String(p._id), p]));

  const items = stocks
    .map((row) => {
      const product = productById.get(String(row.productId));
      if (!product) return null;
      return {
        productId: String(row.productId),
        title: product.title,
        sku: product.sku || '',
        stockUnit: product.stockUnit || 'Pcs',
        qty: row.qty,
        statusBucket: row.statusBucket,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.title.localeCompare(b.title));

  const lastLedger = await StockLedger.findOne({ locationId: rackId })
    .sort({ createdAt: -1 })
    .populate('productId', 'title sku')
    .populate('performedBy', 'name email')
    .lean();

  const stockAgg = aggregateRackStock(stocks);
  const threshold = await getDefaultLowStockThreshold();
  const capacity = rack.capacity ?? null;
  const fillPct =
    capacity && capacity > 0 ? Math.min(1, stockAgg.totalQty / capacity) : null;

  return {
    rack: {
      _id: String(rack._id),
      code: rack.code,
      name: rack.name || '',
      displayPath: formatBranchFloorRackPath(String(rack._id), byId),
      displayPathShort: formatBranchFloorRackPathCodesWithRackName(String(rack._id), byId),
      ...stockAgg,
      capacity,
      fillPct,
      stockStatus: deriveRackStockStatus(stockAgg, threshold),
    },
    items,
    lastMovement: lastLedger
      ? {
          _id: String(lastLedger._id),
          type: lastLedger.type,
          qty: lastLedger.qty,
          statusBucket: lastLedger.statusBucket,
          reason: lastLedger.reason || '',
          remark: lastLedger.remark || '',
          createdAt: lastLedger.createdAt,
          productTitle: lastLedger.productId?.title || '—',
          productSku: lastLedger.productId?.sku || '',
          performedByName: lastLedger.performedBy?.name || lastLedger.performedBy?.email || '—',
        }
      : null,
  };
}
