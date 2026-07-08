import 'server-only';

import SalesCollection from '@/lib/models/SalesCollection';
import { assertOwnsResource } from '@/lib/server/sales/salesAccess';
import { getCatalogItemsByProductIds } from '@/lib/server/sales/catalogService';
import { addProductToBucket } from '@/lib/server/sales/bucketService';
import { writeAuditLog } from '@/lib/server/audit/writeAuditLog';
import {
  deleteSalesCollectionThumbnail,
  isAllowedSalesCollectionThumbnailUrl,
} from '@/lib/server/sales/collectionThumbnail';

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
  await SalesCollection.deleteOne({ _id: collection._id });
  if (thumb) await deleteSalesCollectionThumbnail(thumb);

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

export async function removeCollectionItem(session, collectionId, productId, request) {
  const collection = await SalesCollection.findById(collectionId);
  const access = await assertCollectionAccess(session, collection);
  if (access.error) return access;

  const before = collection.items.length;
  collection.items = collection.items.filter((i) => String(i.productId) !== String(productId));

  if (collection.items.length === before) {
    return { error: 'item_not_found' };
  }

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
