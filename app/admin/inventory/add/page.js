'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
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

  const selectExisting = useCallback(
    (product) => {
      if (product.hasStock) {
        const q = encodeURIComponent(product.title || product.sku || '');
        router.push(
          `/admin/inventory?productId=${product._id}&q=${q}&movement=1`
        );
        return;
      }
      setSelected(product);
      setOpening(EMPTY_OPENING);
      setValidationErrors([]);
      setSearchQ('');
    },
    [router]
  );

  const changeProduct = useCallback(() => {
    setSelected(null);
    setOpening(EMPTY_OPENING);
    setValidationErrors([]);
  }, []);

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
        <Link
          href="/admin/inventory"
          className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add product to inventory</h1>
          <p className="text-sm text-gray-500">
            {isWorking
              ? 'Allocate opening stock on this page — no popup'
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
