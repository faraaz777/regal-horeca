'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { X, Loader2, Pencil } from 'lucide-react';
import { adminJson } from '@/lib/client/adminFetch';
import { validateLocationSelectionClient } from '@/lib/client/locationCascadeApi';
import LocationSelector from '@/components/admin/inventory/LocationSelector';
import {
  MOVEMENT_STATUS_BUCKETS,
  STATUS_BUCKET_LABELS,
  MOVEMENT_REASONS,
  MOVEMENT_REASON_LABELS,
  ADD_MOVEMENT_REASONS,
  ADD_MOVEMENT_REASON_LABELS,
  DEAD_STOCK_PERIOD_LABELS,
  DEAD_STOCK_PERIODS,
} from '@/lib/shared/inventoryConstants';
import { canEditInventoryRules } from '@/lib/shared/permissions';

const fetcher = (url) => adminJson(url);

const TAB_LABELS = {
  add: 'Add',
  minus: 'Minus',
  status_change: 'Status change',
  transfer: 'Transfer',
  rules: 'Rules',
};

const MOVEMENT_TABS = ['add', 'minus', 'status_change', 'transfer'];

const EMPTY_FORM = {
  quantity: '1',
  reason: 'opening_stock',
  statusBucket: 'sellable',
  fromBucket: 'sellable',
  toBucket: 'hold',
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

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function RuleRow({ label, value, highlight }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-xs font-semibold text-gray-700 shrink-0">{label}</span>
      <span
        className={`text-sm text-right ${
          highlight ? 'font-semibold text-emerald-800' : 'font-medium text-gray-900'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

const inputClass =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500';

function buildRulesFormFromRule(rule) {
  if (!rule) return null;
  return {
    minStock: String(rule.minStock ?? ''),
    maxStock: String(rule.maxStock ?? ''),
    reorderQty: String(rule.reorderQty ?? '0'),
    deadStockPeriod: rule.deadStockPeriod || 'month',
    deadStockQty: String(rule.deadStockQty ?? ''),
    deadStockMarked: Boolean(rule.deadStockMarked),
    gateRemark: rule.gateRemark || '',
  };
}

function RulesReadView({ rule, stockUnit, showPermissionNote = false }) {
  const unit = stockUnit || 'units';
  const periodLabel = DEAD_STOCK_PERIOD_LABELS[rule.deadStockPeriod] || rule.deadStockPeriod;
  const statusLabel = rule.openingStatusBucket
    ? STATUS_BUCKET_LABELS[rule.openingStatusBucket] || rule.openingStatusBucket
    : '—';
  const setAtLabel = rule.setAt
    ? new Date(rule.setAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '—';
  const updatedAtLabel = rule.updatedAt
    ? new Date(rule.updatedAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '—';

  return (
    <>
      <div className="rounded-lg border border-gray-200 bg-gray-50/50 px-4 py-1">
        <RuleRow label="Min stock" value={`${rule.minStock} ${unit}`} />
        <RuleRow label="Max stock" value={`${rule.maxStock} ${unit}`} />
        <RuleRow label="Reorder qty" value={`${rule.reorderQty ?? 0} ${unit}`} />
        <RuleRow label="Dead stock rule" value={periodLabel} />
        <RuleRow label="Qty to sell in period" value={`${rule.deadStockQty} ${unit}`} />
        <RuleRow label="Opening status" value={statusLabel} />
        <RuleRow
          label="Mark as dead stock"
          value={rule.deadStockMarked ? 'Yes' : 'No'}
          highlight={rule.deadStockMarked}
        />
        <RuleRow label="Set at intake" value={setAtLabel} />
        <RuleRow label="Last updated" value={updatedAtLabel} />
      </div>
      {rule.gateRemark && (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Intake remark
          </p>
          <p className="text-sm text-gray-800">{rule.gateRemark}</p>
        </div>
      )}
      {showPermissionNote && (
        <p className="text-[11px] text-gray-500">
          Only Super Admin and Inventory Manager can edit these rules.
        </p>
      )}
    </>
  );
}

function RulesPanel({
  rule,
  stockUnit,
  isLoading,
  canEdit,
  isEditing,
  onStartEdit,
  rulesForm,
  onRulesChange,
}) {
  if (isLoading) {
    return (
      <p className="text-sm text-gray-500 flex items-center gap-2 py-6 justify-center">
        <Loader2 size={14} className="animate-spin" />
        Loading inventory rules…
      </p>
    );
  }

  if (!rule) {
    return (
      <div className="rounded-lg border border-amber-100 bg-amber-50/60 px-4 py-5 text-center">
        <p className="text-sm font-medium text-amber-900">No inventory rules on file</p>
        <p className="text-xs text-amber-800 mt-1">
          Rules are set during the first inventory gate when opening stock is recorded.
        </p>
      </div>
    );
  }

  const unit = stockUnit || 'units';
  const statusLabel = rule.openingStatusBucket
    ? STATUS_BUCKET_LABELS[rule.openingStatusBucket] || rule.openingStatusBucket
    : '—';
  const setAtLabel = rule.setAt
    ? new Date(rule.setAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '—';
  const updatedAtLabel = rule.updatedAt
    ? new Date(rule.updatedAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '—';

  if (!canEdit || !isEditing) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
            Inventory gate rules
          </p>
          {canEdit && !isEditing && (
            <button
              type="button"
              onClick={onStartEdit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 border border-emerald-200 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition-colors"
            >
              <Pencil size={13} />
              Edit
            </button>
          )}
        </div>
        <RulesReadView rule={rule} stockUnit={stockUnit} showPermissionNote={!canEdit} />
      </div>
    );
  }

  const update = (key, value) => {
    onRulesChange((prev) => ({ ...prev, [key]: value }));
  };

  const toggleDeadStock = (checked) => {
    onRulesChange((prev) => ({ ...prev, deadStockMarked: checked }));
  };

  return (
    <div className="space-y-4">
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
        Inventory gate rules
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Min stock" required>
          <div className="relative">
            <input
              type="number"
              min="0"
              className={`${inputClass} pr-14`}
              value={rulesForm?.minStock ?? ''}
              onChange={(e) => update('minStock', e.target.value)}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
              {unit}
            </span>
          </div>
        </Field>
        <Field label="Max stock" required>
          <div className="relative">
            <input
              type="number"
              min="0"
              className={`${inputClass} pr-14`}
              value={rulesForm?.maxStock ?? ''}
              onChange={(e) => update('maxStock', e.target.value)}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
              {unit}
            </span>
          </div>
        </Field>
        <Field label="Reorder qty">
          <div className="relative">
            <input
              type="number"
              min="0"
              className={`${inputClass} pr-14`}
              value={rulesForm?.reorderQty ?? '0'}
              onChange={(e) => update('reorderQty', e.target.value)}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
              {unit}
            </span>
          </div>
        </Field>
        <Field label="Dead stock rule" required>
          <select
            className={inputClass}
            value={rulesForm?.deadStockPeriod ?? 'month'}
            onChange={(e) => update('deadStockPeriod', e.target.value)}
          >
            {DEAD_STOCK_PERIODS.map((period) => (
              <option key={period} value={period}>
                {DEAD_STOCK_PERIOD_LABELS[period]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Qty to sell in period" required>
          <div className="relative">
            <input
              type="number"
              min="1"
              className={`${inputClass} pr-14`}
              value={rulesForm?.deadStockQty ?? ''}
              onChange={(e) => update('deadStockQty', e.target.value)}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
              {unit}
            </span>
          </div>
        </Field>
        <Field label="Opening status">
          <input
            type="text"
            className={`${inputClass} bg-gray-50 text-gray-600`}
            value={statusLabel}
            readOnly
            title="Opening status is fixed from the original intake ledger entry"
          />
        </Field>
      </div>

      <label className="flex items-start gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={Boolean(rulesForm?.deadStockMarked)}
          onChange={(e) => toggleDeadStock(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
        />
        <span>
          <span className="text-sm font-medium text-gray-800">Mark as dead stock</span>
          <span className="block text-[11px] text-gray-500 mt-0.5">
            Flags that sales are below the dead-stock target for this product.
          </span>
        </span>
      </label>

      <Field label="Intake remark">
        <textarea
          className={`${inputClass} resize-none`}
          rows={2}
          value={rulesForm?.gateRemark ?? ''}
          onChange={(e) => update('gateRemark', e.target.value)}
          placeholder="Optional note from original intake"
        />
      </Field>

      <p className="text-[11px] text-gray-500">
        Set at intake: {setAtLabel}
        {rule.updatedAt && ` · Last updated: ${updatedAtLabel}`}
      </p>
    </div>
  );
}

function resolveMinusLocationId(selection, minusRows) {
  if (!selection?.rackId) return '';
  const row = minusRows.find(
    (r) =>
      String(r.rackId) === String(selection.rackId) ||
      String(r.locationId) === String(selection.rackId)
  );
  return row ? String(row.locationId) : String(selection.locationId || selection.rackId);
}

export default function StockMovementModal({ item, onClose, onSuccess }) {
  const [tab, setTab] = useState('add');
  const [form, setForm] = useState(EMPTY_FORM);
  const [locationSel, setLocationSel] = useState(EMPTY_LOCATION);
  const [fromSel, setFromSel] = useState(EMPTY_LOCATION);
  const [toSel, setToSel] = useState(EMPTY_LOCATION);
  const [submitting, setSubmitting] = useState(false);
  const [rulesForm, setRulesForm] = useState(null);
  const [savingRules, setSavingRules] = useState(false);
  const [editingRules, setEditingRules] = useState(false);

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
    setLocationSel(EMPTY_LOCATION);
    setFromSel(EMPTY_LOCATION);
    setToSel(EMPTY_LOCATION);
    setForm((p) => ({
      ...EMPTY_FORM,
      quantity: p.quantity,
      remark: p.remark,
      reason:
        key === 'add'
          ? 'opening_stock'
          : key === 'minus'
            ? 'manual_adjustment'
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

  const minusLocationsForBucket = useMemo(() => {
    if (!stockRows.length) return [];
    return stockRows
      .filter((r) => r.statusBucket === form.statusBucket && (r.qty || 0) > 0)
      .sort((a, b) => (b.qty || 0) - (a.qty || 0));
  }, [stockRows, form.statusBucket]);

  const sellableLocations = useMemo(() => {
    return stockRows
      .filter((r) => r.statusBucket === 'sellable' && (r.qty || 0) > 0)
      .sort((a, b) => (b.qty || 0) - (a.qty || 0));
  }, [stockRows]);

  const allowedRackIdsForMinus = useMemo(
    () => [...new Set(minusLocationsForBucket.map((r) => r.rackId).filter(Boolean))],
    [minusLocationsForBucket]
  );

  const allowedRackIdsForTransfer = useMemo(
    () => [...new Set(sellableLocations.map((r) => r.rackId).filter(Boolean))],
    [sellableLocations]
  );

  const selectedMinusRow = useMemo(() => {
    if (!form.locationId) return null;
    return minusLocationsForBucket.find(
      (r) => String(r.locationId) === String(form.locationId)
    );
  }, [minusLocationsForBucket, form.locationId]);

  const availableAtLocation = selectedMinusRow?.qty ?? 0;
  const requestedQty = Number(form.quantity) || 0;
  const minusExceedsStock =
    tab === 'minus' && (availableAtLocation <= 0 || requestedQty > availableAtLocation);
  const minusMissingLocation = tab === 'minus' && minusLocationsForBucket.length > 0 && !form.locationId;

  useEffect(() => {
    if (tab !== 'minus' || !minusLocationsForBucket.length) return;
    const currentValid = minusLocationsForBucket.some(
      (r) => String(r.locationId) === String(form.locationId)
    );
    if (!currentValid) {
      const first = minusLocationsForBucket[0];
      setForm((p) => ({ ...p, locationId: String(first.locationId) }));
      setLocationSel({
        branchId: first.branchId || null,
        floorId: first.floorId || null,
        rackId: first.rackId || null,
      });
    }
  }, [tab, form.statusBucket, minusLocationsForBucket, form.locationId]);

  useEffect(() => {
    if (tab !== 'minus' || !availableAtLocation) return;
    if (requestedQty > availableAtLocation) {
      setForm((p) => ({ ...p, quantity: String(availableAtLocation) }));
    }
  }, [tab, form.locationId, availableAtLocation, requestedQty]);

  const reasonOptions = tab === 'add' ? ADD_MOVEMENT_REASONS : MOVEMENT_REASONS;
  const reasonLabels = tab === 'add' ? ADD_MOVEMENT_REASON_LABELS : MOVEMENT_REASON_LABELS;

  const handleLocationChange = useCallback(
    (selection) => {
      setLocationSel({
        branchId: selection.branchId,
        floorId: selection.floorId,
        rackId: selection.rackId,
      });
      if (tab === 'minus') {
        update('locationId', resolveMinusLocationId(selection, minusLocationsForBucket));
      } else {
        update('locationId', selection.locationId || '');
      }
    },
    [tab, minusLocationsForBucket]
  );

  const handleFromLocationChange = useCallback(
    (selection) => {
      setFromSel({
        branchId: selection.branchId,
        floorId: selection.floorId,
        rackId: selection.rackId,
      });
      update('fromLocationId', resolveMinusLocationId(selection, sellableLocations));
    },
    [sellableLocations]
  );

  const handleToLocationChange = useCallback((selection) => {
    setToSel({
      branchId: selection.branchId,
      floorId: selection.floorId,
      rackId: selection.rackId,
    });
    update('toLocationId', selection.locationId || '');
  }, []);

  const selectMinusRow = (row) => {
    const locId = String(row.locationId);
    update('locationId', locId);
    setLocationSel({
      branchId: row.branchId || null,
      floorId: row.floorId || null,
      rackId: row.rackId || null,
    });
  };

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

  const handlePost = useCallback(async () => {
    const qty = Number(form.quantity);
    if (!qty || qty <= 0) {
      toast.error('Enter a valid quantity');
      return;
    }

    if (tab === 'add' || tab === 'status_change') {
      const check = validateLocationSelectionClient({
        ...locationSel,
        locationId: form.locationId,
      });
      if (!check.valid) {
        toast.error(check.error);
        return;
      }
    }

    if (tab === 'minus') {
      if (!form.locationId) {
        toast.error('Select branch, floor, and rack to remove stock from');
        return;
      }
      if (qty > availableAtLocation) {
        toast.error(
          `Cannot remove ${qty} — only ${availableAtLocation} available at this location`
        );
        return;
      }
    }

    if (tab === 'transfer') {
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
      if (String(form.fromLocationId) === String(form.toLocationId)) {
        toast.error('Source and destination must be different');
        return;
      }
    }

    setSubmitting(true);
    try {
      const body = {
        productId: item._id,
        action: tab,
        quantity: qty,
        reason: form.reason,
        remark: form.remark,
      };

      if (tab === 'add' || tab === 'minus') {
        body.statusBucket = form.statusBucket;
        body.locationId = form.locationId || null;
      } else if (tab === 'status_change') {
        body.fromBucket = form.fromBucket;
        body.toBucket = form.toBucket;
        body.locationId = form.locationId || null;
      } else if (tab === 'transfer') {
        body.fromLocationId = form.fromLocationId || null;
        body.toLocationId = form.toLocationId;
      }

      await adminJson('/api/admin/inventory/movement', {
        method: 'POST',
        body: JSON.stringify(body),
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
  }, [
    form,
    item._id,
    tab,
    mutate,
    onClose,
    onSuccess,
    availableAtLocation,
    locationSel,
    fromSel,
    toSel,
  ]);

  if (!item) return null;

  const summary = stockData || item;
  const stockUnit = stockData?.product?.stockUnit || item.stockUnit || 'Pcs';
  const isRulesTab = tab === 'rules';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-movement-title"
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <h2 id="stock-movement-title" className="text-base font-semibold text-gray-900 pr-4">
            Stock movement — {item.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pt-4">
          <div className="flex flex-wrap gap-2 mb-4">
            {MOVEMENT_TABS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setMovementTab(key)}
                className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${
                  tab === key
                    ? 'border-emerald-600 text-emerald-700 bg-emerald-50'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {TAB_LABELS[key]}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setEditingRules(false);
                setTab('rules');
              }}
              className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${
                isRulesTab
                  ? 'border-emerald-600 text-emerald-700 bg-emerald-50'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {TAB_LABELS.rules}
            </button>
          </div>

          {isLoading ? (
            <p className="text-sm text-gray-500 flex items-center gap-2 mb-4">
              <Loader2 size={14} className="animate-spin" />
              Loading stock…
            </p>
          ) : (
            <div className="mb-4">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Stock status
              </p>
              <p className="text-xs text-gray-600">
                Sellable {summary.sellableQty ?? 0} · Hold {summary.holdQty ?? 0} · Scrapped{' '}
                {summary.scrapQty ?? 0}
              </p>
            </div>
          )}

          <div className="space-y-4 pb-4">
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
            ) : (
              <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantity" required>
                <input
                  type="number"
                  min="1"
                  max={tab === 'minus' && availableAtLocation > 0 ? availableAtLocation : undefined}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                  value={form.quantity}
                  onChange={(e) => update('quantity', e.target.value)}
                />
                {tab === 'minus' && form.locationId && (
                  <p
                    className={`text-[11px] mt-1 ${
                      minusExceedsStock ? 'text-red-600 font-medium' : 'text-gray-500'
                    }`}
                  >
                    {availableAtLocation > 0
                      ? `Max ${availableAtLocation} at selected location`
                      : 'No stock at selected location'}
                  </p>
                )}
              </Field>

              {(tab === 'add' || tab === 'minus') && (
                <Field label="Reason">
                  <select
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
                    value={form.reason}
                    onChange={(e) => update('reason', e.target.value)}
                  >
                    {reasonOptions.map((r) => (
                      <option key={r} value={r}>
                        {reasonLabels[r]}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              {tab === 'status_change' && (
                <>
                  <Field label="From status" required>
                    <select
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
                      value={form.fromBucket}
                      onChange={(e) => update('fromBucket', e.target.value)}
                    >
                      {MOVEMENT_STATUS_BUCKETS.map((b) => (
                        <option key={b} value={b}>
                          {STATUS_BUCKET_LABELS[b]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="To status" required>
                    <select
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
                      value={form.toBucket}
                      onChange={(e) => update('toBucket', e.target.value)}
                    >
                      {MOVEMENT_STATUS_BUCKETS.map((b) => (
                        <option key={b} value={b}>
                          {STATUS_BUCKET_LABELS[b]}
                        </option>
                      ))}
                    </select>
                  </Field>
                </>
              )}
            </div>

            {(tab === 'add' || tab === 'minus') && (
              <Field label="Status bucket" required>
                <select
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
                  value={form.statusBucket}
                  onChange={(e) => update('statusBucket', e.target.value)}
                >
                  {MOVEMENT_STATUS_BUCKETS.map((b) => (
                    <option key={b} value={b}>
                      {STATUS_BUCKET_LABELS[b]}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            {tab === 'minus' && !isLoading && (
              <div className="rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2.5">
                <p className="text-[10px] font-semibold text-amber-800 uppercase tracking-wide mb-1.5">
                  Stock at locations ({STATUS_BUCKET_LABELS[form.statusBucket]})
                </p>
                {minusLocationsForBucket.length === 0 ? (
                  <p className="text-xs text-amber-900">
                    No {STATUS_BUCKET_LABELS[form.statusBucket]?.toLowerCase()} stock at any
                    location.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {minusLocationsForBucket.map((row) => {
                      const locId = String(row.locationId);
                      const isSelected = form.locationId === locId;
                      return (
                        <li key={locId}>
                          <button
                            type="button"
                            onClick={() => selectMinusRow(row)}
                            className={`w-full text-left text-xs px-2 py-1.5 rounded-md border transition-colors ${
                              isSelected
                                ? 'border-amber-300 bg-white text-amber-950 font-medium'
                                : 'border-transparent text-amber-900 hover:bg-white/80'
                            }`}
                          >
                            <span className="truncate block">{row.locationPath || '—'}</span>
                            <span className="font-mono font-semibold">{row.qty}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {(tab === 'add' || tab === 'minus' || tab === 'status_change') && (
              <Field
                label={tab === 'minus' ? 'Remove from location' : 'Location'}
                required
              >
                <LocationSelector
                  selectedBranchId={locationSel.branchId}
                  selectedFloorId={locationSel.floorId}
                  selectedRackId={locationSel.rackId || form.locationId}
                  onChange={handleLocationChange}
                  required
                  disabled={tab === 'minus' && minusLocationsForBucket.length === 0}
                  allowedLocationIds={
                    tab === 'minus' ? allowedRackIdsForMinus : undefined
                  }
                />
              </Field>
            )}

            {tab === 'transfer' && (
              <div className="space-y-4">
                <Field label="From location" required>
                  <LocationSelector
                    selectedBranchId={fromSel.branchId}
                    selectedFloorId={fromSel.floorId}
                    selectedRackId={fromSel.rackId || form.fromLocationId}
                    onChange={handleFromLocationChange}
                    required
                    disabled={sellableLocations.length === 0}
                    allowedLocationIds={allowedRackIdsForTransfer}
                  />
                </Field>
                <Field label="To location" required>
                  <LocationSelector
                    selectedBranchId={toSel.branchId}
                    selectedFloorId={toSel.floorId}
                    selectedRackId={toSel.rackId || form.toLocationId}
                    onChange={handleToLocationChange}
                    required
                  />
                </Field>
              </div>
            )}

            <Field label="Remark">
              <input
                type="text"
                placeholder="Optional note"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                value={form.remark}
                onChange={(e) => update('remark', e.target.value)}
              />
            </Field>
              </>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-white"
          >
            {isRulesTab ? 'Close' : 'Cancel'}
          </button>
          {!isRulesTab && (
          <button
            type="button"
            disabled={
              submitting ||
              (tab === 'minus' &&
                (minusLocationsForBucket.length === 0 ||
                  minusMissingLocation ||
                  minusExceedsStock ||
                  requestedQty <= 0))
            }
            onClick={handlePost}
            className="px-4 py-2 text-sm font-semibold text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Post movement
          </button>
          )}
          {isRulesTab && editingRules && (
            <button
              type="button"
              onClick={handleCancelRulesEdit}
              disabled={savingRules}
              className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-white disabled:opacity-50"
            >
              Cancel edit
            </button>
          )}
          {isRulesTab && canEditRules && inventoryRule && editingRules && (
            <button
              type="button"
              disabled={savingRules || !rulesForm}
              onClick={handleSaveRules}
              className="px-4 py-2 text-sm font-semibold text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {savingRules && <Loader2 size={14} className="animate-spin" />}
              Save rules
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
