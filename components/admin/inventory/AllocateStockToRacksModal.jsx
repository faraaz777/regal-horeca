'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import Image from 'next/image';
import {
  Box,
  RotateCcw,
  Save,
  Plus,
  Trash2,
  MapPin,
  Info,
  PackageOpen,
  Package,
  X,
  Loader2,
} from 'lucide-react';
import { adminJson } from '@/lib/client/adminFetch';
import { validateLocationSelectionClient } from '@/lib/client/locationCascadeApi';
import { fetchCascadeRacks } from '@/lib/client/locationCascadeApi';
import LocationSelector from '@/components/admin/inventory/LocationSelector';
import { formatRackDisplayName } from '@/lib/shared/locationDisplay';
import {
  DEAD_STOCK_PERIODS,
  DEAD_STOCK_PERIOD_LABELS,
  INTAKE_STATUS_BUCKETS,
  STATUS_BUCKET_LABELS,
} from '@/lib/shared/inventoryConstants';

const fetcher = (url) => adminJson(url);

const EMPTY_DRAFT = {
  branchId: null,
  floorId: null,
  rackId: null,
  locationId: null,
  displayPath: '',
};

function parsePositiveInt(value) {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? 0 : n;
}

function clampRackQty(rawValue, rowQty, remaining, openingQty) {
  const parsed = parsePositiveInt(rawValue);
  if (parsed < 0) return 0;
  const maxForRow = remaining + (Number(rowQty) || 0);
  return Math.min(parsed, maxForRow, openingQty);
}

function FieldLabel({ children, required }) {
  return (
    <label className="block text-sm font-semibold text-gray-900 mb-1.5">
      {children}
      {required && <span className="text-accent ml-0.5">*</span>}
    </label>
  );
}

