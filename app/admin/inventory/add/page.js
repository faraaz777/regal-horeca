'use client';

import { useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { Search, ArrowLeft, Package, Loader2, Box, CheckCircle2 } from 'lucide-react';
import { adminJson } from '@/lib/client/adminFetch';
import { useDebounce } from '@/hooks/useDebounce';
import { canWriteInventory, canWriteProducts } from '@/lib/shared/permissions';
import {
  STOCK_UNITS,
  PRODUCT_STATUSES,
} from '@/lib/shared/inventoryConstants';
import AllocateStockToRacksModal from '@/components/admin/inventory/AllocateStockToRacksModal';

const fetcher = (url) => adminJson(url);

const SEARCH_STATUS_STYLES = {
  in_stock: 'bg-emerald-100 text-emerald-800',
  low: 'bg-amber-100 text-amber-800',
  out: 'bg-red-100 text-red-800',
};

function SearchStockBadges({ product }) {
  if (!product.hasStock) {
    return (
      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">
        Not in inventory
      </span>
    );
  }

  const onHand = product.sellableQty ?? 0;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span
        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
          SEARCH_STATUS_STYLES[product.stockStatus] || SEARCH_STATUS_STYLES.out
        }`}
      >
        {onHand} on hand
      </span>
      {(product.isDeadStock || product.condition === 'HAS_DEAD_STOCK') && (
        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-900">
          ⚠ Dead stock
        </span>
      )}
    </span>
  );
}

const EMPTY_MASTER = {
  name: '',
  sku: '',
  barcode: '',
  colour: '',
  brand: '',
  departmentId: '',
  categoryId: '',
  unit: 'Pcs',
  hsnCode: '',
  gstPercent: 0,
  costPaise: '',
  mrpPaise: '',
  sellingPricePaise: '',
  maxDiscountPercent: 0,
  vendorId: '',
  productStatus: 'active',
  heroImage: '',
};

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

function rupeesToPaiseInput(rupees) {
  const n = parseFloat(rupees);
  if (Number.isNaN(n)) return '';
  return String(Math.round(n * 100));
}

function Field({ label, required, children, hint }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

export default function AddToInventoryPage() {
  const router = useRouter();
  const { data: meData } = useSWR('/api/auth/me', fetcher);
  const role = meData?.user?.role;
  const canEditMaster = canWriteProducts(role);
  const canRecordStock = canWriteInventory(role);

  const [searchQ, setSearchQ] = useState('');
  const debouncedQ = useDebounce(searchQ.trim(), 300);
  const isSearchPending = searchQ.trim() !== debouncedQ;
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState('search');
  const [master, setMaster] = useState(EMPTY_MASTER);
  const [opening, setOpening] = useState(EMPTY_OPENING);
  const [submitting, setSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [allocationModalOpen, setAllocationModalOpen] = useState(false);

  const searchUrl = debouncedQ
    ? `/api/admin/inventory/search?q=${encodeURIComponent(debouncedQ)}&limit=100`
    : null;
  const { data: searchData, isLoading: searchLoading, isValidating: searchValidating } = useSWR(
    searchUrl,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      keepPreviousData: true,
    }
  );

  const showSearchLoading = Boolean(debouncedQ) && (searchLoading || searchValidating || isSearchPending);

  const { data: metaData } = useSWR(
    '/api/admin/inventory/locations?vendors=true',
    fetcher,
    { revalidateOnFocus: true, revalidateOnMount: true }
  );
  const { data: deptData } = useSWR('/api/categories?level=department', fetcher);

  const departments = deptData?.categories || [];
  const vendors = metaData?.vendors || [];

  const handleAllocationSave = useCallback((allocationData) => {
    setOpening(allocationData);
  }, []);

  const categoryUrl = master.departmentId
    ? `/api/categories?parent=${master.departmentId}`
    : null;
  const { data: catData } = useSWR(categoryUrl, fetcher);
  const categories = categoryUrl ? catData?.categories || [] : [];

  const results = searchData?.results || [];

  const showCreateForm = mode === 'create' || (mode === 'existing' && selected && !selected.hasStock);
  const showAdditionalOpening = mode === 'existing' && selected?.hasStock;
  const showFullOpeningGate = showCreateForm;

  const openingQtyNum = parsePositiveInt(opening.openingQty);
  const allocatedTotal = useMemo(
    () =>
      (opening.selectedLocations || []).reduce((sum, loc) => sum + (Number(loc.qty) || 0), 0),
    [opening.selectedLocations]
  );
  const remainingToAllocate = openingQtyNum - allocatedTotal;
  const isFullyAllocated = openingQtyNum > 0 && remainingToAllocate === 0;

  const allocationProduct = useMemo(() => {
    if (selected) {
      return {
        title: selected.title,
        sku: selected.sku,
        barcode: selected.barcode,
        brand: selected.brand,
        categoryName: selected.categoryName,
        heroImage: selected.heroImage,
      };
    }
    if (mode === 'create' && master.name.trim()) {
      return {
        title: master.name.trim(),
        sku: master.sku,
        barcode: master.barcode,
        brand: master.brand,
        heroImage: master.heroImage,
      };
    }
    return null;
  }, [selected, mode, master]);

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
      setMode('existing');
      setMaster(EMPTY_MASTER);
      setOpening(EMPTY_OPENING);
      setValidationErrors([]);
      if (canRecordStock) {
        setAllocationModalOpen(true);
      }
    },
    [router, canRecordStock]
  );

  const startCreate = useCallback(() => {
    setSelected(null);
    setMode('create');
    setMaster(EMPTY_MASTER);
    setOpening(EMPTY_OPENING);
    setValidationErrors([]);
  }, []);

  const updateMaster = (key, value) => setMaster((p) => ({ ...p, [key]: value }));

  const validateClient = useCallback(() => {
    const errors = [];
    if (mode === 'create' && canEditMaster) {
      if (!master.name.trim()) errors.push('Product name is required');
      if (!master.sku.trim()) errors.push('SKU is required');
      if (!master.barcode.trim()) errors.push('Barcode is required');
      if (!master.brand.trim()) errors.push('Brand is required');
      if (!master.departmentId) errors.push('Department is required');
      if (!master.categoryId) errors.push('Category is required');
      if (!master.hsnCode.trim()) errors.push('HSN code is required');
    }
    if (showFullOpeningGate && canRecordStock) {
      if (!opening.openingQty || openingQtyNum < 1) {
        errors.push('Opening quantity must be at least 1');
      }
      for (const key of gateRequiredFields) {
        if (key === 'selectedLocations') {
          if (!opening.selectedLocations?.length) {
            errors.push('Allocate stock to at least one rack');
          } else {
            const invalidQty = opening.selectedLocations.some(
              (loc) => !loc.qty || Number(loc.qty) < 1
            );
            if (invalidQty) {
              errors.push('Enter a valid quantity for each rack');
            }
            if (openingQtyNum > 0 && allocatedTotal !== openingQtyNum) {
              errors.push(
                `Allocated total (${allocatedTotal}) must equal opening quantity (${openingQtyNum})`
              );
            }
          }
          continue;
        }
        if (opening[key] === '' || opening[key] == null) {
          errors.push(`${key} is required for first inventory intake`);
        }
      }
    }
    if (showAdditionalOpening && canRecordStock) {
      if (!opening.openingQty || openingQtyNum < 1) {
        errors.push('Opening quantity must be at least 1');
      }
      if (!opening.selectedLocations?.length) {
        errors.push('Allocate stock to at least one rack');
      } else {
        const invalidQty = opening.selectedLocations.some(
          (loc) => !loc.qty || Number(loc.qty) < 1
        );
        if (invalidQty) {
          errors.push('Enter a valid quantity for each rack');
        }
        if (openingQtyNum > 0 && allocatedTotal !== openingQtyNum) {
          errors.push(
            `Allocated total (${allocatedTotal}) must equal opening quantity (${openingQtyNum})`
          );
        }
      }
    }
    return errors;
  }, [mode, master, opening, openingQtyNum, allocatedTotal, gateRequiredFields, showFullOpeningGate, showAdditionalOpening, canEditMaster, canRecordStock]);

  const buildOpeningPayload = useCallback(() => {
    const locationEntries = (opening.selectedLocations || []).map((loc) => ({
      locationId: loc.locationId,
      qty: Number(loc.qty),
    }));
    return {
      openingQty: Number(opening.openingQty),
      minStock: Number(opening.minStock),
      maxStock: Number(opening.maxStock),
      deadStockPeriod: opening.deadStockPeriod,
      deadStockQty: Number(opening.deadStockQty),
      locationEntries,
      openingStatusBucket: opening.openingStatusBucket,
      markAsDeadStock: opening.markAsDeadStock,
      openingReason: 'opening_stock',
      openingRatePaise: null,
      remark: opening.remark,
    };
  }, [opening]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (canRecordStock && (showFullOpeningGate || showAdditionalOpening) && !isFullyAllocated) {
      setAllocationModalOpen(true);
      toast.error('Allocate all opening stock to racks before saving');
      return;
    }
    const clientErrors = validateClient();
    if (clientErrors.length > 0) {
      setValidationErrors(clientErrors);
      toast.error('Please complete all required fields');
      return;
    }
    setValidationErrors([]);
    setSubmitting(true);

    try {
      if (mode === 'create') {
        if (!canEditMaster || !canRecordStock) {
          toast.error('You need both product and inventory permissions');
          return;
        }
        const openingPayload = buildOpeningPayload();
        await adminJson('/api/admin/inventory/create-with-opening', {
          method: 'POST',
          body: JSON.stringify({
            product: {
              ...master,
              gstPercent: Number(master.gstPercent),
              costPaise: Number(master.costPaise),
              mrpPaise: Number(master.mrpPaise),
              sellingPricePaise: Number(master.sellingPricePaise),
              maxDiscountPercent: Number(master.maxDiscountPercent),
              vendorId: master.vendorId || null,
            },
            opening: openingPayload,
          }),
        });
        toast.success(
          openingPayload.locationEntries.length > 1
            ? `Product created with opening stock at ${openingPayload.locationEntries.length} locations`
            : 'Product created with opening stock'
        );
      } else if (selected) {
        if (!canRecordStock) {
          toast.error('Inventory permission required');
          return;
        }
        const openingPayload = buildOpeningPayload();
        const body = selected.hasStock
          ? {
              productId: selected._id,
              openingQty: openingPayload.openingQty,
              locationEntries: openingPayload.locationEntries,
              openingStatusBucket: openingPayload.openingStatusBucket,
              markAsDeadStock: openingPayload.markAsDeadStock,
              openingReason: openingPayload.openingReason,
              openingRatePaise: null,
              remark: openingPayload.remark,
            }
          : {
              productId: selected._id,
              opening: openingPayload,
            };

        await adminJson('/api/admin/inventory/add-opening', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        const totalQty = openingPayload.locationEntries.reduce((sum, e) => sum + e.qty, 0);
        toast.success(
          openingPayload.locationEntries.length > 1
            ? `Opening stock recorded at ${openingPayload.locationEntries.length} locations (${totalQty} units total)`
            : 'Opening stock recorded'
        );
      }

      window.location.href = '/admin/inventory';
    } catch (err) {
      const details = err.details ?? err.message;
      toast.error(typeof details === 'string' ? details : 'Failed to save');
      if (Array.isArray(details)) setValidationErrors(details);
      else if (typeof details === 'string') setValidationErrors([details]);
      else if (typeof err.message === 'string') setValidationErrors([err.message]);
    } finally {
      setSubmitting(false);
    }
  };

  if (!meData) {
    return (
      <div className="flex justify-center py-20 text-gray-500">
        <Loader2 className="animate-spin mr-2" size={20} /> Loading…
      </div>
    );
  }

  if (!canRecordStock && !canEditMaster) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center text-gray-600">
        You do not have permission to add products to inventory.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/inventory"
          className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add product to inventory</h1>
          <p className="text-sm text-gray-500">Search first — avoid duplicate SKUs</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Name, SKU, barcode, HSN, brand, tags…"
            className="w-full pl-10 pr-4 py-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            autoFocus
          />
        </div>

        {debouncedQ && (
          <div className="mt-3 border border-gray-100 rounded-lg divide-y max-h-64 overflow-y-auto">
            {showSearchLoading && results.length === 0 ? (
              <div className="p-4 text-sm text-gray-500 text-center flex items-center justify-center gap-2">
                <Loader2 className="animate-spin text-emerald-600" size={16} />
                Searching…
              </div>
            ) : results.length === 0 ? (
              <div className="p-4 text-sm text-gray-500 text-center">
                No matches — create a new product below
              </div>
            ) : (
              results.map((p) => {
                const inInventory = Boolean(p.hasStock);
                const isSelected = selected?._id === p._id;
                return (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => selectExisting(p)}
                    className={`w-full text-left px-4 py-3 transition-colors flex items-center gap-3 border-l-4 ${
                      isSelected
                        ? inInventory
                          ? 'bg-sky-50 ring-1 ring-sky-200 border-sky-500'
                          : 'bg-emerald-50 ring-1 ring-emerald-200 border-emerald-500'
                        : inInventory
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
                        {inInventory && (
                          <span className="shrink-0 inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-sky-600 text-white">
                            In inventory
                          </span>
                        )}
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
                          Click to add stock at another location or adjust
                        </p>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}

        {canEditMaster && (
          <button
            type="button"
            onClick={startCreate}
            className="mt-3 w-full py-2.5 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100"
          >
            + Create new product (no match found)
          </button>
        )}
      </div>

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

      {(mode === 'create' || mode === 'existing') && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {mode === 'existing' && selected && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
              <div className="relative h-14 w-14 flex-shrink-0 rounded-lg overflow-hidden bg-white border border-emerald-200">
                {selected.heroImage ? (
                  <img
                    src={selected.heroImage}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-emerald-300">
                    <Package size={22} />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-emerald-900">{selected.title}</p>
                <p className="text-sm text-emerald-700">
                  SKU {selected.sku} · {selected.brand}
                </p>
                <p className="text-xs text-emerald-600 mt-1">
                  {selected.hasStock
                    ? 'Add stock at an additional location'
                    : isFullyAllocated
                      ? `${openingQtyNum} units allocated across ${opening.selectedLocations?.length || 0} rack${(opening.selectedLocations?.length || 0) === 1 ? '' : 's'} — ready to save`
                      : 'First inventory intake — allocate stock to racks in the popup'}
                </p>
                {!selected.hasStock && canRecordStock && (
                  <button
                    type="button"
                    onClick={() => setAllocationModalOpen(true)}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent/80"
                  >
                    <Box size={13} />
                    {isFullyAllocated ? 'Edit allocation' : 'Open allocation'}
                  </button>
                )}
              </div>
            </div>
          )}

          {mode === 'create' && canEditMaster && (
            <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Product master</h2>
              <p className="text-xs text-gray-500">All money fields in paise (₹1 = 100 paise)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Name" required>
                  <input
                    className="w-full px-3 py-2 text-sm border rounded-lg"
                    value={master.name}
                    onChange={(e) => updateMaster('name', e.target.value)}
                  />
                </Field>
                <Field label="SKU" required>
                  <input
                    className="w-full px-3 py-2 text-sm border rounded-lg font-mono"
                    value={master.sku}
                    onChange={(e) => updateMaster('sku', e.target.value)}
                  />
                </Field>
                <Field label="Barcode" required>
                  <input
                    className="w-full px-3 py-2 text-sm border rounded-lg font-mono"
                    value={master.barcode}
                    onChange={(e) => updateMaster('barcode', e.target.value)}
                  />
                </Field>
                <Field label="Colour">
                  <input
                    className="w-full px-3 py-2 text-sm border rounded-lg"
                    value={master.colour}
                    onChange={(e) => updateMaster('colour', e.target.value)}
                  />
                </Field>
                <Field label="Brand" required>
                  <input
                    className="w-full px-3 py-2 text-sm border rounded-lg"
                    value={master.brand}
                    onChange={(e) => updateMaster('brand', e.target.value)}
                  />
                </Field>
                <Field label="Department" required>
                  <select
                    className="w-full px-3 py-2 text-sm border rounded-lg"
                    value={master.departmentId}
                    onChange={(e) => {
                      updateMaster('departmentId', e.target.value);
                      updateMaster('categoryId', '');
                    }}
                  >
                    <option value="">Select department…</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Category" required>
                  <select
                    className="w-full px-3 py-2 text-sm border rounded-lg"
                    value={master.categoryId}
                    onChange={(e) => updateMaster('categoryId', e.target.value)}
                    disabled={!master.departmentId}
                  >
                    <option value="">Select category…</option>
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Unit" required>
                  <select
                    className="w-full px-3 py-2 text-sm border rounded-lg"
                    value={master.unit}
                    onChange={(e) => updateMaster('unit', e.target.value)}
                  >
                    {STOCK_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="HSN code" required>
                  <input
                    className="w-full px-3 py-2 text-sm border rounded-lg"
                    value={master.hsnCode}
                    onChange={(e) => updateMaster('hsnCode', e.target.value)}
                  />
                </Field>
                <Field label="GST %" required>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="w-full px-3 py-2 text-sm border rounded-lg"
                    value={master.gstPercent}
                    onChange={(e) => updateMaster('gstPercent', e.target.value)}
                  />
                </Field>
                <Field label="Cost (paise)" required hint="e.g. 18000 = ₹180.00">
                  <input
                    type="number"
                    min="0"
                    className="w-full px-3 py-2 text-sm border rounded-lg"
                    value={master.costPaise}
                    onChange={(e) => updateMaster('costPaise', e.target.value)}
                  />
                </Field>
                <Field label="MRP (paise)" required>
                  <input
                    type="number"
                    min="0"
                    className="w-full px-3 py-2 text-sm border rounded-lg"
                    value={master.mrpPaise}
                    onChange={(e) => updateMaster('mrpPaise', e.target.value)}
                  />
                </Field>
                <Field label="Selling price (paise)" required>
                  <input
                    type="number"
                    min="0"
                    className="w-full px-3 py-2 text-sm border rounded-lg"
                    value={master.sellingPricePaise}
                    onChange={(e) => updateMaster('sellingPricePaise', e.target.value)}
                  />
                </Field>
                <Field label="Max discount %">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="w-full px-3 py-2 text-sm border rounded-lg"
                    value={master.maxDiscountPercent}
                    onChange={(e) => updateMaster('maxDiscountPercent', e.target.value)}
                  />
                </Field>
                <Field label="Vendor">
                  <select
                    className="w-full px-3 py-2 text-sm border rounded-lg"
                    value={master.vendorId}
                    onChange={(e) => updateMaster('vendorId', e.target.value)}
                  >
                    <option value="">None</option>
                    {vendors.map((v) => (
                      <option key={v._id} value={v._id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Product status">
                  <select
                    className="w-full px-3 py-2 text-sm border rounded-lg"
                    value={master.productStatus}
                    onChange={(e) => updateMaster('productStatus', e.target.value)}
                  >
                    {PRODUCT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Image URL">
                  <input
                    className="w-full px-3 py-2 text-sm border rounded-lg"
                    value={master.heroImage}
                    onChange={(e) => updateMaster('heroImage', e.target.value)}
                    placeholder="https://…"
                  />
                </Field>
              </div>
            </section>
          )}

          {canRecordStock && mode === 'create' && showFullOpeningGate && (
            <div
              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                isFullyAllocated
                  ? 'border-emerald-200 bg-emerald-50/50'
                  : 'border-gray-200 bg-gray-50/80'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {isFullyAllocated ? (
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                ) : (
                  <Box size={18} className="text-accent shrink-0" />
                )}
                <p className="text-sm text-gray-700">
                  {isFullyAllocated
                    ? `${openingQtyNum} ${master.unit || 'units'} allocated across ${opening.selectedLocations?.length || 0} rack${(opening.selectedLocations?.length || 0) === 1 ? '' : 's'}`
                    : 'Allocate opening stock to racks before saving'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAllocationModalOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold text-accent border border-accent/30 rounded-lg hover:bg-accent/5 shrink-0"
              >
                <Box size={14} />
                {isFullyAllocated ? 'Edit allocation' : 'Allocate stock to racks'}
              </button>
            </div>
          )}

          <AllocateStockToRacksModal
            isOpen={allocationModalOpen}
            onClose={() => setAllocationModalOpen(false)}
            value={opening}
            onSave={handleAllocationSave}
            showInventoryRules={showFullOpeningGate}
            stockUnit={selected?.stockUnit || master.unit || 'units'}
            product={allocationProduct}
            productId={selected?._id || null}
          />

          <div className="flex justify-end gap-3">
            <Link
              href="/admin/inventory"
              className="px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting || (canRecordStock && (showFullOpeningGate || showAdditionalOpening) && !isFullyAllocated)}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              Save to inventory
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
