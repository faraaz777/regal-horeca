'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { X, ExternalLink, Loader2, Save } from 'lucide-react';
import { adminJson } from '@/lib/client/adminFetch';
import { getRackStatusStyle } from '@/lib/client/locatorUtils';
import { STATUS_BUCKET_LABELS } from '@/lib/shared/inventoryConstants';

const fetcher = (url) => adminJson(url);

export default function RackDetailDrawer({ rackId, canEdit = false, onClose, onCapacitySaved }) {
  const { data, isLoading, error, mutate } = useSWR(
    rackId ? `/api/admin/inventory/locations/${rackId}/locator-detail` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const rack = data?.rack;
  const items = data?.items || [];
  const statusStyle = rack ? getRackStatusStyle(rack.stockStatus) : null;

  const [capacityInput, setCapacityInput] = useState('');
  const [savingCapacity, setSavingCapacity] = useState(false);

  useEffect(() => {
    setCapacityInput(rack?.capacity != null ? String(rack.capacity) : '');
  }, [rack?.capacity, rackId]);

  const handleSaveCapacity = async () => {
    setSavingCapacity(true);
    try {
      await adminJson(`/api/admin/inventory/locations/${rackId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          capacity: capacityInput === '' ? null : Number(capacityInput),
        }),
      });
      toast.success('Capacity saved');
      await mutate();
      onCapacitySaved?.();
    } catch (err) {
      toast.error(err.message || 'Failed to save capacity');
    } finally {
      setSavingCapacity(false);
    }
  };

  const fillPctLabel =
    rack?.fillPct != null ? `${Math.round(rack.fillPct * 100)}% full` : null;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} aria-hidden />
      <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Rack detail</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading && (
            <p className="text-sm text-gray-500 flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" /> Loading…
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error.message}</p>}

          {rack && (
            <>
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Location</p>
                    <p className="text-sm font-mono text-gray-900 mt-1 truncate">{rack.displayPath}</p>
                    <p className="text-xs text-gray-500 font-mono mt-0.5 truncate">{rack.displayPathShort}</p>
                  </div>
                  {statusStyle && (
                    <span
                      className={`shrink-0 inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusStyle.fill} ${statusStyle.text}`}
                    >
                      {statusStyle.label}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 text-xs mt-2">
                  <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                    {rack.sellableQty} Sellable
                  </span>
                  {rack.deadStockQty > 0 && (
                    <span className="px-2 py-1 rounded-full bg-slate-200 text-slate-800 font-semibold">
                      {rack.deadStockQty} Dead stock
                    </span>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">
                    Capacity {fillPctLabel && <span className="text-gray-400 normal-case">· {fillPctLabel}</span>}
                  </p>
                  {!canEdit && (
                    <span className="text-xs text-gray-700">
                      {rack.capacity != null ? `${rack.totalQty} / ${rack.capacity} units` : 'Not set'}
                    </span>
                  )}
                </div>
                {rack.capacity != null && (
                  <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-500"
                      style={{ width: `${Math.min(100, Math.round((rack.fillPct || 0) * 100))}%` }}
                    />
                  </div>
                )}
                {canEdit && (
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="number"
                      min="0"
                      value={capacityInput}
                      onChange={(e) => setCapacityInput(e.target.value)}
                      placeholder="Max units"
                      className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    />
                    <button
                      type="button"
                      onClick={handleSaveCapacity}
                      disabled={savingCapacity}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {savingCapacity ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Save
                    </button>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">
                  SKUs at rack ({items.length})
                </p>
                {items.length === 0 ? (
                  <p className="text-sm text-gray-400">No stock at this rack</p>
                ) : (
                  <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                    {items.map((item) => (
                      <li key={`${item.productId}-${item.statusBucket}`} className="px-3 py-2 text-sm">
                        <p className="font-medium text-gray-900 truncate">{item.title}</p>
                        <p className="text-xs text-gray-500 font-mono">{item.sku || '—'}</p>
                        <p className="text-xs mt-0.5">
                          {item.qty} {item.stockUnit} ·{' '}
                          {STATUS_BUCKET_LABELS[item.statusBucket] || item.statusBucket}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <Link
                href={`/admin/inventory/movements?locationId=${rack._id}`}
                className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:underline"
              >
                View movements for this rack
                <ExternalLink size={14} />
              </Link>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