function SectionHeading({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-start gap-2 mb-4 pb-3 border-b border-gray-100">
      {Icon && <Icon size={14} strokeWidth={2.25} className="text-accent shrink-0 mt-1" />}
      <div className="min-w-0">
        <h3 className="text-base font-bold text-gray-900 tracking-tight leading-tight">{title}</h3>
        {subtitle && <p className="text-xs font-medium text-gray-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

function StatLabel({ children }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-widest text-gray-800 mb-1.5">{children}</p>
  );
}

const cascadeLabelClass =
  'block text-sm font-semibold text-gray-900 mb-1.5';

const inputClass =
  'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent disabled:bg-gray-50 disabled:text-gray-400';

const selectClass =
  'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent disabled:bg-gray-50 disabled:text-gray-400';

const blurDataURL =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q==';

function ProductInfoBanner({ product, stockUnit }) {
  if (!product?.title) return null;

  const meta = [
    product.sku && `SKU ${product.sku}`,
    product.barcode && `Barcode ${product.barcode}`,
    product.brand,
    product.categoryName,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-800 mb-3">
        Product
      </p>
      <div className="flex items-start gap-4">
        <div className="relative h-16 w-16 sm:h-20 sm:w-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
          {product.heroImage ? (
            <Image
              src={product.heroImage}
              alt={product.title}
              fill
              sizes="80px"
              unoptimized
              className="object-cover"
              placeholder="blur"
              blurDataURL={blurDataURL}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              <Package size={28} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold text-gray-900 leading-tight truncate">{product.title}</h3>
          {meta && <p className="text-sm text-gray-500 mt-1">{meta}</p>}
          {stockUnit && (
            <p className="text-xs font-medium text-gray-400 mt-1">Stock unit: {stockUnit}</p>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Modal for allocating master-pool opening stock across branch › floor › rack.
 */
export default function AllocateStockToRacksModal({
  isOpen,
  onClose,
  value,
  onSave,
  showInventoryRules = true,
  stockUnit = 'units',
  product = null,
  productId = null,
}) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [draftQty, setDraftQty] = useState('');
  const [selectorKey, setSelectorKey] = useState(0);
  const [form, setForm] = useState(value);
  const [previewLocationId, setPreviewLocationId] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setForm(value);
    const first = value?.selectedLocations?.[0]?.locationId;
    setPreviewLocationId(first ? String(first) : null);
    setDraft(EMPTY_DRAFT);
    setDraftQty('');
    setSelectorKey((k) => k + 1);
  }, [isOpen, value]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  const openingQtyNum = parsePositiveInt(form.openingQty);
  const allocatedTotal = useMemo(
    () => (form.selectedLocations || []).reduce((sum, loc) => sum + (Number(loc.qty) || 0), 0),
    [form.selectedLocations]
  );
  const remaining = openingQtyNum - allocatedTotal;
  const poolReady = openingQtyNum > 0;
  const isFullyAllocated = poolReady && remaining === 0;
  const allocationPercent =
    openingQtyNum > 0 ? Math.min(100, Math.round((allocatedTotal / openingQtyNum) * 100)) : 0;
  const rackSectionDisabled = !poolReady;

  const locationItemsUrl = previewLocationId
    ? `/api/admin/inventory/locations/${previewLocationId}/items`
    : null;
  const { data: locationItemsData, isLoading: locationItemsLoading } = useSWR(
    isOpen ? locationItemsUrl : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const locationItems = locationItemsData?.items || [];

  const { data: draftRackData } = useSWR(
    isOpen && draft.floorId ? ['allocate-racks', draft.floorId] : null,
    () => fetchCascadeRacks(draft.floorId),
    { revalidateOnFocus: false }
  );
  const draftRacks = draftRackData?.racks || [];

  const updateForm = useCallback((key, val) => {
    setForm((p) => ({ ...p, [key]: val }));
  }, []);

  const updateOpeningQty = useCallback((rawValue) => {
    if (!rawValue) {
      setForm((p) => ({ ...p, openingQty: '' }));
      return;
    }
    const nextQty = parsePositiveInt(rawValue);
    if (nextQty < 1) {
      setForm((p) => ({ ...p, openingQty: rawValue }));
      return;
    }
    setForm((p) => {
      const allocated = (p.selectedLocations || []).reduce(
        (sum, loc) => sum + (Number(loc.qty) || 0),
        0
      );
      if (nextQty < allocated) {
        toast.error(`Reduce rack quantities first (${allocated} already allocated)`);
        return p;
      }
      return { ...p, openingQty: String(nextQty) };
    });
  }, []);

  const setLocations = useCallback((locations) => {
    setForm((p) => ({ ...p, selectedLocations: locations }));
    if (locations.length === 0) {
      setPreviewLocationId(null);
    } else if (!locations.some((l) => String(l.locationId) === String(previewLocationId))) {
      setPreviewLocationId(String(locations[0].locationId));
    }
  }, [previewLocationId]);

  const addLocation = useCallback(() => {
    if (!poolReady) {
      toast.error('Enter opening quantity first');
      return;
    }
    if (remaining <= 0) {
      toast.error('All units are already allocated');
      return;
    }
    const check = validateLocationSelectionClient(draft);
    if (!check.valid) {
      toast.error(check.error || 'Select branch, floor, and rack');
      return;
    }
    const requested = parsePositiveInt(draftQty);
    if (requested < 1) {
      toast.error(`Enter 1–${remaining} for this rack`);
      return;
    }
    const qty = Math.min(requested, remaining);
    const locations = form.selectedLocations || [];
    if (locations.some((loc) => String(loc.locationId) === String(draft.locationId))) {
      toast.error('This location is already added');
      return;
    }
    const next = [...locations, { ...draft, qty }];
    setLocations(next);
    if (!previewLocationId) {
      setPreviewLocationId(String(draft.locationId));
    }
    setDraft(EMPTY_DRAFT);
    setDraftQty('');
    setSelectorKey((k) => k + 1);
  }, [draft, draftQty, draftRacks, form.selectedLocations, poolReady, previewLocationId, productId, remaining, setLocations]);

  const removeLocation = useCallback(
    (locationId) => {
      const next = (form.selectedLocations || []).filter(
        (loc) => String(loc.locationId) !== String(locationId)
      );
      setLocations(next);
    },
    [form.selectedLocations, setLocations]
  );

  const updateLocationQty = useCallback(
    (locationId, rawValue) => {
      if (!poolReady) return;
      const next = (form.selectedLocations || []).map((loc) => {
        if (String(loc.locationId) !== String(locationId)) return loc;
        const qty = clampRackQty(rawValue, loc.qty, remaining, openingQtyNum);
        return { ...loc, qty: qty || '' };
      });
      setLocations(next);
    },
    [form.selectedLocations, openingQtyNum, poolReady, remaining, setLocations]
  );

  const clearAllLocations = useCallback(() => {
    setLocations([]);
  }, [setLocations]);

  const handleReset = useCallback(() => {
    setForm(value);
    setDraft(EMPTY_DRAFT);
    setDraftQty('');
    setSelectorKey((k) => k + 1);
    const first = value?.selectedLocations?.[0]?.locationId;
    setPreviewLocationId(first ? String(first) : null);
  }, [value]);

  const toggleMarkAsDeadStock = (checked) => {
    setForm((p) => ({
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
    setForm((p) => ({
      ...p,
      openingStatusBucket: bucket,
      markAsDeadStock: bucket === 'dead_stock',
    }));
  };

  const handleSave = useCallback(() => {
    if (!poolReady) {
      toast.error('Enter opening quantity');
      return;
    }
    if (!form.selectedLocations?.length) {
      toast.error('Allocate stock to at least one rack');
      return;
    }
    const invalidQty = form.selectedLocations.some((loc) => !loc.qty || Number(loc.qty) < 1);
    if (invalidQty) {
      toast.error('Enter a valid quantity for each rack');
      return;
    }
    if (allocatedTotal !== openingQtyNum) {
      toast.error(
        `Allocated total (${allocatedTotal}) must equal opening quantity (${openingQtyNum})`
      );
      return;
    }
    if (showInventoryRules) {
      const required = ['minStock', 'maxStock', 'deadStockPeriod', 'deadStockQty'];
      for (const key of required) {
        if (form[key] === '' || form[key] == null) {
          toast.error('Complete all stock rule fields');
          return;
        }
      }
    }
    onSave(form);
    onClose();
    toast.success('Allocation saved');
  }, [
    allocatedTotal,
    form,
    onClose,
    onSave,
    openingQtyNum,
    poolReady,
    showInventoryRules,
  ]);

  if (!isOpen) return null;

  const previewLocation = (form.selectedLocations || []).find(
    (l) => String(l.locationId) === String(previewLocationId)
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/45 backdrop-blur-[2px]"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-[#f8f9fa] rounded-2xl shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden border border-gray-200/80"
        role="dialog"
        aria-modal="true"
        aria-labelledby="allocate-stock-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 sm:px-6 py-4 bg-white border-b border-gray-200 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <Box size={16} strokeWidth={2.25} className="text-accent shrink-0 mt-1" />
            <div className="min-w-0">
              <h2
                id="allocate-stock-title"
                className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight"
              >
                Allocate Stock to Racks
              </h2>
              <p className="text-sm font-medium text-gray-500 mt-1">
                Assign master pool stock to specific racks across branch, floor and rack.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RotateCcw size={15} />
              <span className="hidden sm:inline">Reset</span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!isFullyAllocated}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-accent rounded-lg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <Save size={15} />
              Save Allocation
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 sm:hidden"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4">
          <ProductInfoBanner product={product} stockUnit={stockUnit} />

          {/* Stock overview */}
          <section className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm">
            <SectionHeading
              icon={Box}
              title="Stock overview"
              subtitle="Set your opening pool and track how much is left to assign"
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              <div>
                <FieldLabel required>Opening quantity</FieldLabel>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Box size={14} />
                  </div>
                  <input
                    type="number"
                    min="1"
                    className={`${inputClass} pl-9 pr-16 font-semibold text-gray-900`}
                    value={form.openingQty}
                    onChange={(e) => updateOpeningQty(e.target.value)}
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">
                    {stockUnit}
                  </span>
                </div>
                <p className="text-[11px] font-medium text-gray-500 mt-1.5 leading-snug">
                  Master pool — every unit must be assigned to a rack before saving.
                </p>
              </div>

              <div className="md:border-x md:border-gray-100 md:px-6">
                <StatLabel>Remaining to allocate</StatLabel>
                <p className="text-2xl font-bold text-accent tabular-nums">
                  {poolReady ? remaining : '—'}
                  {poolReady && (
                    <span className="text-base font-normal text-gray-400">
                      {' '}
                      / {openingQtyNum}
                    </span>
                  )}
                </p>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden mt-2">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isFullyAllocated ? 'bg-emerald-500' : 'bg-accent'
                    }`}
                    style={{ width: `${allocationPercent}%` }}
                  />
                </div>
                {poolReady && remaining > 0 && (
                  <p className="text-[11px] text-accent mt-2 leading-snug">
                    {remaining} {stockUnit} still unallocated — assign all stock to racks before
                    saving.
                  </p>
                )}
                {isFullyAllocated && (
                  <p className="text-[11px] text-emerald-600 mt-2">
                    All units allocated — ready to save.
                  </p>
                )}
              </div>

              <div>
                <StatLabel>Allocated</StatLabel>
                <p className="text-2xl font-bold text-gray-900 tabular-nums">
                  {allocatedTotal}
                  <span className="text-sm font-normal text-gray-400 ml-1">{stockUnit}</span>
                </p>
              </div>
            </div>
          </section>

          {/* Add to rack */}
          <section className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm space-y-4">
            <SectionHeading
              icon={Plus}
              title="Add to rack"
              subtitle="Pick a branch, floor, rack and quantity"
            />
            <div className={rackSectionDisabled ? 'opacity-50 pointer-events-none' : ''}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
                <div className="lg:col-span-7">
                  <LocationSelector
                    key={selectorKey}
                    layout="horizontal"
                    selectedBranchId={draft.branchId}
                    selectedFloorId={draft.floorId}
                    selectedRackId={draft.rackId}
                    onChange={setDraft}
                    required
                    disabled={rackSectionDisabled}
                    className="!grid-cols-1 sm:!grid-cols-3"
                    labelClassName={cascadeLabelClass}
                  />
                </div>
                <div className="lg:col-span-3">
                  <FieldLabel required>Qty for this rack</FieldLabel>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max={poolReady ? Math.max(remaining, 1) : undefined}
                      className={`${inputClass} pr-14`}
                      value={draftQty}
                      disabled={rackSectionDisabled}
                      placeholder="Enter qty"
                      onChange={(e) => {
                        const next = parsePositiveInt(e.target.value);
                        if (!e.target.value) {
                          setDraftQty('');
                          return;
                        }
                        if (poolReady && next > remaining) {
                          setDraftQty(String(remaining));
                          return;
                        }
                        setDraftQty(e.target.value);
                      }}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                      {stockUnit}
                    </span>
                  </div>
                </div>
                <div className="lg:col-span-2">
                  <button
                    type="button"
                    onClick={addLocation}
                    disabled={rackSectionDisabled || remaining <= 0}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-accent bg-accent/5 border border-accent/30 rounded-lg hover:bg-accent/10 disabled:opacity-50 transition-colors"
                  >
                    <Plus size={16} />
                    Add
                  </button>
                </div>
              </div>
            </div>

            {!poolReady && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                Enter the opening quantity above before assigning stock to racks.
              </p>
            )}

            {/* Allocation list */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-3.5 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-bold text-gray-900 tracking-tight">Allocation list</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent/10 text-accent">
                    {form.selectedLocations?.length || 0} rack
                    {(form.selectedLocations?.length || 0) === 1 ? '' : 's'}
                  </span>
                </div>
                {(form.selectedLocations?.length || 0) > 0 && (
                  <button
                    type="button"
                    onClick={clearAllLocations}
                    className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={13} />
                    Clear all
                  </button>
                )}
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200 bg-white">
                    <th className="px-4 py-2.5 w-10">#</th>
                    <th className="px-4 py-2.5">Location</th>
                    <th className="px-4 py-2.5 w-36">Allocated Qty ({stockUnit})</th>
                    <th className="px-4 py-2.5 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(form.selectedLocations || []).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <PackageOpen size={18} className="text-accent/40" />
                          <p className="text-sm font-bold text-gray-900">No racks added yet</p>
                          <p className="text-xs font-medium text-gray-500 max-w-xs">
                            Start by selecting a branch, floor, rack and quantity above.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    form.selectedLocations.map((loc, idx) => {
                      const rowMax = remaining + (Number(loc.qty) || 0);
                      return (
                        <tr key={loc.locationId} className="bg-white hover:bg-gray-50/50">
                          <td className="px-4 py-3 text-xs text-gray-400 font-medium">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <p
                              className="text-xs font-mono text-gray-800 truncate max-w-md"
                              title={formatRackDisplayName(loc)}
                            >
                              {formatRackDisplayName(loc) || '—'}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min="0"
                              max={rowMax}
                              className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-accent/20"
                              value={loc.qty}
                              onChange={(e) => updateLocationQty(loc.locationId, e.target.value)}
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => removeLocation(loc.locationId)}
                              className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                              aria-label="Remove rack"
                            >
                              <X size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Stock at location */}
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-0">
              <SectionHeading
                icon={MapPin}
                title="Stock at selected location"
                subtitle="Review existing stock and set inventory rules for this intake"
              />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-3 border-y border-gray-100 bg-gray-50/60">
              <p className="text-sm font-semibold text-gray-800">View location</p>
              <select
                className="text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-600 max-w-xs w-full sm:w-auto"
                value={previewLocationId || ''}
                onChange={(e) => setPreviewLocationId(e.target.value || null)}
                disabled={!(form.selectedLocations?.length > 0)}
              >
                <option value="">
                  {form.selectedLocations?.length
                    ? 'Select a location…'
                    : 'Select a location above to view stock'}
                </option>
                {(form.selectedLocations || []).map((loc) => (
                  <option key={loc.locationId} value={loc.locationId}>
                    {formatRackDisplayName(loc)}
                  </option>
                ))}
              </select>
            </div>

            {previewLocationId && (
              <div className="px-4 sm:px-5 py-3 border-b border-gray-100 bg-white">
                {locationItemsLoading ? (
                  <p className="text-xs text-gray-500 flex items-center gap-2 py-2">
                    <Loader2 size={13} className="animate-spin" />
                    Loading stock at location…
                  </p>
                ) : locationItems.length === 0 ? (
                  <p className="text-xs text-gray-500 py-2">
                    No existing stock at{' '}
                    <span className="font-mono">{formatRackDisplayName(previewLocation)}</span> — this intake
                    will be the first.
                  </p>
                ) : (
                  <div className="max-h-40 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                          <th className="py-1 pr-2 w-10" />
                          <th className="py-1 pr-2">Name</th>
                          <th className="py-1 pr-2">SKU</th>
                          <th className="py-1">Qty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {locationItems.map((item) => (
                          <tr key={item._id}>
                            <td className="py-1.5 pr-2">
                              <div className="relative h-8 w-8 rounded overflow-hidden bg-gray-100 border border-gray-200">
                                {item.heroImage ? (
                                  <Image
                                    src={item.heroImage}
                                    alt=""
                                    fill
                                    sizes="32px"
                                    unoptimized
                                    className="object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                                    <Package size={12} />
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="py-1.5 pr-2 font-medium text-gray-800 truncate max-w-[140px]">
                              {item.title}
                            </td>
                            <td className="py-1.5 pr-2 font-mono text-gray-500">{item.sku || '—'}</td>
                            <td className="py-1.5 font-semibold tabular-nums">
                              {item.qty} {item.stockUnit}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <div className="p-4 sm:p-5 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {showInventoryRules && (
                <>
                  <div className="sm:col-span-2">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-gray-800 mb-3">
                      Inventory rules
                    </p>
                  </div>
                  <div>
                    <FieldLabel required>Min stock</FieldLabel>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        className={`${inputClass} pr-14`}
                        value={form.minStock}
                        onChange={(e) => updateForm('minStock', e.target.value)}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                        {stockUnit}
                      </span>
                    </div>
                  </div>
                  <div>
                    <FieldLabel required>Max stock</FieldLabel>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        className={`${inputClass} pr-14`}
                        value={form.maxStock}
                        onChange={(e) => updateForm('maxStock', e.target.value)}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                        {stockUnit}
                      </span>
                    </div>
                  </div>
                  <div>
                    <FieldLabel required>Dead stock rule</FieldLabel>
                    <select
                      className={selectClass}
                      value={form.deadStockPeriod}
                      onChange={(e) => updateForm('deadStockPeriod', e.target.value)}
                    >
                      {DEAD_STOCK_PERIODS.map((period) => (
                        <option key={period} value={period}>
                          {DEAD_STOCK_PERIOD_LABELS[period]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <FieldLabel required>Qty to sell in period</FieldLabel>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        className={`${inputClass} pr-14`}
                        value={form.deadStockQty}
                        onChange={(e) => updateForm('deadStockQty', e.target.value)}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                        {stockUnit}
                      </span>
                    </div>
                  </div>
                </>
              )}

              <div className={showInventoryRules ? '' : 'sm:col-span-2'}>
                <FieldLabel required>Status</FieldLabel>
                <select
                  className={selectClass}
                  value={form.openingStatusBucket}
                  onChange={(e) => updateOpeningStatus(e.target.value)}
                >
                  {INTAKE_STATUS_BUCKETS.map((bucket) => (
                    <option key={bucket} value={bucket}>
                      {STATUS_BUCKET_LABELS[bucket]}
                    </option>
                  ))}
                </select>
                <label className="flex items-start gap-2.5 mt-3 cursor-pointer select-none group">
                  <input
                    type="checkbox"
                    checked={form.markAsDeadStock}
                    onChange={(e) => toggleMarkAsDeadStock(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent/30"
                  />
                  <span>
                    <span className="text-sm font-semibold text-gray-900 group-hover:text-black">
                      Mark as dead stock
                    </span>
                    <span className="block text-xs font-medium text-gray-500 mt-0.5">
                      Flags that sales are below the dead-stock target for this product.
                    </span>
                  </span>
                </label>
              </div>

              <div className="sm:col-span-2">
                <FieldLabel>Remark</FieldLabel>
                <textarea
                  className={`${inputClass} resize-none`}
                  rows={2}
                  value={form.remark}
                  onChange={(e) => updateForm('remark', e.target.value)}
                  placeholder="Optional note for this stock intake"
                />
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-4 sm:px-6 py-3 bg-gray-100 border-t border-gray-200">
          <p className="text-xs font-medium text-gray-600 flex items-center gap-2">
            <Info size={14} className="text-gray-500 shrink-0" />
            All quantities are in {stockUnit}. Please ensure the total allocated quantity equals the
            opening quantity.
          </p>
        </div>
      </div>
    </div>
  );
}
