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

function pickChildPayload(row, { variationTheme }) {
  return {
    variationAttributes: {
      size: String(row.size || '').trim(),
      color: String(row.color || '').trim(),
      weight: String(row.weight || '').trim(),
      unitCount: String(row.unitCount || '').trim(),
    },
    sku: String(row.sku || '').trim(),
    barcode: String(row.barcode || '').trim(),
    hsnCode: String(row.hsnCode || '').trim(),
    gstPercent: Number(row.gstPercent || 0),
    mrp: Number(row.mrp || 0),
    sellingPrice: Number(row.sellingPrice || 0),
    discountPercent: Number(row.discountPercent || 0),
    marginPrice: Number(row.marginPrice || 0),
    price: Number(row.price ?? row.sellingPrice ?? 0),
    images: Array.isArray(row.images) ? row.images.filter(Boolean) : [],
    visibleOnClient: row.visibleOnClient === false ? false : true,
    isDefault: Boolean(row.isDefault),
    legacyParentVariantId: String(row._legacyParentVariantId || '').trim(),
    ...(Array.isArray(variationTheme) && variationTheme.length > 0 ? { variationTheme } : {}),
  };
}

export async function saveProductChildren({ parentId, variantRows, variationTheme }) {
  if (!parentId) throw new Error('saveProductChildren: parentId is required');
  if (!Array.isArray(variantRows) || variantRows.length === 0) {
    return { created: 0, updated: 0, errors: [] };
  }

  const token = typeof window !== 'undefined' ? localStorage.getItem('regal_admin_token') : null;
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  let created = 0;
  let updated = 0;
  const errors = [];

  for (const row of variantRows) {
    const payload = pickChildPayload(row, { variationTheme });
    const childId = row._childProductId;
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

  return { created, updated, errors };
}
