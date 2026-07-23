'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import {
  RotateCcw,
  Save,
  Info,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { fetchCascadeBranches } from '@/lib/client/locationCascadeApi';
import LocationCascadePicker from '@/components/admin/inventory/movement/LocationCascadePicker';
import MaxStockWarnDialog from '@/components/admin/inventory/MaxStockWarnDialog';
import {
  locationRackCode,
  locationRackName,
} from '@/lib/client/inventory/locationLabels';
import {
  DEAD_STOCK_PERIODS,
  DEAD_STOCK_PERIOD_LABELS,
} from '@/lib/shared/inventoryConstants';
import ProductAllocateHeader from '@/components/admin/inventory/allocate/ProductAllocateHeader';
import AllocateFloorRackGrid from '@/components/admin/inventory/allocate/AllocateFloorRackGrid';
import RackSearchInput from '@/components/admin/inventory/RackSearchInput';
import {
  LAST_BRANCH_KEY,
  LAST_FLOOR_KEY,
  readStoredId,
  writeStoredId,
  parsePositiveInt,
  clampRackQty,
  buildLocationCodePath,
} from '@/components/admin/inventory/allocate/allocateHelpers';

function FieldLabel({ children, required }) {
  return (
    <label className="block text-sm font-semibold text-gray-900 mb-1.5">
      {children}
      {required && <span className="text-accent ml-0.5">*</span>}
    </label>
  );
}

const inputClass =
  'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent disabled:bg-gray-50 disabled:text-gray-400';

const selectClass =
  'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent disabled:bg-gray-50 disabled:text-gray-400';

/**
 * Inline panel for allocating opening stock across branch › floor › rack.
 * Controlled via value / onChange so the parent page owns opening state.
 *
 * Qty on racks comes from Stock snapshots (never ledger replay on read).
 */
