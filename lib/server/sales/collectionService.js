/**
 * Collection Service
 *
 * Responsible for:
 * - Personal sales collections (CRUD)
 * - Collection items (single + batch add)
 * - Presentation-set photo + pins
 * - Adding a collection into a draft bucket
 *
 * Does NOT handle catalog search or inventory.
 */

import 'server-only';

import SalesCollection from '@/lib/models/SalesCollection';
import { assertOwnsResource } from '@/lib/server/sales/salesAccess';
import { getCatalogItemsByProductIds } from '@/lib/server/sales/catalogService';
import { addProductToBucket } from '@/lib/server/sales/bucketService';
import { writeAuditLog } from '@/lib/server/audit/writeAuditLog';
import {
  deleteSalesCollectionScenes,
  deleteSalesCollectionThumbnail,
  isAllowedSalesCollectionSceneUrl,
  isAllowedSalesCollectionThumbnailUrl,
} from '@/lib/server/sales/collectionThumbnail';
import {
  MAX_PRESENTATION_PINS_PER_SCENE,
  MAX_PRESENTATION_SCENES,
} from '@/lib/shared/salesConstants';
import {
  presentationSceneUrls,
  scenesFromPresentationSet,
} from '@/lib/shared/presentationSet';

function toSummary(doc) {
  return {
    _id: String(doc._id),
    name: doc.name,
    description: doc.description || '',
    thumbnailUrl: doc.thumbnailUrl || '',
    pinned: Boolean(doc.pinned),
    itemCount: doc.items?.length || 0,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/**
 * Scene photos stay off the collections list — only the detail payload includes them.
 * Pins for products missing from the catalog are still returned; the UI hides those pins.
 * Legacy single-photo documents are folded into scenes[] so the client has one shape.
 */
function toPresentationSet(doc) {
  const scenes = scenesFromPresentationSet(doc.presentationSet).map((scene) => ({
    _id: scene._id,
    imageUrl: scene.imageUrl,
    pins: (scene.pins || []).map((pin) => ({
      _id: pin._id,
      productId: String(pin.productId),
      xPct: pin.xPct,
      yPct: pin.yPct,
    })),
  }));
  return { scenes };
}

function incomingScenesFromPatch(patchSet) {
  if (Array.isArray(patchSet.scenes)) return patchSet.scenes;
  const url = String(patchSet.imageUrl || '').trim();
  if (!url) return [];
  return [{ imageUrl: url, pins: patchSet.pins || [] }];
}

function sanitizePresentationPins(rawPins, itemIds) {
  return (rawPins || [])
    .filter((pin) => itemIds.has(String(pin.productId)))
    .slice(0, MAX_PRESENTATION_PINS_PER_SCENE)
    .map((pin) => {
      const row = {
        productId: pin.productId,
        xPct: pin.xPct,
        yPct: pin.yPct,
      };
      if (pin._id) row._id = pin._id;
      return row;
    });
}

/**
 * Only R2 scene-folder URLs are stored. Duplicate URLs are skipped.
 * Invalid URLs fail the whole PATCH so the client never thinks a bad URL saved.
 */
function sanitizePresentationScenes(rawScenes, itemIds) {
  if (rawScenes.length > MAX_PRESENTATION_SCENES) {
    return { error: 'too_many_scenes' };
  }

  const scenes = [];
  const seen = new Set();

  for (const raw of rawScenes) {
    const url = String(raw?.imageUrl || '').trim();
    if (!url) continue;
    if (!isAllowedSalesCollectionSceneUrl(url)) {
      return { error: 'invalid_scene' };
    }
    if (seen.has(url)) continue;
    seen.add(url);
    scenes.push({
      ...(raw._id ? { _id: raw._id } : {}),
      imageUrl: url,
      pins: sanitizePresentationPins(raw.pins, itemIds),
    });
  }

  return { scenes };
}

function dropPinsForProduct(collection, productId) {
  const ps = collection.presentationSet;
  if (!ps) return;

  let changed = false;
  if (ps.scenes?.length) {
    for (const scene of ps.scenes) {
      if (!scene.pins?.length) continue;
      scene.pins = scene.pins.filter((pin) => String(pin.productId) !== String(productId));
    }
    changed = true;
  }
  if (ps.pins?.length) {
    ps.pins = ps.pins.filter((pin) => String(pin.productId) !== String(productId));
    changed = true;
  }
  if (changed) collection.markModified('presentationSet');
}

async function assertCollectionAccess(session, collection) {
  if (!collection) return { error: 'not_found' };
  if (!assertOwnsResource(session, collection)) return { error: 'forbidden' };
  return { collection };
}

export async function listCollections(session) {
  const docs = await SalesCollection.find({ salesUserId: session.userId })
    .sort({ pinned: -1, updatedAt: -1 })
    .lean();

  return docs.map(toSummary);
}

export async function createCollection(session, { name, description, thumbnailUrl }, request) {
  const thumb = thumbnailUrl?.trim() || '';
  if (thumb && !isAllowedSalesCollectionThumbnailUrl(thumb)) {
    return { error: 'invalid_thumbnail' };
  }

  const collection = await SalesCollection.create({
    salesUserId: session.userId,
    name: name.trim(),
    description: description?.trim() || '',
    thumbnailUrl: thumb,
    items: [],
  });

  await writeAuditLog({
    userId: session.userId,
    action: 'sales.collection.created',
    entityType: 'SalesCollection',
    entityId: collection._id,
    after: { name: collection.name },
    request,
  });

  return toSummary(collection.toObject());
}

export async function getCollectionDetail(session, collectionId) {
  const collection = await SalesCollection.findById(collectionId).lean();
  const access = await assertCollectionAccess(session, collection);
  if (access.error) return access;

  const sortedItems = [...(collection.items || [])].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  );
  const productIds = sortedItems.map((i) => i.productId);
  const catalogItems = await getCatalogItemsByProductIds(productIds);
  const catalogById = new Map(catalogItems.map((p) => [p.id, p]));

  const products = sortedItems
    .map((item) => {
      const product = catalogById.get(String(item.productId));
      if (!product) return null;
      return {
        ...product,
        collectionNote: item.note || '',
        suggestedQty: item.suggestedQty ?? 1,
      };
    })
    .filter(Boolean);

  return {
    collection: {
      _id: String(collection._id),
      name: collection.name,
      description: collection.description || '',
      thumbnailUrl: collection.thumbnailUrl || '',
      pinned: Boolean(collection.pinned),
      itemCount: collection.items?.length || 0,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
      presentationSet: toPresentationSet(collection),
    },
    products,
  };
}

export async function updateCollection(session, collectionId, patch, request) {
  const collection = await SalesCollection.findById(collectionId);
  const access = await assertCollectionAccess(session, collection);
  if (access.error) return access;

  if (patch.name !== undefined) collection.name = String(patch.name).trim();
  if (patch.description !== undefined) collection.description = String(patch.description).trim();
  if (patch.pinned !== undefined) collection.pinned = Boolean(patch.pinned);

  if (patch.thumbnailUrl !== undefined) {
    const next = String(patch.thumbnailUrl).trim();
    if (next && !isAllowedSalesCollectionThumbnailUrl(next)) {
      return { error: 'invalid_thumbnail' };
    }
    const prev = collection.thumbnailUrl || '';
    if (next !== prev) {
      collection.thumbnailUrl = next;
      if (prev) await deleteSalesCollectionThumbnail(prev);
    }
  }

  if (patch.presentationSet !== undefined) {
    const itemIds = new Set((collection.items || []).map((i) => String(i.productId)));
    const sanitized = sanitizePresentationScenes(
      incomingScenesFromPatch(patch.presentationSet),
      itemIds
    );
    if (sanitized.error) return sanitized;

    const prevUrls = presentationSceneUrls(collection.presentationSet);
    const nextUrls = sanitized.scenes.map((scene) => scene.imageUrl);

    collection.presentationSet = {
      scenes: sanitized.scenes,
      imageUrl: '',
      pins: [],
    };
    collection.markModified('presentationSet');

    const removed = prevUrls.filter((url) => !nextUrls.includes(url));
    if (removed.length) await deleteSalesCollectionScenes(removed);
  }

  await collection.save();

  await writeAuditLog({
    userId: session.userId,
    action: 'sales.collection.updated',
    entityType: 'SalesCollection',
    entityId: collection._id,
    after: { name: collection.name, pinned: collection.pinned },
    request,
  });

  return { collection: toSummary(collection.toObject()) };
}

export async function deleteCollection(session, collectionId, request) {
  const collection = await SalesCollection.findById(collectionId);
  const access = await assertCollectionAccess(session, collection);
  if (access.error) return access;

  const thumb = collection.thumbnailUrl || '';
  const sceneUrls = presentationSceneUrls(collection.presentationSet);
  await SalesCollection.deleteOne({ _id: collection._id });
  if (thumb) await deleteSalesCollectionThumbnail(thumb);
  if (sceneUrls.length) await deleteSalesCollectionScenes(sceneUrls);

  await writeAuditLog({
    userId: session.userId,
    action: 'sales.collection.deleted',
    entityType: 'SalesCollection',
    entityId: collectionId,
    request,
  });

  return { success: true };
}

export async function addCollectionItem(session, collectionId, itemInput, request) {
  const collection = await SalesCollection.findById(collectionId);
  const access = await assertCollectionAccess(session, collection);
  if (access.error) return access;

  const productId = String(itemInput.productId);
  const existingIdx = collection.items.findIndex((i) => String(i.productId) === productId);

  if (existingIdx >= 0) {
    if (itemInput.note !== undefined) collection.items[existingIdx].note = itemInput.note || '';
    if (itemInput.suggestedQty !== undefined) {
      collection.items[existingIdx].suggestedQty = itemInput.suggestedQty;
    }
  } else {
    const maxOrder = collection.items.reduce((m, i) => Math.max(m, i.sortOrder ?? 0), -1);
    collection.items.push({
      productId: itemInput.productId,
      sortOrder: maxOrder + 1,
      note: itemInput.note || '',
      suggestedQty: itemInput.suggestedQty ?? 1,
    });
  }

  await collection.save();

  await writeAuditLog({
    userId: session.userId,
    action: 'sales.collection.item_added',
    entityType: 'SalesCollection',
    entityId: collection._id,
    after: { productId, itemCount: collection.items.length },
    request,
  });

  return { collection: toSummary(collection.toObject()) };
}

/**
 * Adds several products in one document save.
 * Duplicates already in the collection are skipped (same upsert rule as single add).
 */
export async function addCollectionItems(session, collectionId, productIds, request) {
  const collection = await SalesCollection.findById(collectionId);
  const access = await assertCollectionAccess(session, collection);
  if (access.error) return access;

  const existing = new Set((collection.items || []).map((i) => String(i.productId)));
  let maxOrder = collection.items.reduce((m, i) => Math.max(m, i.sortOrder ?? 0), -1);
  let added = 0;

  for (const rawId of productIds) {
    const productId = String(rawId);
    if (existing.has(productId)) continue;
    maxOrder += 1;
    collection.items.push({
      productId,
      sortOrder: maxOrder,
      note: '',
      suggestedQty: 1,
    });
    existing.add(productId);
    added += 1;
  }

  if (added > 0) {
    await collection.save();
  }

  await writeAuditLog({
    userId: session.userId,
    action: 'sales.collection.items_added',
    entityType: 'SalesCollection',
    entityId: collection._id,
    after: { added, requested: productIds.length, itemCount: collection.items.length },
    request,
  });

  return { collection: toSummary(collection.toObject()), added };
}

export async function removeCollectionItem(session, collectionId, productId, request) {
  const collection = await SalesCollection.findById(collectionId);
  const access = await assertCollectionAccess(session, collection);
  if (access.error) return access;

  const before = collection.items.length;
  collection.items = collection.items.filter((i) => String(i.productId) !== String(productId));

  if (collection.items.length === before) {
    return { error: 'item_not_found' };
  }

  dropPinsForProduct(collection, productId);
  await collection.save();

  await writeAuditLog({
    userId: session.userId,
    action: 'sales.collection.item_removed',
    entityType: 'SalesCollection',
    entityId: collection._id,
    after: { productId: String(productId), itemCount: collection.items.length },
    request,
  });

  return { collection: toSummary(collection.toObject()) };
}

export async function addCollectionToBucket(session, collectionId, bucketId, request) {
  const collection = await SalesCollection.findById(collectionId).lean();
  const access = await assertCollectionAccess(session, collection);
  if (access.error) return access;

  const sortedItems = [...(collection.items || [])].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  );

  if (sortedItems.length === 0) {
    return { error: 'empty_collection' };
  }

  let bucket;
  let added = 0;
  const skipped = [];

  for (const item of sortedItems) {
    const result = await addProductToBucket(
      session,
      bucketId,
      {
        productId: String(item.productId),
        quantity: item.suggestedQty ?? 1,
      },
      request
    );

    if (result.error) {
      if (result.error === 'invalid_product') {
        skipped.push({ productId: String(item.productId), reason: 'invalid_product' });
        continue;
      }
      return result;
    }

    bucket = result.bucket;
    added += 1;
  }

  await writeAuditLog({
    userId: session.userId,
    action: 'sales.collection.added_to_bucket',
    entityType: 'SalesCollection',
    entityId: collectionId,
    after: { bucketId, added, skipped: skipped.length },
    request,
  });

  return { bucket, added, skipped };
}
