import 'server-only';

import mongoose from 'mongoose';
import Product from '@/lib/models/Product';

/**
 * Related Products mutual sync (Phase 1)
 *
 * Source of truth: each product's `relatedProductIds` array, kept symmetric on write.
 *
 * Rules:
 * - Mutual on save: A adds B ⇒ B gets A; A removes B ⇒ B loses A
 * - No sibling fan-out (exact ids only)
 * - Targets must be sellable rows (standalone | child) for *new* links
 * - Parent ids already on the document are preserved (family reverse / legacy)
 * - Self-links and soft-deleted targets are stripped
 * - Frequently ordered together is NOT synced here
 */

function toIdString(id) {
  if (id == null) return '';
  if (typeof id === 'object' && id._id != null) return String(id._id);
  return String(id);
}

function toObjectId(id) {
  const s = toIdString(id);
  if (!mongoose.Types.ObjectId.isValid(s)) return null;
  return new mongoose.Types.ObjectId(s);
}

function uniqueIdStrings(ids) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(ids) ? ids : []) {
    const id = toIdString(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Sanitize related ids before they are written on the owning product.
 *
 * @param {unknown[]} rawIds
 * @param {{ selfId?: unknown, previousIds?: unknown[] }} [options]
 * @returns {Promise<import('mongoose').Types.ObjectId[]>}
 */
export async function sanitizeRelatedProductIds(rawIds, { selfId = null, previousIds = [] } = {}) {
  const self = toIdString(selfId);
  const prevSet = new Set(uniqueIdStrings(previousIds));
  const candidates = uniqueIdStrings(rawIds).filter((id) => id && id !== self);

  if (candidates.length === 0) return [];

  const objectIds = candidates.map(toObjectId).filter(Boolean);
  if (objectIds.length === 0) return [];

  const docs = await Product.find({ _id: { $in: objectIds } })
    .select('_id productType deletedAt')
    .lean();

  const byId = new Map(docs.map((d) => [String(d._id), d]));
  const sanitized = [];

  for (const id of candidates) {
    const doc = byId.get(id);
    if (!doc || doc.deletedAt) continue;

    const type = doc.productType || 'standalone';
    if (type === 'parent') {
      /**
       * Never accept a *new* parent pick (API/UI bypass).
       * Keep parents already stored so family reverse links and legacy rows survive edits.
       */
      if (prevSet.has(id)) sanitized.push(doc._id);
      continue;
    }

    if (type === 'child' || type === 'standalone') {
      sanitized.push(doc._id);
    }
  }

  return sanitized;
}

/**
 * Diff previous vs next related ids and mirror onto peer documents.
 *
 * @returns {Promise<{ added: string[], removed: string[] }>}
 */
export async function syncRelatedProductLinks({
  productId,
  previousIds = [],
  nextIds = [],
  session = null,
} = {}) {
  const self = toIdString(productId);
  if (!self || !mongoose.Types.ObjectId.isValid(self)) {
    return { added: [], removed: [] };
  }

  const prev = new Set(uniqueIdStrings(previousIds));
  const next = new Set(uniqueIdStrings(nextIds));
  next.delete(self);

  const added = [...next].filter((id) => !prev.has(id));
  const removed = [...prev].filter((id) => !next.has(id));

  if (added.length === 0 && removed.length === 0) {
    return { added: [], removed: [] };
  }

  const selfOid = new mongoose.Types.ObjectId(self);
  const opts = session ? { session } : {};

  if (added.length > 0) {
    const addedOids = added.map(toObjectId).filter(Boolean);
    if (addedOids.length > 0) {
      /**
       * Reverse-link this product onto peers.
       * When `self` is a parent (family default), peers intentionally receive the parent id.
       */
      await Product.updateMany(
        { _id: { $in: addedOids }, deletedAt: null },
        { $addToSet: { relatedProductIds: selfOid } },
        opts
      );
    }
  }

  if (removed.length > 0) {
    const removedOids = removed.map(toObjectId).filter(Boolean);
    if (removedOids.length > 0) {
      await Product.updateMany(
        { _id: { $in: removedOids } },
        { $pull: { relatedProductIds: selfOid } },
        opts
      );
    }
  }

  return { added, removed };
}

/**
 * Remove this product from every other product's related list (soft-delete / hard-delete hygiene).
 */
export async function pullProductFromAllRelatedLists(productId, { session = null } = {}) {
  const oid = toObjectId(productId);
  if (!oid) return;

  const opts = session ? { session } : {};
  await Product.updateMany(
    { relatedProductIds: oid },
    { $pull: { relatedProductIds: oid } },
    opts
  );
}
