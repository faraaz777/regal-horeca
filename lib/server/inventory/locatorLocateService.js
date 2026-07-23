import 'server-only';

import mongoose from 'mongoose';
import Location from '@/lib/models/Location';
import Product from '@/lib/models/Product';
import Stock from '@/lib/models/Stock';
import { listCascadeRacks } from '@/lib/server/inventory/locationSelectService';
import { buildInventoryProductQuery } from '@/lib/server/inventory/inventoryProductQuery';

/**
 * Locator find — Stock snapshot is truth for “where is this product on this floor?”
 * Never trust denormalized search badges for location.
 */

async function assertFloor(floorId) {
  const floor = await Location.findById(floorId).select('_id level isActive code name').lean();
  if (!floor || floor.level !== 'floor' || !floor.isActive) {
    throw new Error('Floor not found');
  }
  return floor;
}

async function getFloorRackMeta(floorId) {
  const cascadeRacks = await listCascadeRacks(floorId);
  const rackIds = cascadeRacks.map((r) => r._id);
  const rackDocs = rackIds.length
    ? await Location.find({ _id: { $in: rackIds }, level: 'rack', isActive: true })
        .select('_id code name position')
        .lean()
    : [];
  const byId = new Map(rackDocs.map((r) => [String(r._id), r]));
  const cascadeById = new Map(cascadeRacks.map((r) => [String(r._id), r]));
  return { rackIds, byId, cascadeById };
}

/**
 * Products that have sellable Stock on this floor and match the search term.
 * Returns rack count + total pcs on this floor only.
 *
 * Query order: product search first (indexed), then Stock for those IDs on this
 * floor — never scan every stock row on a large floor just to filter by name.
 */
export async function searchProductsOnFloor(floorId, q, limit = 20) {
  await assertFloor(floorId);
  const term = String(q || '').trim();
  if (!term) return { results: [], floorId: String(floorId) };

  const { rackIds } = await getFloorRackMeta(floorId);
  if (!rackIds.length) return { results: [], floorId: String(floorId) };

  const capped = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const searchFilter = await buildInventoryProductQuery({ search: term });

  /**
   * Over-fetch product matches, then keep only those with Stock on this floor.
   * Cap product candidates so we never pull huge name-match sets into memory.
   */
  const candidateProducts = await Product.find(searchFilter)
    .select('title sku heroImage')
    .limit(Math.min(capped * 5, 100))
    .lean();

  if (!candidateProducts.length) return { results: [], floorId: String(floorId) };

  const candidateIds = candidateProducts.map((p) => p._id);
  const stocks = await Stock.find({
    productId: { $in: candidateIds },
    locationId: { $in: rackIds },
    qty: { $gt: 0 },
    statusBucket: 'sellable',
  })
    .select('productId locationId qty')
    .lean();

  if (!stocks.length) return { results: [], floorId: String(floorId) };

  const byProduct = new Map();
  for (const row of stocks) {
    const pid = String(row.productId);
    if (!byProduct.has(pid)) {
      byProduct.set(pid, { qty: 0, racks: new Set() });
    }
    const agg = byProduct.get(pid);
    agg.qty += Number(row.qty) || 0;
    agg.racks.add(String(row.locationId));
  }

  const results = candidateProducts
    .filter((p) => byProduct.has(String(p._id)))
    .map((p) => {
      const agg = byProduct.get(String(p._id));
      return {
        productId: String(p._id),
        title: p.title || '',
        sku: p.sku || '',
        heroImage: p.heroImage || '',
        rackCount: agg.racks.size,
        totalQty: agg.qty,
      };
    });

  results.sort((a, b) => b.totalQty - a.totalQty || a.title.localeCompare(b.title));

  return { results: results.slice(0, capped), floorId: String(floorId) };
}

/**
 * Resolve every rack on this floor that holds the product (Stock snapshot + layout position).
 */
export async function locateProductOnFloor(floorId, productId) {
  await assertFloor(floorId);
  if (!productId || !mongoose.Types.ObjectId.isValid(String(productId))) {
    throw new Error('Invalid product');
  }

  const product = await Product.findById(productId)
    .select('title sku heroImage')
    .lean();
  if (!product) throw new Error('Product not found');

  const { rackIds, byId, cascadeById } = await getFloorRackMeta(floorId);
  if (!rackIds.length) {
    return {
      productId: String(product._id),
      title: product.title || '',
      sku: product.sku || '',
      heroImage: product.heroImage || '',
      rackCount: 0,
      totalQty: 0,
      locations: [],
    };
  }

  const stocks = await Stock.find({
    productId,
    locationId: { $in: rackIds },
    qty: { $gt: 0 },
    statusBucket: 'sellable',
  })
    .select('locationId qty')
    .lean();

  const qtyByRack = new Map();
  for (const row of stocks) {
    const rid = String(row.locationId);
    qtyByRack.set(rid, (qtyByRack.get(rid) || 0) + (Number(row.qty) || 0));
  }

  const locations = [];
  let totalQty = 0;
  for (const [rid, qty] of qtyByRack) {
    totalQty += qty;
    const doc = byId.get(rid);
    const cascade = cascadeById.get(rid);
    const pos = doc?.position || {};
    locations.push({
      locationId: rid,
      rackCode: doc?.code || cascade?.code || rid,
      rackName: doc?.name || cascade?.name || '',
      qty,
      x: pos.x ?? null,
      y: pos.y ?? null,
      zoneId: pos.zoneId ?? null,
    });
  }

  locations.sort((a, b) => b.qty - a.qty || a.rackCode.localeCompare(b.rackCode));

  return {
    productId: String(product._id),
    title: product.title || '',
    sku: product.sku || '',
    heroImage: product.heroImage || '',
    rackCount: locations.length,
    totalQty,
    locations,
  };
}
