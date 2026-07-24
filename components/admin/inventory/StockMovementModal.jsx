'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { X, Loader2, Check } from 'lucide-react';
import { adminJson } from '@/lib/client/adminFetch';
import { validateLocationSelectionClient } from '@/lib/client/locationCascadeApi';
import {
  ADD_MOVEMENT_REASONS,
  ADD_REASON_CHIP_LABELS,
  MINUS_MOVEMENT_REASONS,
  MINUS_REASON_CHIP_LABELS,
  MAX_MOVEMENT_LINES,
  MAX_MOVEMENT_REMARK_LENGTH,
} from '@/lib/shared/inventoryConstants';
import { canEditInventoryRules } from '@/lib/shared/permissions';
import ChromeMovementTabs from './movement/ChromeMovementTabs';
import ReasonChipRow from './movement/ReasonChipRow';
import LocationQtyList from './movement/LocationQtyList';
import NewRackAddPanel from './movement/NewRackAddPanel'; // rack search under New rack
import TransferTicketPanel from './movement/TransferTicketPanel';
import RulesPanel, { buildRulesFormFromRule } from './movement/RulesPanel';
import MaxStockWarnDialog from './MaxStockWarnDialog';

const fetcher = (url) => adminJson(url);

const MOVEMENT_TABS = ['add', 'minus', 'transfer'];

const EMPTY_FORM = {
  quantity: '1',
  reason: 'purchase',
  statusBucket: 'sellable',
  remark: '',
  locationId: '',
  fromLocationId: '',
  toLocationId: '',
};

const EMPTY_LOCATION = {
  branchId: null,
  floorId: null,
  rackId: null,
};

