/**
 * Local draft for Admin → Add Product.
 *
 * Strategy A: persist to localStorage on field-complete (blur) and on any
 * variant-section change. Survives reload / browser tab restore. Does not
 * create a server product until Save.
 */

export const PRODUCT_ADD_DRAFT_STORAGE_KEY = 'regal_product_add_draft_v1';
export const PRODUCT_ADD_DRAFT_VERSION = 1;

const EPHEMERAL_FORM_KEYS = new Set([
  // Keep payload lean / serializable — never persist runtime-only blobs.
]);

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/**
 * Drop non-JSON values and dead blob: URLs (they do not survive reload).
 */
export function sanitizeDraftValue(value) {
  if (value == null) return value;
  if (typeof value === 'string') {
    if (value.startsWith('blob:')) return '';
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDraftValue(item)).filter((item) => item !== undefined);
  }
  if (typeof value === 'object') {
    if (typeof File !== 'undefined' && value instanceof File) return undefined;
    if (typeof Blob !== 'undefined' && value instanceof Blob) return undefined;
    const out = {};
    for (const [key, nested] of Object.entries(value)) {
      if (EPHEMERAL_FORM_KEYS.has(key)) continue;
      const next = sanitizeDraftValue(nested);
      if (next !== undefined) out[key] = next;
    }
    return out;
  }
  return undefined;
}

export function buildProductAddDraft({
  formData = {},
  variantRows = [],
  variantFieldSelection = {},
  variantBuilderInputs = {},
  variantDraftValue = {},
  hasVariantsChoice = null,
  currentStep = 'product',
  bulkVariantInputs = {},
} = {}) {
  return {
    version: PRODUCT_ADD_DRAFT_VERSION,
    savedAt: new Date().toISOString(),
    formData: sanitizeDraftValue(formData) || {},
    variantRows: sanitizeDraftValue(variantRows) || [],
    variantFieldSelection: sanitizeDraftValue(variantFieldSelection) || {},
    variantBuilderInputs: sanitizeDraftValue(variantBuilderInputs) || {},
    variantDraftValue: sanitizeDraftValue(variantDraftValue) || {},
    hasVariantsChoice:
      hasVariantsChoice === true || hasVariantsChoice === false ? hasVariantsChoice : null,
    currentStep: String(currentStep || 'product'),
    bulkVariantInputs: sanitizeDraftValue(bulkVariantInputs) || {},
  };
}

/**
 * True when the operator has entered anything worth restoring / warning about.
 */
export function isMeaningfulProductDraft(draft) {
  if (!draft || typeof draft !== 'object') return false;

  const formData = draft.formData || {};
  const title = String(formData.title || '').trim();
  const sku = String(formData.sku || '').trim();
  const barcode = String(formData.barcode || '').trim();
  const brand = String(formData.brand || '').trim();
  const heroImage = String(formData.heroImage || '').trim();
  const summary = String(formData.summary || '').replace(/<[^>]+>/g, '').trim();
  const description = String(formData.description || '').replace(/<[^>]+>/g, '').trim();
  const tagsInput = String(formData.tagsInput || '').trim();
  const colorVariants = Array.isArray(formData.colorVariants) ? formData.colorVariants : [];
  const specifications = Array.isArray(formData.specifications) ? formData.specifications : [];
  const gallery = Array.isArray(formData.gallery) ? formData.gallery : [];
  const variantRows = Array.isArray(draft.variantRows) ? draft.variantRows : [];
  const builder = draft.variantBuilderInputs || {};
  const hasBuilderValues = Object.values(builder).some((v) => String(v || '').trim());
  const hasAxisSelection = Object.values(draft.variantFieldSelection || {}).some(Boolean);

  if (title || sku || barcode || brand || heroImage || summary || description || tagsInput) return true;
  if (formData.categoryId || formData.brandCategoryId) return true;
  if (gallery.length > 0) return true;
  if (colorVariants.some((c) => String(c?.colorName || '').trim())) return true;
  if (specifications.some((s) => String(s?.label || s?.value || '').trim())) return true;
  if (variantRows.length > 0) return true;
  if (hasBuilderValues || hasAxisSelection) return true;
  if (draft.hasVariantsChoice === true || draft.hasVariantsChoice === false) return true;

  return false;
}

export function saveProductAddDraft(draft) {
  if (!isBrowser()) return { ok: false, error: 'not_browser' };
  try {
    const payload = buildProductAddDraft(draft);
    if (!isMeaningfulProductDraft(payload)) {
      // Empty form — remove stale draft so restore does not resurrect blanks.
      window.localStorage.removeItem(PRODUCT_ADD_DRAFT_STORAGE_KEY);
      return { ok: true, cleared: true };
    }
    window.localStorage.setItem(PRODUCT_ADD_DRAFT_STORAGE_KEY, JSON.stringify(payload));
    return { ok: true, cleared: false };
  } catch (error) {
    return { ok: false, error: error?.name || error?.message || 'save_failed' };
  }
}

export function readProductAddDraft() {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(PRODUCT_ADD_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.version !== PRODUCT_ADD_DRAFT_VERSION) return null;
    if (!isMeaningfulProductDraft(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearProductAddDraft() {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(PRODUCT_ADD_DRAFT_STORAGE_KEY);
  } catch {
    // ignore
  }
}
