'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { X, Loader2 } from 'lucide-react';
import { adminJson } from '@/lib/client/adminFetch';
import {
  MOVEMENT_STATUS_BUCKETS,
  STATUS_BUCKET_LABELS,
  MOVEMENT_REASONS,
  MOVEMENT_REASON_LABELS,
  ADD_MOVEMENT_REASONS,
  ADD_MOVEMENT_REASON_LABELS,
} from '@/lib/shared/inventoryConstants';

const fetcher = (url) => adminJson(url);

const TAB_LABELS = {
  add: 'Add',
  minus: 'Minus',
  status_change: 'Status change',
  transfer: 'Transfer',
};

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

export default function StockMovementModal({ item, onClose, onSuccess }) {
  const [tab, setTab] = useState('add');
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const stockUrl = item?._id ? `/api/admin/inventory/${item._id}/stock` : null;
  const { data: stockData, isLoading, mutate } = useSWR(stockUrl, fetcher, {
    revalidateOnFocus: false,
  });

  const { data: locationsData } = useSWR(
    '/api/admin/inventory/locations?selectable=true',
    fetcher,
    { revalidateOnFocus: false }
  );

  const locations = locationsData?.locations || [];

  useEffect(() => {
    if (!stockData?.locations?.length) return;
    const primary = stockData.locations.find((r) => r.qty > 0) || stockData.locations[0];
    const locId = String(primary?.locationId || '');
    setForm((p) => ({
      ...p,
      locationId: p.locationId || locId,
      fromLocationId: p.fromLocationId || locId,
    }));
  }, [stockData]);

  const update = (key, value) => setForm((p) => ({ ...p, [key]: value }));

  const setMovementTab = (key) => {
    setTab(key);
    if (key === 'add' && !ADD_MOVEMENT_REASONS.includes(form.reason)) {
      setForm((p) => ({ ...p, reason: 'opening_stock' }));
    } else if (key === 'minus' && !MOVEMENT_REASONS.includes(form.reason)) {
      setForm((p) => ({ ...p, reason: 'manual_adjustment' }));
    }
  };

  const stockRows = stockData?.locations || [];

  const minusLocationsForBucket = useMemo(() => {
    if (!stockRows.length) return [];
    return stockRows
      .filter((r) => r.statusBucket === form.statusBucket && (r.qty || 0) > 0)
      .sort((a, b) => (b.qty || 0) - (a.qty || 0));
  }, [stockRows, form.statusBucket]);

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
      setForm((p) => ({
        ...p,
        locationId: String(minusLocationsForBucket[0].locationId),
      }));
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

  const handlePost = useCallback(async () => {
    const qty = Number(form.quantity);
    if (!qty || qty <= 0) {
      toast.error('Enter a valid quantity');
      return;
    }

    if (tab === 'minus') {
      if (!form.locationId) {
        toast.error('Select the location to remove stock from');
        return;
      }
      if (qty > availableAtLocation) {
        toast.error(
          `Cannot remove ${qty} — only ${availableAtLocation} available at this location`
        );
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
        if (!body.toLocationId) {
          toast.error('Select destination location');
          setSubmitting(false);
          return;
        }
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
  }, [form, item._id, tab, mutate, onClose, onSuccess, availableAtLocation]);

  if (!item) return null;

  const summary = stockData || item;

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
            {['add', 'minus', 'status_change', 'transfer'].map((key) => (
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
                    No {STATUS_BUCKET_LABELS[form.statusBucket]?.toLowerCase()} stock at any location.
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
                            onClick={() => update('locationId', locId)}
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
              <Field label={tab === 'minus' ? 'Remove from location' : 'Location'} required={tab === 'minus'}>
                <select
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
                  value={form.locationId}
                  onChange={(e) => update('locationId', e.target.value)}
                  disabled={tab === 'minus' && minusLocationsForBucket.length === 0}
                >
                  {tab === 'minus' ? (
                    minusLocationsForBucket.length === 0 ? (
                      <option value="">No stock available</option>
                    ) : (
                      minusLocationsForBucket.map((row) => (
                        <option key={String(row.locationId)} value={String(row.locationId)}>
                          {row.locationPath} — {row.qty} available
                        </option>
                      ))
                    )
                  ) : (
                    <>
                      <option value="">Default location</option>
                      {locations.map((loc) => (
                        <option key={loc._id} value={loc._id}>
                          {loc.path}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </Field>
            )}

            {tab === 'transfer' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="From location">
                  <select
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
                    value={form.fromLocationId}
                    onChange={(e) => update('fromLocationId', e.target.value)}
                  >
                    <option value="">Default</option>
                    {locations.map((loc) => (
                      <option key={loc._id} value={loc._id}>
                        {loc.path}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="To location" required>
                  <select
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
                    value={form.toLocationId}
                    onChange={(e) => update('toLocationId', e.target.value)}
                  >
                    <option value="">Select…</option>
                    {locations.map((loc) => (
                      <option key={loc._id} value={loc._id}>
                        {loc.path}
                      </option>
                    ))}
                  </select>
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
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-white"
          >
            Cancel
          </button>
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
        </div>
      </div>
    </div>
  );
}