export default function AllocateStockPanel({
  value,
  onChange,
  onConfirmAndSave,
  onChangeProduct,
  onCancel,
  submitting = false,
  showInventoryRules = true,
  stockUnit = 'units',
  product = null,
  currentOnHand = 0,
  enabled = true,
}) {
  const form = value || {};
  const [maxWarnPending, setMaxWarnPending] = useState(null);
  const [branchId, setBranchId] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [pickerKey, setPickerKey] = useState(0);
  const [rackQuery, setRackQuery] = useState('');

  const openingQtyNum = parsePositiveInt(form.openingQty);
  const allocatedTotal = useMemo(
    () => (form.selectedLocations || []).reduce((sum, loc) => sum + (Number(loc.qty) || 0), 0),
    [form.selectedLocations]
  );
  const remaining = openingQtyNum - allocatedTotal;
  const poolReady = openingQtyNum > 0;
  const isFullyAllocated = poolReady && remaining === 0;
  const rackSectionDisabled = !poolReady;

  const allocatedByRackId = useMemo(() => {
    const map = new Map();
    for (const loc of form.selectedLocations || []) {
      if (loc.locationId) {
        map.set(String(loc.locationId), Number(loc.qty) || 0);
      }
    }
    return map;
  }, [form.selectedLocations]);

  /** Light branch list only to resolve last-used / defaults for the cascade picker. */
  const { data: branchData } = useSWR(
    enabled ? 'cascade-branches-allocate' : null,
    fetchCascadeBranches,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );
  const branches = branchData?.branches || [];

  const defaultBranchId = useMemo(() => {
    if (!branches.length) return '';
    const fromSelection = value?.selectedLocations?.[0]?.branchId;
    if (fromSelection && branches.some((b) => String(b._id) === String(fromSelection))) {
      return String(fromSelection);
    }
    const last = readStoredId(LAST_BRANCH_KEY);
    if (last && branches.some((b) => String(b._id) === String(last))) {
      return last;
    }
    return String(branches[0]._id);
  }, [branches, value]);

  const defaultFloorId = useMemo(() => {
    const fromSelection = value?.selectedLocations?.[0]?.floorId;
    if (fromSelection) return String(fromSelection);
    return readStoredId(LAST_FLOOR_KEY);
  }, [value]);

  useEffect(() => {
    if (!defaultBranchId) return;
    setBranchId(defaultBranchId);
    const branch = branches.find((b) => String(b._id) === String(defaultBranchId));
    setBranchCode(branch?.code || '');
  }, [defaultBranchId, branches]);

  const updateForm = useCallback(
    (key, val) => {
      onChange((p) => ({ ...p, [key]: val }));
    },
    [onChange]
  );

  const updateOpeningQty = useCallback(
    (rawValue) => {
      if (!rawValue) {
        onChange((p) => ({ ...p, openingQty: '' }));
        return;
      }
      const nextQty = parsePositiveInt(rawValue);
      if (nextQty < 1) {
        onChange((p) => ({ ...p, openingQty: rawValue }));
        return;
      }
      onChange((p) => {
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
    },
    [onChange]
  );

  const setRackQty = useCallback(
    (rack, floor, qty, branchMeta = {}) => {
      if (!poolReady) {
        toast.error('Enter opening quantity first');
        return;
      }

      const rackId = String(rack._id);
      const currentQty = allocatedByRackId.get(rackId) || 0;
      const nextQty = clampRackQty(qty, currentQty, remaining, openingQtyNum);
      const effectiveBranchId = String(branchMeta.branchId || branchId || '');
      const effectiveBranchCode = branchMeta.branchCode || branchCode;

      if (effectiveBranchId) writeStoredId(LAST_BRANCH_KEY, effectiveBranchId);
      if (floor?._id) writeStoredId(LAST_FLOOR_KEY, floor._id);

      onChange((p) => {
        const locations = p.selectedLocations || [];
        if (nextQty === 0) {
          return {
            ...p,
            selectedLocations: locations.filter((loc) => String(loc.locationId) !== rackId),
          };
        }

        const code = locationRackCode(rack);
        const name = locationRackName(rack);
        const codePath = buildLocationCodePath(effectiveBranchCode, floor, rack);
        const displayPath = rack.displayPath || name || code || rackId;

        const entry = {
          locationId: rackId,
          locationCode: code,
          locationName: name,
          locationCodePath: codePath,
          locationPath: displayPath,
          displayPath,
          branchId: effectiveBranchId,
          floorId: String(floor._id),
          rackId,
          qty: nextQty,
        };

        const idx = locations.findIndex((loc) => String(loc.locationId) === rackId);
        if (idx >= 0) {
          const next = [...locations];
          next[idx] = { ...next[idx], ...entry };
          return { ...p, selectedLocations: next };
        }
        return { ...p, selectedLocations: [...locations, entry] };
      });
    },
    [allocatedByRackId, branchCode, branchId, onChange, openingQtyNum, poolReady, remaining]
  );

  const handleBranchChange = useCallback(
    (nextBranchId) => {
      const id = String(nextBranchId);
      setBranchId(id);
      writeStoredId(LAST_BRANCH_KEY, id);
      const branch = branches.find((b) => String(b._id) === id);
      setBranchCode(branch?.code || '');
    },
    [branches]
  );

  const handleReset = useCallback(() => {
    onChange((p) => ({
      ...p,
      openingQty: '',
      selectedLocations: [],
      minStock: '',
      maxStock: '',
      deadStockPeriod: 'month',
      deadStockQty: '',
      remark: '',
      markAsDeadStock: false,
      openingStatusBucket: 'sellable',
    }));
    setMaxWarnPending(null);
    setPickerKey((k) => k + 1);
  }, [onChange]);

  const toggleMarkAsDeadStock = (checked) => {
    onChange((p) => ({
      ...p,
      markAsDeadStock: checked,
      openingStatusBucket: 'sellable',
    }));
  };

  const validateAllocation = useCallback(() => {
    if (!poolReady) {
      toast.error('Enter opening quantity');
      return false;
    }
    if (!form.selectedLocations?.length) {
      toast.error('Allocate stock to at least one rack');
      return false;
    }
    const invalidQty = form.selectedLocations.some((loc) => !loc.qty || Number(loc.qty) < 1);
    if (invalidQty) {
      toast.error('Enter a valid quantity for each rack');
      return false;
    }
    if (allocatedTotal !== openingQtyNum) {
      toast.error(
        `Allocated total (${allocatedTotal}) must equal opening quantity (${openingQtyNum})`
      );
      return false;
    }
    if (showInventoryRules) {
      const required = ['minStock', 'maxStock', 'deadStockPeriod', 'deadStockQty'];
      for (const key of required) {
        if (form[key] === '' || form[key] == null) {
          toast.error('Complete all stock rule fields');
          return false;
        }
      }
    }
    return true;
  }, [allocatedTotal, form, openingQtyNum, poolReady, showInventoryRules]);

  /**
   * Max stock is a soft planning limit — warn before confirm, never hard-block.
   */
  const exceedsMaxStock = useCallback(() => {
    if (!showInventoryRules) return false;
    if (form.maxStock === '' || form.maxStock == null) return false;
    const maxStock = Number(form.maxStock);
    if (!Number.isFinite(maxStock) || maxStock < 0) return false;

    const onHand = Number(currentOnHand) || 0;
    return onHand + openingQtyNum > maxStock;
  }, [showInventoryRules, form.maxStock, currentOnHand, openingQtyNum]);

  const runConfirmAndSave = useCallback(async () => {
    if (!onConfirmAndSave) return;
    await onConfirmAndSave(form);
  }, [form, onConfirmAndSave]);

  const handleConfirmAndSave = useCallback(() => {
    if (!validateAllocation()) return;
    if (!onConfirmAndSave) return;
    if (exceedsMaxStock()) {
      const maxStock = Number(form.maxStock);
      const onHand = Number(currentOnHand) || 0;
      setMaxWarnPending({
        currentQty: onHand,
        afterQty: onHand + openingQtyNum,
        maxStock,
      });
      return;
    }
    runConfirmAndSave();
  }, [
    validateAllocation,
    onConfirmAndSave,
    exceedsMaxStock,
    form.maxStock,
    currentOnHand,
    openingQtyNum,
    runConfirmAndSave,
  ]);

  const handleMaxWarnContinue = useCallback(() => {
    setMaxWarnPending(null);
    runConfirmAndSave();
  }, [runConfirmAndSave]);

  if (!enabled) return null;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-gray-900 tracking-tight">Allocate to racks</h2>
        <button
          type="button"
          onClick={handleReset}
          disabled={submitting}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 shrink-0"
        >
          <RotateCcw size={12} />
          Reset
        </button>
      </div>

      <ProductAllocateHeader
        product={product}
        openingQty={form.openingQty}
        onOpeningChange={updateOpeningQty}
        openingQtyNum={openingQtyNum}
        allocatedTotal={allocatedTotal}
        remaining={remaining}
        poolReady={poolReady}
        isFullyAllocated={isFullyAllocated}
        stockUnit={stockUnit}
        onChangeProduct={onChangeProduct}
        onHand={currentOnHand}
      />

      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0">
          <section className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
            <div className="mb-2.5 flex items-center justify-between gap-3 min-w-0">
              <p className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                Where does it go?
              </p>
              <RackSearchInput
                value={rackQuery}
                onChange={setRackQuery}
                accent="emerald"
                className="w-44 sm:w-52 shrink-0"
              />
            </div>

            {defaultBranchId ? (
              <LocationCascadePicker
                key={pickerKey}
                accent="emerald"
                swrKeyPrefix="allocate"
                enabled={enabled}
                defaultBranchId={defaultBranchId}
                defaultFloorId={defaultFloorId || undefined}
                onBranchChange={handleBranchChange}
                renderFloorRacks={(floor, ctx) => (
                  <AllocateFloorRackGrid
                    floor={floor}
                    branchId={ctx?.branchId || branchId}
                    branchCode={ctx?.branchCode || branchCode}
                    branchName={ctx?.branchName || ''}
                    allocatedByRackId={allocatedByRackId}
                    remaining={remaining}
                    stockUnit={stockUnit}
                    disabled={rackSectionDisabled}
                    onQtyChange={setRackQty}
                    swrKeyPrefix="allocate"
                    rackQuery={rackQuery}
                  />
                )}
              />
            ) : (
              <p className="text-xs text-gray-500 flex items-center gap-1.5 py-2">
                <Loader2 size={12} className="animate-spin" />
                Loading branches…
              </p>
            )}

            {!poolReady && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2.5 py-1.5 mt-2">
                Enter opening quantity above before assigning stock to racks.
              </p>
            )}
          </section>
        </div>

        <div className="space-y-2.5 h-fit lg:sticky lg:top-2">
          {showInventoryRules && (
            <aside className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-800 mb-1">
                Inventory rules
              </p>
              <p className="text-[11px] text-gray-500 mb-3">
                Min/max and dead-stock thresholds for this intake
              </p>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <FieldLabel required>Min stock</FieldLabel>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        className={`${inputClass} pr-10 py-2`}
                        value={form.minStock}
                        onChange={(e) => updateForm('minStock', e.target.value)}
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">
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
                        className={`${inputClass} pr-10 py-2`}
                        value={form.maxStock}
                        onChange={(e) => updateForm('maxStock', e.target.value)}
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">
                        {stockUnit}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <FieldLabel required>Dead stock rule</FieldLabel>
                  <select
                    className={`${selectClass} py-2`}
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
                      className={`${inputClass} pr-10 py-2`}
                      value={form.deadStockQty}
                      onChange={(e) => updateForm('deadStockQty', e.target.value)}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">
                      {stockUnit}
                    </span>
                  </div>
                </div>

                <label className="flex items-start gap-2 cursor-pointer select-none rounded-md border border-gray-100 bg-gray-50/80 px-2.5 py-2">
                  <input
                    type="checkbox"
                    checked={form.markAsDeadStock}
                    onChange={(e) => toggleMarkAsDeadStock(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent/30"
                  />
                  <span>
                    <span className="text-sm font-semibold text-gray-900">Dead stock tag</span>
                    <span className="block text-[11px] font-medium text-gray-500 mt-0.5">
                      Product-wide label only — sales can still sell this item.
                    </span>
                  </span>
                </label>
              </div>
            </aside>
          )}

          <section className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
            {!showInventoryRules && (
              <label className="flex items-start gap-2 cursor-pointer select-none group mb-3">
                <input
                  type="checkbox"
                  checked={form.markAsDeadStock}
                  onChange={(e) => toggleMarkAsDeadStock(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent/30"
                />
                <span>
                  <span className="text-sm font-semibold text-gray-900">Dead stock tag</span>
                  <span className="block text-[11px] font-medium text-gray-500 mt-0.5">
                    Product-wide label only.
                  </span>
                </span>
              </label>
            )}
            <FieldLabel>Remark</FieldLabel>
            <textarea
              className={`${inputClass} resize-none py-2`}
              rows={3}
              value={form.remark}
              onChange={(e) => updateForm('remark', e.target.value)}
              placeholder="Optional note for this stock intake"
            />
          </section>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 flex justify-center pt-2 pb-1">
        <div className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 max-w-lg rounded-lg border border-gray-200 bg-white/95 backdrop-blur-sm px-3 py-2 shadow-sm">
          <p className="text-sm leading-snug font-medium text-gray-700 flex items-center gap-1.5 min-w-0">
            <Info size={15} className="text-gray-500 shrink-0" />
            <span>
              Qty in {stockUnit}. Allocated must equal opening.
              {isFullyAllocated ? (
                <span className="ml-1.5 font-semibold text-emerald-600 inline-flex items-center gap-1">
                  <CheckCircle2 size={14} className="shrink-0" />
                  Ready
                </span>
              ) : null}
            </span>
          </p>
          <div className="flex items-center gap-2 shrink-0">
            {onCancel || onChangeProduct ? (
              <button
                type="button"
                onClick={onCancel || onChangeProduct}
                disabled={submitting}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleConfirmAndSave}
              disabled={!isFullyAllocated || submitting}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-sm font-semibold text-white bg-accent rounded-md hover:bg-accent/90 disabled:opacity-50 shadow-sm"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save
            </button>
          </div>
        </div>
      </div>

      <MaxStockWarnDialog
        isOpen={Boolean(maxWarnPending)}
        onCancel={() => setMaxWarnPending(null)}
        onContinue={handleMaxWarnContinue}
        currentQty={maxWarnPending?.currentQty ?? 0}
        afterQty={maxWarnPending?.afterQty ?? 0}
        maxStock={maxWarnPending?.maxStock ?? 0}
        stockUnit={stockUnit}
        continuing={submitting}
      />
    </div>
  );
}