export default function StockMovementModal({
  item,
  onClose,
  onSuccess,
  initialTab = 'add',
}) {
  const startTab = MOVEMENT_TABS.includes(initialTab) ? initialTab : 'add';
  const [tab, setTab] = useState(startTab);
  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    reason: startTab === 'minus' ? 'sold' : 'purchase',
  }));
  const [fromSel, setFromSel] = useState(EMPTY_LOCATION);
  const [toSel, setToSel] = useState(EMPTY_LOCATION);
  const [submitting, setSubmitting] = useState(false);
  const [minusDeductions, setMinusDeductions] = useState({});
  const [addQuantities, setAddQuantities] = useState({});
  const [extraAddLocations, setExtraAddLocations] = useState([]);
  const [rulesForm, setRulesForm] = useState(null);
  const [savingRules, setSavingRules] = useState(false);
  const [editingRules, setEditingRules] = useState(false);
  const [maxWarnPending, setMaxWarnPending] = useState(null);

  const { data: meData } = useSWR('/api/auth/me', fetcher, { revalidateOnFocus: false });
  const userRole = meData?.user?.role;
  const canEditRules = canEditInventoryRules(userRole);

  const stockUrl = item?._id ? `/api/admin/inventory/${item._id}/stock` : null;
  const { data: stockData, isLoading, mutate } = useSWR(stockUrl, fetcher, {
    revalidateOnFocus: false,
  });

  const update = (key, value) => setForm((p) => ({ ...p, [key]: value }));

  const setMovementTab = (key) => {
    setEditingRules(false);
    setTab(key);
    setFromSel(EMPTY_LOCATION);
    setToSel(EMPTY_LOCATION);
    if (key === 'minus') {
      setMinusDeductions({});
    }
    if (key === 'add') {
      setAddQuantities({});
      setExtraAddLocations([]);
    }
    setForm((p) => ({
      ...EMPTY_FORM,
      quantity: key === 'transfer' ? '1' : p.quantity,
      remark: p.remark,
      reason:
        key === 'add'
          ? 'purchase'
          : key === 'minus'
            ? 'sold'
            : p.reason,
    }));
  };

  const stockRows = stockData?.locations || [];
  const inventoryRule = stockData?.inventoryRule ?? null;

  useEffect(() => {
    setRulesForm(buildRulesFormFromRule(inventoryRule));
    if (!inventoryRule) {
      setEditingRules(false);
    }
  }, [inventoryRule]);

  const handleStartRulesEdit = useCallback(() => {
    setRulesForm(buildRulesFormFromRule(inventoryRule));
    setEditingRules(true);
  }, [inventoryRule]);

  const handleCancelRulesEdit = useCallback(() => {
    setRulesForm(buildRulesFormFromRule(inventoryRule));
    setEditingRules(false);
  }, [inventoryRule]);

  /**
   * Sellable stock aggregated by rack — excludes sold bucket and zero qty.
   * Shared by Minus, Add (existing racks), and Transfer FROM lists.
   */
  const sellableLocationRows = useMemo(() => {
    const byLocation = new Map();
    for (const row of stockRows) {
      if (!row.locationId || row.statusBucket === 'sold' || (row.qty || 0) <= 0) continue;
      const locationId = String(row.locationId);
      const current = byLocation.get(locationId);
      if (current) {
        current.qty += row.qty || 0;
      } else {
        byLocation.set(locationId, { ...row, locationId, qty: row.qty || 0 });
      }
    }
    return [...byLocation.values()].sort((a, b) => (b.qty || 0) - (a.qty || 0));
  }, [stockRows]);

  const addLocationRows = useMemo(() => {
    const byId = new Map();
    for (const row of sellableLocationRows) {
      byId.set(String(row.locationId), { ...row, isNew: false });
    }
    for (const row of extraAddLocations) {
      const id = String(row.locationId);
      if (!byId.has(id)) {
        byId.set(id, { ...row, isNew: true });
      }
    }
    return [...byId.values()].sort((a, b) => {
      if (a.isNew !== b.isNew) return a.isNew ? 1 : -1;
      return (b.qty || 0) - (a.qty || 0);
    });
  }, [sellableLocationRows, extraAddLocations]);

  const occupiedAddLocationIds = useMemo(
    () => addLocationRows.map((r) => String(r.locationId)),
    [addLocationRows]
  );

  const primaryAddLocation = sellableLocationRows[0] || null;

  const selectedTransferFromRow = useMemo(() => {
    if (!form.fromLocationId) return null;
    return sellableLocationRows.find(
      (r) => String(r.locationId) === String(form.fromLocationId)
    );
  }, [sellableLocationRows, form.fromLocationId]);

  const toDisplayPath = toSel.displayPath || '';

  const availableAtTransferFrom = selectedTransferFromRow?.qty ?? 0;
  const transferQty = Number(form.quantity) || 0;
  const totalMinusQty = useMemo(
    () => Object.values(minusDeductions).reduce((sum, qty) => sum + (Number(qty) || 0), 0),
    [minusDeductions]
  );
  const totalAddQty = useMemo(
    () => Object.values(addQuantities).reduce((sum, qty) => sum + (Number(qty) || 0), 0),
    [addQuantities]
  );
  const minusExceedsStock = useMemo(() => {
    return sellableLocationRows.some((row) => {
      const locId = String(row.locationId);
      const deduct = minusDeductions[locId] ?? 0;
      return deduct > (row.qty || 0);
    });
  }, [sellableLocationRows, minusDeductions]);
  const transferExceedsStock =
    tab === 'transfer' &&
    (availableAtTransferFrom <= 0 || transferQty > availableAtTransferFrom);
  const transferMissingFrom =
    tab === 'transfer' && sellableLocationRows.length > 0 && !form.fromLocationId;
  const transferSameLocation = Boolean(
    form.fromLocationId &&
      form.toLocationId &&
      String(form.fromLocationId) === String(form.toLocationId)
  );

  // Prefill From location from known sellable stock — no manual re-entry needed
  useEffect(() => {
    if (tab !== 'transfer' || !sellableLocationRows.length) return;
    const currentValid = sellableLocationRows.some(
      (r) => String(r.locationId) === String(form.fromLocationId)
    );
    if (!currentValid) {
      const first = sellableLocationRows[0];
      setForm((p) => ({ ...p, fromLocationId: String(first.locationId), quantity: '1' }));
      setFromSel({
        branchId: first.branchId || null,
        floorId: first.floorId || null,
        rackId: first.rackId || null,
      });
    }
  }, [tab, sellableLocationRows, form.fromLocationId]);

  useEffect(() => {
    if (tab !== 'transfer' || !availableAtTransferFrom) return;
    if (transferQty > availableAtTransferFrom) {
      setForm((p) => ({ ...p, quantity: String(availableAtTransferFrom) }));
    } else if (transferQty <= 0) {
      setForm((p) => ({ ...p, quantity: '1' }));
    }
  }, [tab, form.fromLocationId, availableAtTransferFrom, transferQty]);

  const handleSelectTransferTo = useCallback((selection) => {
    setToSel({
      branchId: selection.branchId || null,
      floorId: selection.floorId || null,
      rackId: selection.rackId || null,
      displayPath:
        selection.locationCode ||
        selection.displayPath ||
        selection.locationName ||
        '',
    });
    update('toLocationId', selection.locationId || '');
  }, []);

  const selectTransferFromRow = (row) => {
    const locId = String(row.locationId);
    update('fromLocationId', locId);
    setFromSel({
      branchId: row.branchId || null,
      floorId: row.floorId || null,
      rackId: row.rackId || null,
    });
    if (String(form.toLocationId) === locId) {
      update('toLocationId', '');
      setToSel({ ...EMPTY_LOCATION, displayPath: '' });
    }
    const onHand = row.qty || 0;
    const currentQty = Number(form.quantity) || 0;
    if (onHand > 0 && (currentQty <= 0 || currentQty > onHand)) {
      update('quantity', String(Math.min(onHand, Math.max(1, currentQty || 1))));
    }
  };

  const setTransferQty = useCallback((qty) => {
    update('quantity', String(qty));
  }, []);

  const setMinusDeduction = useCallback((locationId, qty) => {
    setMinusDeductions((prev) => ({
      ...prev,
      [locationId]: qty,
    }));
  }, []);

  const setAddQuantity = useCallback((locationId, qty) => {
    setAddQuantities((prev) => ({
      ...prev,
      [locationId]: qty,
    }));
  }, []);

  const handleAddNewRack = useCallback((row, qty) => {
    const locId = String(row.locationId);
    setExtraAddLocations((prev) => {
      if (prev.some((r) => String(r.locationId) === locId)) return prev;
      if (sellableLocationRows.some((r) => String(r.locationId) === locId)) return prev;
      return [...prev, { ...row, isNew: true }];
    });
    setAddQuantities((prev) => ({
      ...prev,
      [locId]: (Number(prev[locId]) || 0) + qty,
    }));
  }, [sellableLocationRows]);

  const handleSaveRules = useCallback(async () => {
    if (!item?._id || !rulesForm) return;

    const minStock = Number(rulesForm.minStock);
    const maxStock = Number(rulesForm.maxStock);
    const reorderQty = Number(rulesForm.reorderQty) || 0;
    const deadStockQty = Number(rulesForm.deadStockQty);

    if (Number.isNaN(minStock) || minStock < 0) {
      toast.error('Enter a valid min stock');
      return;
    }
    if (Number.isNaN(maxStock) || maxStock < 0) {
      toast.error('Enter a valid max stock');
      return;
    }
    if (maxStock < minStock) {
      toast.error('Max stock must be greater than or equal to min stock');
      return;
    }
    if (!deadStockQty || deadStockQty < 1) {
      toast.error('Dead stock quantity must be at least 1');
      return;
    }

    setSavingRules(true);
    try {
      await adminJson(`/api/admin/inventory/${item._id}/rules`, {
        method: 'PATCH',
        body: JSON.stringify({
          minStock,
          maxStock,
          reorderQty,
          deadStockPeriod: rulesForm.deadStockPeriod,
          deadStockQty,
          deadStockMarked: Boolean(rulesForm.deadStockMarked),
          gateRemark: rulesForm.gateRemark?.trim() || '',
        }),
      });
      toast.success('Inventory rules updated');
      await mutate();
      setEditingRules(false);
      onSuccess?.();
    } catch (err) {
      toast.error(err.message || 'Failed to update rules');
    } finally {
      setSavingRules(false);
    }
  }, [item?._id, mutate, onSuccess, rulesForm]);

  const postAddMovement = useCallback(async () => {
    const lines = addLocationRows
      .map((row) => ({
        locationId: row.locationId,
        quantity: addQuantities[String(row.locationId)] ?? 0,
      }))
      .filter((line) => line.quantity > 0);

    if (lines.length === 0) {
      toast.error('Enter quantity to add at least one location');
      return false;
    }

    if (lines.length > MAX_MOVEMENT_LINES) {
      toast.error(`At most ${MAX_MOVEMENT_LINES} locations per movement`);
      return false;
    }

    if (String(form.remark || '').length > MAX_MOVEMENT_REMARK_LENGTH) {
      toast.error(`Remark must be ${MAX_MOVEMENT_REMARK_LENGTH} characters or fewer`);
      return false;
    }

    setSubmitting(true);
    try {
      await adminJson('/api/admin/inventory/movement', {
        method: 'POST',
        body: JSON.stringify({
          productId: item._id,
          action: 'add',
          reason: form.reason,
          remark: form.remark,
          lines,
        }),
      });

      toast.success('Movement posted');
      await mutate();
      onSuccess?.();
      onClose();
      return true;
    } catch (err) {
      toast.error(err.message || 'Failed to post movement');
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [addLocationRows, addQuantities, form.reason, form.remark, item._id, mutate, onClose, onSuccess]);

  const handlePost = useCallback(async () => {
    if (tab === 'minus') {
      const lines = sellableLocationRows
        .map((row) => ({
          locationId: row.locationId,
          quantity: minusDeductions[String(row.locationId)] ?? 0,
        }))
        .filter((line) => line.quantity > 0);

      if (lines.length === 0) {
        toast.error('Enter quantity to remove from at least one location');
        return;
      }

      if (lines.length > MAX_MOVEMENT_LINES) {
        toast.error(`At most ${MAX_MOVEMENT_LINES} locations per movement`);
        return;
      }

      if (String(form.remark || '').length > MAX_MOVEMENT_REMARK_LENGTH) {
        toast.error(`Remark must be ${MAX_MOVEMENT_REMARK_LENGTH} characters or fewer`);
        return;
      }

      if (minusExceedsStock) {
        toast.error('Remove quantity cannot exceed on-hand at any location');
        return;
      }

      setSubmitting(true);
      try {
        await adminJson('/api/admin/inventory/movement', {
          method: 'POST',
          body: JSON.stringify({
            productId: item._id,
            action: 'minus',
            reason: form.reason,
            remark: form.remark,
            lines,
          }),
        });

        toast.success('Movement posted');
        await mutate();
        onSuccess?.();
        onClose();
      } catch (err) {
        toast.error(err.message || 'Failed to post movement');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (tab === 'add') {
      const lines = addLocationRows
        .map((row) => ({
          locationId: row.locationId,
          quantity: addQuantities[String(row.locationId)] ?? 0,
        }))
        .filter((line) => line.quantity > 0);

      if (lines.length === 0) {
        toast.error('Enter quantity to add at least one location');
        return;
      }

      if (lines.length > MAX_MOVEMENT_LINES) {
        toast.error(`At most ${MAX_MOVEMENT_LINES} locations per movement`);
        return;
      }

      if (String(form.remark || '').length > MAX_MOVEMENT_REMARK_LENGTH) {
        toast.error(`Remark must be ${MAX_MOVEMENT_REMARK_LENGTH} characters or fewer`);
        return;
      }

      /**
       * Max stock is a soft planning limit — warn before post, never hard-block.
       */
      const maxStock = inventoryRule?.maxStock;
      const onHandQty = stockData?.sellableQty ?? item?.sellableQty ?? 0;
      if (
        Number.isFinite(maxStock) &&
        maxStock >= 0 &&
        onHandQty + totalAddQty > maxStock
      ) {
        setMaxWarnPending({
          currentQty: onHandQty,
          afterQty: onHandQty + totalAddQty,
          maxStock,
        });
        return;
      }

      await postAddMovement();
      return;
    }

    if (tab === 'transfer') {
      const qty = transferQty;
      if (!qty || qty <= 0) {
        toast.error('Enter a valid quantity');
        return;
      }
      const fromCheck = validateLocationSelectionClient({
        ...fromSel,
        locationId: form.fromLocationId,
      });
      if (!fromCheck.valid) {
        toast.error('Select source branch, floor, and rack');
        return;
      }
      const toCheck = validateLocationSelectionClient({
        ...toSel,
        locationId: form.toLocationId,
      });
      if (!toCheck.valid) {
        toast.error('Select destination branch, floor, and rack');
        return;
      }
      if (transferSameLocation) {
        toast.error('Source and destination must be different');
        return;
      }
      if (transferExceedsStock) {
        toast.error(`Cannot transfer ${qty} — only ${availableAtTransferFrom} available at source`);
        return;
      }

      setSubmitting(true);
      try {
        await adminJson('/api/admin/inventory/movement', {
          method: 'POST',
          body: JSON.stringify({
            productId: item._id,
            action: 'transfer',
            quantity: qty,
            remark: form.remark,
            fromLocationId: form.fromLocationId || null,
            toLocationId: form.toLocationId,
          }),
        });

        toast.success('Movement posted');
        await mutate();
        onSuccess?.();
        onClose();
      } catch (err) {
        toast.error(err.message || 'Failed to post movement');
      } finally {
        setSubmitting(false);
      }
    }
  }, [
    form,
    item._id,
    item?.sellableQty,
    tab,
    mutate,
    onClose,
    onSuccess,
    sellableLocationRows,
    minusDeductions,
    minusExceedsStock,
    addLocationRows,
    addQuantities,
    totalAddQty,
    inventoryRule,
    stockData,
    postAddMovement,
    transferQty,
    transferSameLocation,
    transferExceedsStock,
    availableAtTransferFrom,
    fromSel,
    toSel,
  ]);

  const handleMaxWarnContinue = useCallback(async () => {
    setMaxWarnPending(null);
    await postAddMovement();
  }, [postAddMovement]);

  if (!item) return null;

  const summary = stockData || item;
  const stockUnit = stockData?.product?.stockUnit || item.stockUnit || 'Pcs';
  const isRulesTab = tab === 'rules';
  const onHandQty = summary.sellableQty ?? 0;
  const afterMinusQty = Math.max(0, onHandQty - totalMinusQty);
  const afterAddQty = onHandQty + totalAddQty;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div
        className={`bg-white rounded-xl shadow-xl w-full max-h-[90vh] flex flex-col overflow-hidden ${
          tab === 'transfer' ? 'max-w-2xl' : 'max-w-lg'
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-movement-title"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 shrink-0">
          <div className="min-w-0 pr-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400 mb-1">
              Stock movement
            </p>
            <h2
              id="stock-movement-title"
              className="text-[15px] sm:text-base font-semibold text-gray-900 leading-snug line-clamp-2"
              title={item.title}
            >
              {item.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <ChromeMovementTabs
          activeTab={tab}
          onSelect={(key) => {
            if (key === 'rules') {
              setEditingRules(false);
              setTab('rules');
              return;
            }
            setMovementTab(key);
          }}
        />

        <div className="px-5 pt-4 flex-1 overflow-y-auto min-h-0 bg-white">
          {isLoading ? (
            <p className="text-sm text-gray-500 flex items-center gap-2 mb-4">
              <Loader2 size={14} className="animate-spin" />
              Loading stock…
            </p>
          ) : (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2">
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                  On hand
                </span>
                <p className="text-base font-bold tabular-nums text-gray-900">
                  {summary.sellableQty ?? 0}{' '}
                  <span className="text-sm font-medium text-gray-500">{stockUnit}</span>
                </p>
              </div>
              {(summary.isDeadStock ||
                summary.condition === 'HAS_DEAD_STOCK' ||
                inventoryRule?.deadStockMarked) && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-100 text-amber-900">
                  Dead stock
                </span>
              )}
            </div>
          )}

          <div className="space-y-4 pb-2">
            {isRulesTab ? (
              <RulesPanel
                rule={inventoryRule}
                stockUnit={stockUnit}
                isLoading={isLoading}
                canEdit={canEditRules}
                isEditing={editingRules}
                onStartEdit={handleStartRulesEdit}
                rulesForm={rulesForm}
                onRulesChange={setRulesForm}
              />
            ) : tab === 'minus' ? (
              <>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-2">
                    Why remove?
                  </p>
                  <ReasonChipRow
                    options={MINUS_MOVEMENT_REASONS}
                    labels={MINUS_REASON_CHIP_LABELS}
                    value={form.reason}
                    onChange={(reason) => update('reason', reason)}
                    tone="amber"
                  />
                </div>

                {!isLoading && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800">
                      From which rack?
                    </p>
                    <LocationQtyList
                      mode="minus"
                      rows={sellableLocationRows}
                      quantities={minusDeductions}
                      onQuantityChange={setMinusDeduction}
                    />
                  </div>
                )}

                <details className="group">
                  <summary className="cursor-pointer text-xs font-medium text-gray-500 hover:text-gray-800 list-none">
                    + Optional note
                  </summary>
                  <input
                    type="text"
                    placeholder="Optional note"
                    className="mt-2 w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl"
                    value={form.remark}
                    maxLength={MAX_MOVEMENT_REMARK_LENGTH}
                    onChange={(e) => update('remark', e.target.value)}
                  />
                </details>
              </>
            ) : tab === 'add' ? (
              <>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-2">
                    Why add?
                  </p>
                  <ReasonChipRow
                    options={ADD_MOVEMENT_REASONS}
                    labels={ADD_REASON_CHIP_LABELS}
                    value={form.reason}
                    onChange={(reason) => update('reason', reason)}
                    tone="emerald"
                  />
                </div>

                {!isLoading && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                      {sellableLocationRows.length > 0
                        ? 'To which rack?'
                        : 'Choose where to place stock'}
                    </p>
                    <LocationQtyList
                      mode="add"
                      rows={addLocationRows}
                      quantities={addQuantities}
                      onQuantityChange={setAddQuantity}
                    />
                  </div>
                )}

                {!isLoading && (
                  <NewRackAddPanel
                    defaultBranchId={primaryAddLocation?.branchId || null}
                    defaultFloorId={primaryAddLocation?.floorId || null}
                    occupiedLocationIds={occupiedAddLocationIds}
                    defaultOpen={sellableLocationRows.length === 0}
                    onAdd={handleAddNewRack}
                  />
                )}

                <details className="group">
                  <summary className="cursor-pointer text-xs font-medium text-gray-500 hover:text-gray-800 list-none">
                    + Optional note
                  </summary>
                  <input
                    type="text"
                    placeholder="Optional note"
                    className="mt-2 w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl"
                    value={form.remark}
                    maxLength={MAX_MOVEMENT_REMARK_LENGTH}
                    onChange={(e) => update('remark', e.target.value)}
                  />
                </details>
              </>
            ) : (
              <>
                <TransferTicketPanel
                  fromRows={sellableLocationRows}
                  fromLocationId={form.fromLocationId}
                  onSelectFrom={selectTransferFromRow}
                  transferQty={transferQty}
                  onTransferQtyChange={setTransferQty}
                  toLocationId={form.toLocationId}
                  onSelectTo={handleSelectTransferTo}
                  toDisplayPath={toDisplayPath}
                  fromRow={selectedTransferFromRow}
                  stockUnit={stockUnit}
                  isLoading={isLoading}
                />
                <details className="group">
                  <summary className="cursor-pointer text-xs font-medium text-gray-500 hover:text-gray-800 list-none">
                    + Optional note
                  </summary>
                  <input
                    type="text"
                    placeholder="Optional note"
                    className="mt-2 w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl"
                    value={form.remark}
                    maxLength={MAX_MOVEMENT_REMARK_LENGTH}
                    onChange={(e) => update('remark', e.target.value)}
                  />
                </details>
              </>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-gray-100 bg-gray-50/90 px-5 py-3 space-y-3">
          {(tab === 'minus' || tab === 'add') && !isRulesTab && !isLoading && (
            <div
              className={`rounded-xl border px-3 py-2.5 flex items-center justify-between gap-3 ${
                tab === 'minus'
                  ? minusExceedsStock
                    ? 'border-red-200 bg-red-50'
                    : 'border-amber-200 bg-amber-50/70'
                  : 'border-emerald-200 bg-emerald-50/70'
              }`}
            >
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                  {tab === 'minus' ? 'Removing' : 'Adding'}
                </p>
                <p
                  className={`text-base font-bold tabular-nums ${
                    tab === 'minus' && minusExceedsStock
                      ? 'text-red-700'
                      : tab === 'minus'
                        ? 'text-amber-950'
                        : 'text-emerald-950'
                  }`}
                >
                  {tab === 'minus' ? totalMinusQty : totalAddQty} {stockUnit}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                  After
                </p>
                <p className="text-base font-bold tabular-nums text-gray-900">
                  {tab === 'minus' ? afterMinusQty : afterAddQty} {stockUnit}
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-white"
            >
              {isRulesTab ? 'Close' : 'Cancel'}
            </button>
            {!isRulesTab && (
              <button
                type="button"
                disabled={
                  submitting ||
                  (tab === 'minus' &&
                    (sellableLocationRows.length === 0 ||
                      totalMinusQty <= 0 ||
                      minusExceedsStock)) ||
                  (tab === 'add' && totalAddQty <= 0) ||
                  (tab === 'transfer' &&
                    (sellableLocationRows.length === 0 ||
                      transferMissingFrom ||
                      transferExceedsStock ||
                      transferSameLocation ||
                      transferQty <= 0 ||
                      !form.toLocationId))
                }
                onClick={handlePost}
                className={`min-h-[44px] px-5 py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-50 inline-flex items-center gap-2 ${
                  tab === 'minus'
                    ? 'bg-amber-700 hover:bg-amber-800'
                    : tab === 'transfer'
                      ? 'bg-sky-700 hover:bg-sky-800'
                      : 'bg-emerald-800 hover:bg-emerald-900'
                }`}
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {tab === 'transfer' && !submitting && <Check size={14} />}
                {tab === 'minus'
                  ? `Post minus · ${totalMinusQty} ${stockUnit}`
                  : tab === 'add'
                    ? `Post add · ${totalAddQty} ${stockUnit}`
                    : tab === 'transfer'
                      ? `Confirm transfer · ${transferQty} ${stockUnit}`
                      : 'Post movement'}
              </button>
            )}
            {isRulesTab && editingRules && (
              <button
                type="button"
                onClick={handleCancelRulesEdit}
                disabled={savingRules}
                className="min-h-[44px] px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-white disabled:opacity-50"
              >
                Cancel edit
              </button>
            )}
            {isRulesTab && canEditRules && inventoryRule && editingRules && (
              <button
                type="button"
                disabled={savingRules || !rulesForm}
                onClick={handleSaveRules}
                className="min-h-[44px] px-4 py-2.5 text-sm font-semibold text-white bg-emerald-800 rounded-xl hover:bg-emerald-900 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {savingRules && <Loader2 size={14} className="animate-spin" />}
                Save rules
              </button>
            )}
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
