/**
 * Client-side helper to materialize/sync child product documents after the parent
 * is saved. Used by both the admin "Add Product" page and the inline edit modal so
 * the variant-creation logic lives in one place.
 *
 * Behavior:
 * - If a row has `_childProductId`, PATCH it with delta fields.
 * - Otherwise, POST a new child to `/api/admin/products/[parentId]/children`.
 *
 * The parent's `defaultChildProductId` is set as a side-effect of the create/update
 * call when `isDefault: true` is passed.
 *
 * Returns { created, updated, errors } so callers can surface partial failures.
 */

import { buildChildPayloadFromVariantRow } from '@/lib/shared/childVariantPayload';

function pickChildPayload(row, { parent, variationTheme }) {
  return buildChildPayloadFromVariantRow(row, { parent, variationTheme });
}

/**
 * Attach `_childProductId` when we only have legacy embedded variant ids (migrated parents).
 */
async function resolveVariantRowsWithChildIds(parentId, variantRows, authHeaders) {
  const rows = (variantRows || []).map((row) => ({
    ...row,
    _childProductId: row._childProductId ? String(row._childProductId) : null,
  }));

  const needsLookup = rows.some(
    (r) =>
      !r._childProductId &&
      (String(r._legacyParentVariantId || '').trim() || String(r.variantId || '').trim())
  );
  if (!needsLookup) return rows;

  const res = await fetch(`/api/admin/products/${parentId}/children`, {
    headers: authHeaders,
  });
  if (!res.ok) return rows;

  const data = await res.json().catch(() => ({}));
  const children = Array.isArray(data.children) ? data.children : [];
  const byLegacy = new Map();
  for (const child of children) {
    const legacy = String(child.legacyParentVariantId || '').trim();
    if (legacy) byLegacy.set(legacy, String(child._id));
  }

  return rows.map((row) => {
    if (row._childProductId) return row;
    const legacyKey =
      String(row._legacyParentVariantId || '').trim() ||
      String(row.variantId || '').trim();
    if (legacyKey && byLegacy.has(legacyKey)) {
      return { ...row, _childProductId: byLegacy.get(legacyKey) };
    }
    return row;
  });
}

async function deleteChildProduct(childId, authHeaders) {
  const res = await fetch(`/api/admin/products/children/${childId}`, {
    method: 'DELETE',
    headers: authHeaders,
  });
  const body = await res.json().catch(() => ({}));
  const alreadyDeleted =
    body.alreadyDeleted === true ||
    (res.status === 400 &&
      String(body.error || '').toLowerCase().includes('already deleted'));
  if (!res.ok && !alreadyDeleted) {
    throw new Error(body.error || `Delete child failed (${res.status})`);
  }
}

export async function saveProductChildren({
  parentId,
  parent,
  variantRows,
  variationTheme,
  initialChildIds = [],
}) {
  if (!parentId) throw new Error('saveProductChildren: parentId is required');

  const token = typeof window !== 'undefined' ? localStorage.getItem('regal_admin_token') : null;
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  let created = 0;
  let updated = 0;
  let deleted = 0;
  const errors = [];

  const keptChildIds = new Set(
    (variantRows || [])
      .map((row) => row?._childProductId)
      .filter(Boolean)
      .map((id) => String(id))
  );
  const orphanIds = (initialChildIds || [])
    .map((id) => String(id))
    .filter((id) => id && !keptChildIds.has(id));

  for (const childId of orphanIds) {
    try {
      await deleteChildProduct(childId, authHeaders);
      deleted += 1;
    } catch (err) {
      errors.push({ childId, message: err?.message || String(err) });
    }
  }

  if (!Array.isArray(variantRows) || variantRows.length === 0) {
    return { created, updated, deleted, errors };
  }

  const resolvedRows = await resolveVariantRowsWithChildIds(parentId, variantRows, authHeaders);

  for (const row of resolvedRows) {
    const payload = pickChildPayload(row, { parent, variationTheme });
    const childId = row._childProductId ? String(row._childProductId) : null;
    try {
      if (childId) {
        const res = await fetch(`/api/admin/products/children/${childId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Update child failed (${res.status})`);
        }
        updated += 1;
      } else {
        const res = await fetch(`/api/admin/products/${parentId}/children`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Create child failed (${res.status})`);
        }
        created += 1;
      }
    } catch (err) {
      errors.push({ row, message: err?.message || String(err) });
    }
  }

  return { created, updated, deleted, errors };
}
