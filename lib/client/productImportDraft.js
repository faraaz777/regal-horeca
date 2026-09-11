/**
 * Session hand-off from Products list Import → Add Product form.
 * Same idea as duplicateProductData: no _id, so Save creates a new product.
 */

export const IMPORT_DRAFT_STORAGE_KEY = 'importProductDraft';

export function storeImportProductDraft(payload) {
  sessionStorage.setItem(IMPORT_DRAFT_STORAGE_KEY, JSON.stringify(payload));
}

export function readImportProductDraft() {
  const raw = sessionStorage.getItem(IMPORT_DRAFT_STORAGE_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(IMPORT_DRAFT_STORAGE_KEY);
  return JSON.parse(raw);
}
