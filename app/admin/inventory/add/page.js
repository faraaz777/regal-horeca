'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { Search, ArrowLeft, Package, Loader2 } from 'lucide-react';
import { adminJson } from '@/lib/client/adminFetch';
import { useDebounce } from '@/hooks/useDebounce';
import { canWriteInventory } from '@/lib/shared/permissions';
import AllocateStockPanel from '@/components/admin/inventory/AllocateStockPanel';

const fetcher = (url) => adminJson(url);

const SEARCH_STATUS_STYLES = {
  in: 'bg-sky-100 text-sky-800',
  out: 'bg-gray-100 text-gray-600',
};

/**
 * Search is discovery — badges only, never live qty numbers.
 */
function SearchStockBadges({ product }) {
  const inInventory = Boolean(product.hasStock);
  const dead = Boolean(product.isDeadStock || product.condition === 'HAS_DEAD_STOCK');

  return (
    <span className="inline-flex flex-wrap items-center gap-1 mt-1">
      <span
        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
          inInventory ? SEARCH_STATUS_STYLES.in : SEARCH_STATUS_STYLES.out
        }`}
      >
        {inInventory ? 'In inventory' : 'Not in inventory'}
      </span>
      {dead ? (
        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-900">
          Dead stock
        </span>
      ) : null}
    </span>
  );
}

const EMPTY_OPENING = {
  openingQty: '',
  minStock: '',
  maxStock: '',
  deadStockPeriod: 'month',
  deadStockQty: '',
  selectedLocations: [],
  openingStatusBucket: 'sellable',
  markAsDeadStock: false,
  openingReason: 'opening_stock',
  remark: '',
};

function parsePositiveInt(value) {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? 0 : n;
}

const CACHE_STORAGE_KEY = 'regal_inventory_add_draft_v1';

// Unique load token generated each time the JavaScript bundle executes on a page load.
// When the page is reloaded (F5 / browser refresh), this token changes, automatically invalidating stale storage.
const CURRENT_PAGE_LOAD_ID =
  typeof window !== 'undefined'
    ? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    : 'ssr';

// In-memory module cache: persists across Next.js client-side page switches and product changes
let memoryCache = {
  pageLoadId: CURRENT_PAGE_LOAD_ID,
  activeProduct: null,
  activeOpening: null,
  searchQ: '',
  draftsByProductId: {},
};

function isPageReload() {
  if (typeof window === 'undefined') return false;
  try {
    const navEntries = performance.getEntriesByType?.('navigation');
    if (navEntries && navEntries.length > 0) {
      return navEntries[0].type === 'reload';
    }
    if (window.performance?.navigation) {
      return window.performance.navigation.type === 1;
    }
  } catch {}
  return false;
}

function clearAllDraftCache() {
  memoryCache = {
    pageLoadId: CURRENT_PAGE_LOAD_ID,
    activeProduct: null,
    activeOpening: null,
    searchQ: '',
    draftsByProductId: {},
  };
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem(CACHE_STORAGE_KEY);
    } catch {}
  }
}

function loadDraftCache() {
  if (typeof window === 'undefined') return null;

  // If the browser just reloaded this page, wipe the cache so the page starts fresh
  if (isPageReload()) {
    clearAllDraftCache();
    return null;
  }

  // 1. Check in-memory cache first (persists across Next.js client-side page switching)
  if (
    memoryCache &&
    memoryCache.pageLoadId === CURRENT_PAGE_LOAD_ID &&
    (memoryCache.activeProduct ||
      Object.keys(memoryCache.draftsByProductId || {}).length > 0)
  ) {
    return memoryCache;
  }

  // 2. Fall back to sessionStorage if matching this page load
  try {
    const raw = sessionStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.pageLoadId === CURRENT_PAGE_LOAD_ID) {
      memoryCache = parsed;
      return parsed;
    } else {
      // Created in an earlier browser load before reload — discard it
      sessionStorage.removeItem(CACHE_STORAGE_KEY);
      return null;
    }
  } catch {
    return null;
  }
}

function saveDraftCache({ activeProduct, activeOpening, searchQ }) {
  if (typeof window === 'undefined') return;

  const drafts = { ...(memoryCache.draftsByProductId || {}) };
  if (activeProduct?._id) {
    drafts[String(activeProduct._id)] = {
      product: activeProduct,
      opening: activeOpening || EMPTY_OPENING,
    };
  }

  memoryCache = {
    pageLoadId: CURRENT_PAGE_LOAD_ID,
    activeProduct: activeProduct || null,
    activeOpening: activeOpening || null,
    searchQ: typeof searchQ === 'string' ? searchQ : memoryCache.searchQ || '',
    draftsByProductId: drafts,
  };

  try {
    sessionStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(memoryCache));
  } catch {}
}

function discardProductDraft(productId) {
  if (!productId) return;
  const idStr = String(productId);
  if (memoryCache?.draftsByProductId) {
    delete memoryCache.draftsByProductId[idStr];
  }
  if (
    memoryCache?.activeProduct &&
    String(memoryCache.activeProduct._id) === idStr
  ) {
    memoryCache.activeProduct = null;
    memoryCache.activeOpening = null;
  }
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(memoryCache));
    } catch {}
  }
}

export default function AddToInventoryPage() {
  const router = useRouter();
  const { data: meData } = useSWR('/api/auth/me', fetcher);
  const role = meData?.user?.role;
  const canRecordStock = canWriteInventory(role);

  const [searchQ, setSearchQ] = useState('');
  const debouncedQ = useDebounce(searchQ.trim(), 300);
  const isSearchPending = searchQ.trim() !== debouncedQ;
  const [selected, setSelected] = useState(null);
  const [opening, setOpening] = useState(EMPTY_OPENING);
  const [submitting, setSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const isNavigatingAwayAllowedRef = useRef(false);
  const isHydratedRef = useRef(false);

  // Restore cached draft on client mount if not reloaded
  useEffect(() => {
    isHydratedRef.current = true;
    const cached = loadDraftCache();
    if (cached) {
      if (cached.activeProduct) {
        setSelected(cached.activeProduct);
        if (cached.activeOpening) {
          setOpening(cached.activeOpening);
        }
      } else if (cached.searchQ) {
        setSearchQ(cached.searchQ);
      }
    }
  }, []);

  // Sync to cache whenever product, opening details, or search query change
  useEffect(() => {
    if (!isHydratedRef.current) return;
    saveDraftCache({
      activeProduct: selected,
      activeOpening: opening,
      searchQ,
    });
  }, [selected, opening, searchQ]);

  const hasUnsavedChanges = useMemo(() => {
    if (!selected) return false;
    const hasQty =
      opening.openingQty !== '' &&
      opening.openingQty !== undefined &&
      opening.openingQty !== null;
    const hasLocations =
      Array.isArray(opening.selectedLocations) &&
      opening.selectedLocations.length > 0;
    const hasMin =
      opening.minStock !== '' &&
      opening.minStock !== undefined &&
      opening.minStock !== null;
    const hasMax =
      opening.maxStock !== '' &&
      opening.maxStock !== undefined &&
      opening.maxStock !== null;
    const hasDeadQty =
      opening.deadStockQty !== '' &&
      opening.deadStockQty !== undefined &&
      opening.deadStockQty !== null;
    const hasRemark = Boolean(opening.remark && opening.remark.trim());
    const hasDeadStockFlag = Boolean(opening.markAsDeadStock);
    const changedPeriod = Boolean(
      opening.deadStockPeriod && opening.deadStockPeriod !== 'month'
    );
    const changedStatus = Boolean(
      opening.openingStatusBucket && opening.openingStatusBucket !== 'sellable'
    );

    return (
      hasQty ||
      hasLocations ||
      hasMin ||
      hasMax ||
      hasDeadQty ||
      hasRemark ||
      hasDeadStockFlag ||
      changedPeriod ||
      changedStatus
    );
  }, [selected, opening]);

  const searchUrl = debouncedQ
    ? `/api/admin/inventory/search?q=${encodeURIComponent(debouncedQ)}&limit=50`
    : null;
  const { data: searchData, isLoading: searchLoading } = useSWR(
    searchUrl,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      keepPreviousData: true,
    }
  );

  const showSearchLoading = Boolean(debouncedQ) && (searchLoading || isSearchPending);
  const results = searchData?.results || [];
  const isWorking = Boolean(selected);
  const showAllocatePanel = canRecordStock && isWorking;

  const allocationProduct = useMemo(() => {
    if (!selected) return null;
    return {
      title: selected.title,
      sku: selected.sku,
      barcode: selected.barcode,
      brand: selected.brand,
      categoryName: selected.categoryName,
      heroImage: selected.heroImage,
    };
  }, [selected]);

  const gateRequiredFields = useMemo(
    () => [
      'minStock',
      'maxStock',
      'deadStockPeriod',
      'deadStockQty',
      'selectedLocations',
    ],
    []
  );

  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const selectExisting = useCallback(
    (product) => {
      if (product.hasStock) {
        const q = encodeURIComponent(product.title || product.sku || '');
        router.push(
          `/admin/inventory?productId=${product._id}&q=${q}&movement=1`
        );
        return;
      }

      const productIdStr = String(product._id);
      const existingDraft = memoryCache?.draftsByProductId?.[productIdStr];

      setSelected(product);
      if (existingDraft?.opening) {
        setOpening(existingDraft.opening);
        toast.success(`Restored cached details for ${product.title || 'product'}`);
      } else {
        setOpening(EMPTY_OPENING);
      }
      setValidationErrors([]);
      setSearchQ('');

      try {
        window.history.pushState(
          { step: 'allocate', productId: product._id },
          '',
          window.location.href
        );
      } catch {}
    },
    [router]
  );

  const handleBackToSelectProduct = useCallback(() => {
    const ok = window.confirm(
      'Are you sure you want to go back to select a product and discard the changes?'
    );
    if (!ok) return false;

    if (selected?._id) {
      discardProductDraft(selected._id);
    }
    setSelected(null);
    setOpening(EMPTY_OPENING);
    setValidationErrors([]);
    saveDraftCache({ activeProduct: null, activeOpening: null, searchQ: '' });

    try {
      if (window.history.state?.step === 'allocate') {
        window.history.replaceState({ step: 'search' }, '', window.location.href);
      }
    } catch {}

    toast('Changes discarded');
    return true;
  }, [selected]);

  const handleBackClick = useCallback(
    (e) => {
      if (e) e.preventDefault();
      if (selected) {
        handleBackToSelectProduct();
      } else {
        router.push('/admin/inventory');
      }
    },
    [selected, handleBackToSelectProduct, router]
  );

  const changeProduct = useCallback(() => {
    handleBackToSelectProduct();
  }, [handleBackToSelectProduct]);

  const discardDraft = useCallback(() => {
    handleBackToSelectProduct();
  }, [handleBackToSelectProduct]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isNavigatingAwayAllowedRef.current) return;
      if (!hasUnsavedChanges) return;
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    const handleAnchorClick = (e) => {
      if (isNavigatingAwayAllowedRef.current) return;
      if (!hasUnsavedChanges) return;
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }

      const anchor = e.target.closest('a[href]');
      if (!anchor) return;
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
      if (href.startsWith('mailto:') || href.startsWith('tel:')) return;

      try {
        const targetUrl = new URL(anchor.href, window.location.href);
        if (
          targetUrl.origin === window.location.origin &&
          targetUrl.pathname === window.location.pathname &&
          targetUrl.search === window.location.search
        ) {
          return;
        }
      } catch {
        if (href === window.location.pathname + window.location.search) return;
      }

      const leave = window.confirm(
        'You have unsaved changes. Leave this page? (Your entered details will stay cached until you reload the page.)'
      );
      if (!leave) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      } else {
        isNavigatingAwayAllowedRef.current = true;
      }
    };

    const handlePopState = () => {
      if (isNavigatingAwayAllowedRef.current) return;

      if (selectedRef.current) {
        const ok = window.confirm(
          'Are you sure you want to go back to select a product and discard the changes?'
        );
        if (!ok) {
          try {
            window.history.pushState(
              { step: 'allocate', productId: selectedRef.current._id },
              '',
              window.location.href
            );
          } catch {}
          return;
        }

        if (selectedRef.current?._id) {
          discardProductDraft(selectedRef.current._id);
        }
        setSelected(null);
        setOpening(EMPTY_OPENING);
        setValidationErrors([]);
        saveDraftCache({ activeProduct: null, activeOpening: null, searchQ: '' });
        toast('Changes discarded');
        return;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleAnchorClick, true);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleAnchorClick, true);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [hasUnsavedChanges]);

  /**
   * Confirm & Save may pass fresh opening from the panel — avoid stale state.
   */
  const resolveOpening = useCallback(
    (openingOverride) => openingOverride || opening,
    [opening]
  );

  const validateClient = useCallback(
    (openingOverride) => {
      const effectiveOpening = resolveOpening(openingOverride);
      const effectiveOpeningQty = parsePositiveInt(effectiveOpening.openingQty);
      const effectiveAllocated = (effectiveOpening.selectedLocations || []).reduce(
        (sum, loc) => sum + (Number(loc.qty) || 0),
        0
      );
      const errors = [];
      if (!canRecordStock) return errors;

      if (!effectiveOpening.openingQty || effectiveOpeningQty < 1) {
        errors.push('Opening quantity must be at least 1');
      }
      for (const key of gateRequiredFields) {
        if (key === 'selectedLocations') {
          if (!effectiveOpening.selectedLocations?.length) {
            errors.push('Allocate stock to at least one rack');
          } else {
            const invalidQty = effectiveOpening.selectedLocations.some(
              (loc) => !loc.qty || Number(loc.qty) < 1
            );
            if (invalidQty) {
              errors.push('Enter a valid quantity for each rack');
            }
            if (effectiveOpeningQty > 0 && effectiveAllocated !== effectiveOpeningQty) {
              errors.push(
                `Allocated total (${effectiveAllocated}) must equal opening quantity (${effectiveOpeningQty})`
              );
            }
          }
          continue;
        }
        if (effectiveOpening[key] === '' || effectiveOpening[key] == null) {
          errors.push(`${key} is required for first inventory intake`);
        }
      }
      return errors;
    },
    [resolveOpening, gateRequiredFields, canRecordStock]
  );

  const buildOpeningPayload = useCallback(
    (openingOverride) => {
      const effectiveOpening = resolveOpening(openingOverride);
      const locationEntries = (effectiveOpening.selectedLocations || []).map((loc) => ({
        locationId: loc.locationId,
        qty: Number(loc.qty),
      }));
      return {
        openingQty: Number(effectiveOpening.openingQty),
        minStock: Number(effectiveOpening.minStock),
        maxStock: Number(effectiveOpening.maxStock),
        deadStockPeriod: effectiveOpening.deadStockPeriod,
        deadStockQty: Number(effectiveOpening.deadStockQty),
        locationEntries,
        openingStatusBucket: effectiveOpening.openingStatusBucket,
        markAsDeadStock: effectiveOpening.markAsDeadStock,
        openingReason: 'opening_stock',
        openingRatePaise: null,
        remark: effectiveOpening.remark,
      };
    },
    [resolveOpening]
  );

  const submitInventory = useCallback(
    async ({ openingOverride } = {}) => {
      const effectiveOpening = resolveOpening(openingOverride);
      const effectiveOpeningQty = parsePositiveInt(effectiveOpening.openingQty);
      const effectiveAllocated = (effectiveOpening.selectedLocations || []).reduce(
        (sum, loc) => sum + (Number(loc.qty) || 0),
        0
      );
      const effectiveFullyAllocated =
        effectiveOpeningQty > 0 && effectiveOpeningQty - effectiveAllocated === 0;

      if (canRecordStock && isWorking && !effectiveFullyAllocated) {
        toast.error('Allocate all opening stock to racks before saving');
        return { success: false };
      }

      const clientErrors = validateClient(openingOverride);
      if (clientErrors.length > 0) {
        setValidationErrors(clientErrors);
        toast.error('Please complete all required fields');
        return { success: false };
      }

      setValidationErrors([]);
      if (openingOverride) {
        setOpening(openingOverride);
      }
      setSubmitting(true);

      try {
        if (!selected) {
          toast.error('Select a product first');
          return { success: false };
        }
        if (!canRecordStock) {
          toast.error('Inventory permission required');
          return { success: false };
        }

        const openingPayload = buildOpeningPayload(openingOverride);
        await adminJson('/api/admin/inventory/add-opening', {
          method: 'POST',
          body: JSON.stringify({
            productId: selected._id,
            opening: openingPayload,
          }),
        });
        const totalQty = openingPayload.locationEntries.reduce((sum, e) => sum + e.qty, 0);
        toast.success(
          openingPayload.locationEntries.length > 1
            ? `Opening stock recorded at ${openingPayload.locationEntries.length} locations (${totalQty} units total)`
            : 'Opening stock recorded'
        );

        clearAllDraftCache();
        isNavigatingAwayAllowedRef.current = true;
        window.location.href = '/admin/inventory';
        return { success: true };
      } catch (err) {
        const details = err.details ?? err.message;
        toast.error(typeof details === 'string' ? details : 'Failed to save');
        if (Array.isArray(details)) setValidationErrors(details);
        else if (typeof details === 'string') setValidationErrors([details]);
        else if (typeof err.message === 'string') setValidationErrors([err.message]);
        return { success: false };
      } finally {
        setSubmitting(false);
      }
    },
    [
      resolveOpening,
      canRecordStock,
      isWorking,
      validateClient,
      buildOpeningPayload,
      selected,
    ]
  );

  const submitInventoryRef = useRef(submitInventory);
  submitInventoryRef.current = submitInventory;

  const handleConfirmAndSave = useCallback(async (form) => {
    return submitInventoryRef.current({ openingOverride: form });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await submitInventory();
  };

  if (!meData) {
    return (
      <div className="flex justify-center py-20 text-gray-500">
        <Loader2 className="animate-spin mr-2" size={20} /> Loading…
      </div>
    );
  }

  if (!canRecordStock) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center text-gray-600">
        You do not have permission to add products to inventory.
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 pb-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleBackClick}
          className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
          title={selected ? 'Back to select product' : 'Back to inventory'}
          aria-label={selected ? 'Back to select product' : 'Back to inventory'}
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">Add product to inventory</h1>
            {hasUnsavedChanges && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                Unsaved changes (cached)
              </span>
            )}
            {hasUnsavedChanges && (
              <button
                type="button"
                onClick={discardDraft}
                className="text-xs text-gray-500 hover:text-red-600 transition-colors underline"
              >
                Discard draft
              </button>
            )}
          </div>
          <p className="text-sm text-gray-500">
            {isWorking
              ? 'Allocate opening stock on this page — details remain cached while switching until page reload'
              : 'Search an existing product — create new SKUs from Add Product'}
          </p>
        </div>
      </div>

      {!isWorking && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-sm">
          <div className="relative">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              size={20}
            />
            <input
              type="text"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Name, SKU, barcode, HSN, brand, tags…"
              className="w-full pl-12 pr-4 py-4 text-base border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              autoFocus
            />
          </div>

          {debouncedQ && (
            <div className="mt-4 border border-gray-100 rounded-xl divide-y max-h-80 overflow-y-auto">
              {showSearchLoading && results.length === 0 ? (
                <div className="p-4 text-sm text-gray-500 text-center flex items-center justify-center gap-2">
                  <Loader2 className="animate-spin text-emerald-600" size={16} />
                  Searching…
                </div>
              ) : results.length === 0 ? (
                <div className="p-4 text-sm text-gray-500 text-center space-y-2">
                  <p>No matches — create the product from Add Product first</p>
                  <Link
                    href="/admin/products/add"
                    className="inline-block text-sm font-medium text-emerald-700 hover:underline"
                  >
                    Go to Add Product
                  </Link>
                </div>
              ) : (
                results.map((p) => {
                  const inInventory = Boolean(p.hasStock);
                  return (
                    <button
                      key={p._id}
                      type="button"
                      onClick={() => selectExisting(p)}
                      className={`w-full text-left px-4 py-3 transition-colors flex items-center gap-3 border-l-4 ${
                        inInventory
                          ? 'hover:bg-sky-50/80 border-sky-400 bg-sky-50/40'
                          : 'hover:bg-emerald-50 border-transparent'
                      }`}
                    >
                      <div className="h-12 w-12 flex-shrink-0 rounded-md overflow-hidden bg-gray-100 border border-gray-200">
                        {p.heroImage ? (
                          <img
                            src={p.heroImage}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <Package size={20} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium text-gray-900 truncate">{p.title}</div>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {[
                            p.sku && `SKU ${p.sku}`,
                            p.barcode && `Barcode ${p.barcode}`,
                            p.brand,
                            p.categoryName,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                        <SearchStockBadges product={p} />
                        {inInventory && (
                          <p className="text-[10px] text-sky-700 mt-1">
                            Click to add stock via stock movement
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}

          <p className="mt-4 text-center text-sm text-gray-500">
            Need a new SKU?{' '}
            <Link href="/admin/products/add" className="font-medium text-emerald-700 hover:underline">
              Create it on Add Product
            </Link>
          </p>
        </div>
      )}

      {validationErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          <p className="font-semibold mb-1">Fix the following:</p>
          <ul className="list-disc pl-5 space-y-0.5">
            {validationErrors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {isWorking && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {showAllocatePanel && (
            <AllocateStockPanel
              enabled
              value={opening}
              onChange={setOpening}
              onConfirmAndSave={handleConfirmAndSave}
              onChangeProduct={changeProduct}
              submitting={submitting}
              showInventoryRules
              stockUnit={selected?.stockUnit || 'units'}
              product={allocationProduct}
              currentOnHand={0}
            />
          )}
        </form>
      )}
    </div>
  );
}
