'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { X, ExternalLink, Loader2 } from 'lucide-react';
import { adminJson } from '@/lib/client/adminFetch';
import { getRackStatusStyle } from '@/lib/client/locatorUtils';
import { STATUS_BUCKET_LABELS } from '@/lib/shared/inventoryConstants';

const fetcher = (url) => adminJson(url);

/**
 * Locator rack detail — stock at rack only.
 * Capacity / fill-% UI removed (no artificial rack fullness).
 */
export default function RackDetailDrawer({ rackId, onClose }) {
  const { data, isLoading, error } = useSWR(
    rackId ? `/api/admin/inventory/locations/${rackId}/locator-detail` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const rack = data?.rack;
  const items = data?.items || [];
  const statusStyle = rack ? getRackStatusStyle(rack.stockStatus) : null;

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
                    <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">
                      Location
                    </p>
                    <p className="text-sm font-mono text-gray-900 mt-1 truncate">
                      {rack.displayPath}
                    </p>
                    <p className="text-xs text-gray-500 font-mono mt-0.5 truncate">
                      {rack.displayPathShort}
                    </p>
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
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">
                  SKUs at rack ({items.length})
                </p>
                {items.length === 0 ? (
                  <p className="text-sm text-gray-400">No stock at this rack</p>
                ) : (
                  <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                    {items.map((item) => (
                      <li
                        key={`${item.productId}-${item.statusBucket}`}
                        className="px-3 py-2 text-sm"
                      >
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
