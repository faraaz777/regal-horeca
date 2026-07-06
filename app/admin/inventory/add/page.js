'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { Search, ArrowLeft, Package, Loader2 } from 'lucide-react';
import { adminJson } from '@/lib/client/adminFetch';
import { useDebounce } from '@/hooks/useDebounce';
import { canWriteInventory, canWriteProducts } from '@/lib/shared/permissions';
import {
  STOCK_UNITS,
  PRODUCT_STATUSES,
  DEAD_STOCK_PERIODS,
  DEAD_STOCK_PERIOD_LABELS,
  STATUS_BUCKETS,
  STATUS_BUCKET_LABELS,
} from '@/lib/shared/inventoryConstants';

const fetcher = (url) => adminJson(url);

function locationStockSuffix(loc) {
  const itemCount = loc.itemCount ?? 0;
  const totalQty = loc.totalQty ?? 0;
  if (itemCount > 0 || totalQty > 0) {
    return ` · ${itemCount} item${itemCount === 1 ? '' : 's'} (${totalQty} units)`;
  }
  return ' · empty';
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
  minStock: '',
  maxStock: '',
  deadStockPeriod: 'month',
  deadStockQty: '',
  locationId: '',
  openingQty: '',
  openingStatusBucket: 'sellable',
  markAsDeadStock: false,
  openingReason: 'opening_stock',
  remark: '',
};

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

  const { data: metaData, mutate: mutateLocations } = useSWR(
    '/api/admin/inventory/locations?vendors=true&selectable=true',
    fetcher,
    { revalidateOnFocus: true, revalidateOnMount: true }
  );
  const { data: deptData } = useSWR('/api/categories?level=department', fetcher);

  const departments = deptData?.categories || [];
  const locations = metaData?.locations || [];
  const vendors = metaData?.vendors || [];

  const locationItemsUrl = opening.locationId
    ? `/api/admin/inventory/locations/${opening.locationId}/items`
    : null;
  const { data: locationItemsData, isLoading: locationItemsLoading } = useSWR(
    locationItemsUrl,
    fetcher,
    { revalidateOnFocus: false }
  );
  const locationItems = locationItemsData?.items || [];

  const displayLocations = useMemo(() => {
    if (!opening.locationId || !locationItemsData?.items?.length) {
      return locations;
    }

    const selectedId = String(opening.locationId);
    const productIds = new Set(locationItemsData.items.map((i) => String(i.productId)));
    const totalQty = locationItemsData.items.reduce((sum, i) => sum + i.qty, 0);
    const itemCount = productIds.size;

    return locations.map((loc) =>
      String(loc._id) === selectedId ? { ...loc, itemCount, totalQty } : loc
    );
  }, [locations, opening.locationId, locationItemsData]);

  useEffect(() => {
    if (!opening.locationId || !locationItemsData?.items || !metaData?.locations) return;

    const selectedId = String(opening.locationId);
    const productIds = new Set(locationItemsData.items.map((i) => String(i.productId)));
    const totalQty = locationItemsData.items.reduce((sum, i) => sum + i.qty, 0);
    const itemCount = productIds.size;

    const current = metaData.locations.find((loc) => String(loc._id) === selectedId);
    if (current?.itemCount === itemCount && current?.totalQty === totalQty) return;

    mutateLocations(
      {
        ...metaData,
        locations: metaData.locations.map((loc) =>
          String(loc._id) === selectedId ? { ...loc, itemCount, totalQty } : loc
        ),
      },
      { revalidate: false }
    );
  }, [opening.locationId, locationItemsData, metaData, mutateLocations]);

  const categoryUrl = master.departmentId
    ? `/api/categories?parent=${master.departmentId}`
    : null;
  const { data: catData } = useSWR(categoryUrl, fetcher);
  const categories = categoryUrl ? catData?.categories || [] : [];

  const results = searchData?.results || [];

  const showCreateForm = mode === 'create' || (mode === 'existing' && selected && !selected.hasStock);
  const showAdditionalOpening = mode === 'existing' && selected?.hasStock;
  const showFullOpeningGate = showCreateForm;

  const gateRequiredFields = useMemo(
    () => [
      'minStock',
      'maxStock',
      'deadStockPeriod',
      'deadStockQty',
      'locationId',
      'openingQty',
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
    },
    [router]
  );

  const startCreate = useCallback(() => {
    setSelected(null);
    setMode('create');
    setMaster(EMPTY_MASTER);
    setOpening(EMPTY_OPENING);
    setValidationErrors([]);
  }, []);

  const updateMaster = (key, value) => setMaster((p) => ({ ...p, [key]: value }));
  const updateOpening = (key, value) => setOpening((p) => ({ ...p, [key]: value }));

  const toggleMarkAsDeadStock = (checked) => {
    setOpening((p) => ({
      ...p,
      markAsDeadStock: checked,
      openingStatusBucket: checked
        ? 'dead_stock'
        : p.openingStatusBucket === 'dead_stock'
          ? 'sellable'
          : p.openingStatusBucket,
    }));
  };

  const updateOpeningStatus = (bucket) => {
    setOpening((p) => ({
      ...p,
      openingStatusBucket: bucket,
      markAsDeadStock: bucket === 'dead_stock',
    }));
  };

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
      for (const key of gateRequiredFields) {
        if (opening[key] === '' || opening[key] == null) {
          errors.push(`${key} is required for first inventory intake`);
        }
      }
    }
    if (showAdditionalOpening && canRecordStock) {
      if (!opening.locationId) errors.push('Location is required');
      if (!opening.openingQty) errors.push('Opening stock is required');
    }
    return errors;
  }, [mode, master, opening, gateRequiredFields, showFullOpeningGate, showAdditionalOpening, canEditMaster, canRecordStock]);

  const handleSubmit = async (e) => {
    e.preventDefault();
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
            opening: {
              ...opening,
              minStock: Number(opening.minStock),
              maxStock: Number(opening.maxStock),
              deadStockPeriod: opening.deadStockPeriod,
              deadStockQty: Number(opening.deadStockQty),
              openingQty: Number(opening.openingQty),
              openingStatusBucket: opening.openingStatusBucket,
              markAsDeadStock: opening.markAsDeadStock,
              openingReason: 'opening_stock',
              openingRatePaise: null,
            },
          }),
        });
        toast.success('Product created with opening stock');
      } else if (selected) {
        if (!canRecordStock) {
          toast.error('Inventory permission required');
          return;
        }
        const body = selected.hasStock
          ? {
              productId: selected._id,
              locationId: opening.locationId,
              openingQty: Number(opening.openingQty),
              openingStatusBucket: opening.openingStatusBucket,
              markAsDeadStock: opening.markAsDeadStock,
              openingReason: 'opening_stock',
              openingRatePaise: null,
              remark: opening.remark,
            }
          : {
              productId: selected._id,
              opening: {
                ...opening,
                minStock: Number(opening.minStock),
                maxStock: Number(opening.maxStock),
                deadStockPeriod: opening.deadStockPeriod,
                deadStockQty: Number(opening.deadStockQty),
              openingQty: Number(opening.openingQty),
              openingStatusBucket: opening.openingStatusBucket,
              markAsDeadStock: opening.markAsDeadStock,
              openingReason: 'opening_stock',
                openingRatePaise: null,
              },
            };

        await adminJson('/api/admin/inventory/add-opening', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        toast.success('Opening stock recorded');
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
              results.map((p) => (
                <button
                  key={p._id}
                  type="button"
                  onClick={() => selectExisting(p)}
                  className={`w-full text-left px-4 py-3 hover:bg-emerald-50 transition-colors flex items-center gap-3 ${
                    selected?._id === p._id ? 'bg-emerald-50 ring-1 ring-emerald-200' : ''
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
                    <div className="font-medium text-gray-900">{p.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {[
                        p.sku && `SKU ${p.sku}`,
                        p.barcode && `Barcode ${p.barcode}`,
                        p.hsnCode && `HSN ${p.hsnCode}`,
                        p.brand,
                        p.categoryName,
                        p.hasStock ? 'Has stock' : 'No stock yet',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                </button>
              ))
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
              <Package className="text-emerald-600 shrink-0 mt-0.5" size={20} />
              <div>
                <p className="font-semibold text-emerald-900">{selected.title}</p>
                <p className="text-sm text-emerald-700">
                  SKU {selected.sku} · {selected.brand}
                </p>
                <p className="text-xs text-emerald-600 mt-1">
                  {selected.hasStock
                    ? 'Add stock at an additional location'
                    : 'First inventory intake — complete the gate below'}
                </p>
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

          {canRecordStock && (showFullOpeningGate || showAdditionalOpening) && (
            <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {showAdditionalOpening ? 'Additional stock intake' : 'First inventory gate'}
              </h2>
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                Required before stock is recorded. Opening stock is written to the append-only ledger;
                summary qty is derived automatically.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {showFullOpeningGate && (
                  <>
                    <Field label="Min stock" required>
                      <input
                        type="number"
                        min="0"
                        className="w-full px-3 py-2 text-sm border rounded-lg"
                        value={opening.minStock}
                        onChange={(e) => updateOpening('minStock', e.target.value)}
                      />
                    </Field>
                    <Field label="Max stock" required>
                      <input
                        type="number"
                        min="0"
                        className="w-full px-3 py-2 text-sm border rounded-lg"
                        value={opening.maxStock}
                        onChange={(e) => updateOpening('maxStock', e.target.value)}
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Dead stock rule" required>
                        <select
                          className="w-full px-3 py-2 text-sm border rounded-lg"
                          value={opening.deadStockPeriod}
                          onChange={(e) => updateOpening('deadStockPeriod', e.target.value)}
                        >
                          {DEAD_STOCK_PERIODS.map((period) => (
                            <option key={period} value={period}>
                              {DEAD_STOCK_PERIOD_LABELS[period]}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Qty to sell in period" required>
                        <input
                          type="number"
                          min="1"
                          className="w-full px-3 py-2 text-sm border rounded-lg"
                          value={opening.deadStockQty}
                          onChange={(e) => updateOpening('deadStockQty', e.target.value)}
                        />
                      </Field>
                    </div>
                  </>
                )}

                <Field label="Location" required>
                  <select
                    className="w-full px-3 py-2 text-sm border rounded-lg"
                    value={opening.locationId}
                    onChange={(e) => updateOpening('locationId', e.target.value)}
                  >
                    <option value="">Select location…</option>
                    {displayLocations.map((loc) => (
                      <option key={loc._id} value={loc._id}>
                        {loc.path}
                        {locationStockSuffix(loc)}
                      </option>
                    ))}
                  </select>
                </Field>

                {opening.locationId && (
                  <div className="sm:col-span-2 rounded-lg border border-gray-200 bg-gray-50/80 overflow-hidden">
                    <div className="px-3 py-2 border-b border-gray-200 bg-white flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-gray-700">
                        Stock at this location
                      </p>
                      {locationItemsData?.location?.displayPath && (
                        <p className="text-[10px] text-gray-500 font-mono truncate">
                          {locationItemsData.location.displayPath}
                        </p>
                      )}
                    </div>
                    {locationItemsLoading ? (
                      <p className="text-sm text-gray-500 px-3 py-4 flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin" />
                        Loading items…
                      </p>
                    ) : locationItems.length === 0 ? (
                      <p className="text-sm text-gray-500 px-3 py-4">No stock at this location yet.</p>
                    ) : (
                      <div className="max-h-48 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 bg-white">
                              <th className="px-3 py-2">Name</th>
                              <th className="px-3 py-2">SKU</th>
                              <th className="px-3 py-2">Qty</th>
                              <th className="px-3 py-2">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {locationItems.map((item) => (
                              <tr key={item._id} className="bg-white/60">
                                <td className="px-3 py-2 font-medium text-gray-900">{item.title}</td>
                                <td className="px-3 py-2 font-mono text-xs text-gray-600">
                                  {item.sku || '—'}
                                </td>
                                <td className="px-3 py-2">
                                  <span className="font-semibold">{item.qty}</span>
                                  <span className="text-gray-400 text-xs ml-1">{item.stockUnit}</span>
                                </td>
                                <td className="px-3 py-2">
                                  <span
                                    className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                                      item.statusBucket === 'sellable'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}
                                  >
                                    {item.statusLabel}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                <Field label="Opening stock" required>
                  <input
                    type="number"
                    min="1"
                    className="w-full px-3 py-2 text-sm border rounded-lg"
                    value={opening.openingQty}
                    onChange={(e) => updateOpening('openingQty', e.target.value)}
                  />
                  <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={opening.markAsDeadStock}
                      onChange={(e) => toggleMarkAsDeadStock(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-xs text-gray-600">Mark as dead stock</span>
                  </label>
                  {opening.markAsDeadStock && (
                    <p className="text-[10px] text-amber-700 mt-1">
                      Flags that sales are below the dead-stock target.
                    </p>
                  )}
                </Field>
                <Field label="Status" required>
                  <select
                    className="w-full px-3 py-2 text-sm border rounded-lg"
                    value={opening.openingStatusBucket}
                    onChange={(e) => updateOpeningStatus(e.target.value)}
                  >
                    {STATUS_BUCKETS.map((bucket) => (
                      <option key={bucket} value={bucket}>
                        {STATUS_BUCKET_LABELS[bucket]}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Remark">
                    <textarea
                      className="w-full px-3 py-2 text-sm border rounded-lg"
                      rows={2}
                      value={opening.remark}
                      onChange={(e) => updateOpening('remark', e.target.value)}
                    />
                  </Field>
                </div>
              </div>
            </section>
          )}

          <div className="flex justify-end gap-3">
            <Link
              href="/admin/inventory"
              className="px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
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
