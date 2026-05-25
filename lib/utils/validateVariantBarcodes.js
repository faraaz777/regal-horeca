/**
 * Client-side variant barcode checks (in-form duplicates + server catalog lookup).
 */

function normalizeBarcode(value) {
  return String(value ?? '').trim();
}

/**
 * @param {Array<{ barcode?: string }>} rows
 * @returns {string|null} Error message or null if ok
 */
export function findDuplicateBarcodesInRows(rows) {
  const seen = new Map();
  for (let i = 0; i < (rows || []).length; i += 1) {
    const barcode = normalizeBarcode(rows[i]?.barcode);
    if (!barcode) continue;
    if (seen.has(barcode)) {
      return `Duplicate barcode "${barcode}" in variant rows #${seen.get(barcode) + 1} and #${i + 1}.`;
    }
    seen.set(barcode, i);
  }
  return null;
}

/**
 * @param {Array<{ barcode?: string, _childProductId?: string|null }>} rows
 * @param {{ parentProductId?: string }} [opts]
 * @returns {Promise<string|null>}
 */
export async function validateVariantBarcodesAgainstCatalog(rows, opts = {}) {
  const localError = findDuplicateBarcodesInRows(rows);
  if (localError) return localError;

  const barcodes = [
    ...new Set(
      (rows || []).map((r) => normalizeBarcode(r?.barcode)).filter(Boolean)
    ),
  ];
  if (barcodes.length === 0) return null;

  const excludeProductIds = [
    opts.parentProductId ? String(opts.parentProductId) : '',
    ...(rows || []).map((r) => r?._childProductId).filter(Boolean).map(String),
  ].filter(Boolean);

  const token =
    typeof window !== 'undefined' ? localStorage.getItem('regal_admin_token') : null;
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const parentId = opts.parentProductId ? String(opts.parentProductId) : '';
  const excludeEmbeddedLegacyVariantIds = (rows || [])
    .flatMap((r) => [
      String(r?._legacyParentVariantId || '').trim(),
      String(r?.variantId || '').trim(),
    ])
    .filter(Boolean);

  const res = await fetch('/api/admin/products/check-barcodes', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      barcodes,
      excludeProductIds,
      excludeParentEmbeddedId: parentId,
      excludeEmbeddedLegacyVariantIds,
    }),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return data.error || 'Could not verify barcode uniqueness. Try again.';
  }

  if (data.ok) return null;

  const first = data.conflicts?.[0];
  if (first?.barcode) {
    return `Barcode "${first.barcode}" is already used by "${first.title}".`;
  }
  return 'One or more barcodes already exist on another product.';
}
