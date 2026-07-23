'use client';

import { useCallback, useEffect, useState } from 'react';
import useSWR from 'swr';
import { Search, Loader2, Package, X } from 'lucide-react';
import { adminJson } from '@/lib/client/adminFetch';
import { useDebounce } from '@/hooks/useDebounce';

const fetcher = (url) => adminJson(url);

/**
 * View-mode product find sidebar.
 * Search is floor-scoped via Stock — click a row to highlight racks on the map.
 */
export default function LocatorFindSidebar({
  floorId,
  selectedProductId,
  onSelectProduct,
  onClear,
}) {
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query.trim(), 300);

  const searchUrl =
    floorId && debounced
      ? `/api/admin/inventory/locations/${floorId}/locate?q=${encodeURIComponent(debounced)}&limit=30`
      : null;

  const { data, isLoading } = useSWR(searchUrl, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  const results = data?.results || [];

  useEffect(() => {
    setQuery('');
    onClear?.();
  }, [floorId]); // eslint-disable-line react-hooks/exhaustive-deps -- reset find UI when floor changes

  const handlePick = useCallback(
    (row) => {
      onSelectProduct?.(row);
    },
    [onSelectProduct]
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Find product
          </h3>
          {(selectedProductId || query) && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                onClear?.();
              }}
              className="text-[10px] font-semibold text-sky-700 hover:underline inline-flex items-center gap-0.5"
            >
              <X size={12} />
              Clear
            </button>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search on this floor…"
            disabled={!floorId}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30 disabled:bg-gray-50"
          />
        </div>
        {!floorId && (
          <p className="text-[11px] text-gray-400">Select a floor to search.</p>
        )}
      </div>

      <div className="mt-3 flex-1 min-h-0 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
        {!debounced && floorId ? (
          <p className="px-3 py-6 text-xs text-gray-400 text-center">
            Type a product name or SKU to find racks on this floor.
          </p>
        ) : null}

        {debounced && isLoading && results.length === 0 ? (
          <p className="px-3 py-4 text-xs text-gray-500 flex items-center justify-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Searching…
          </p>
        ) : null}

        {debounced && !isLoading && results.length === 0 ? (
          <p className="px-3 py-6 text-xs text-gray-400 text-center">
            No stock on this floor matches “{debounced}”.
          </p>
        ) : null}

        {results.map((row) => {
          const active = selectedProductId === row.productId;
          return (
            <button
              key={row.productId}
              type="button"
              onClick={() => handlePick(row)}
              className={`w-full text-left px-3 py-2.5 transition-colors flex items-center gap-2.5 ${
                active ? 'bg-sky-50' : 'hover:bg-gray-50'
              }`}
            >
              <div className="h-9 w-9 shrink-0 rounded-md overflow-hidden bg-gray-100 border border-gray-200">
                {row.heroImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.heroImage} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-gray-300">
                    <Package size={16} />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-medium truncate ${
                    active ? 'text-sky-800' : 'text-gray-900'
                  }`}
                >
                  {row.title}
                </p>
                <p className="text-[11px] text-gray-500 font-mono truncate">
                  {row.sku || '—'}
                </p>
                <p className="text-[11px] text-gray-600 mt-0.5">
                  {row.rackCount} rack{row.rackCount === 1 ? '' : 's'}
                  {' · '}
                  {Number(row.totalQty || 0).toLocaleString()} pcs
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
