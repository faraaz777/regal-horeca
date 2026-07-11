'use client';

import { useCallback, useState } from 'react';
import useSWR from 'swr';
import { Search, Loader2 } from 'lucide-react';
import { adminJson } from '@/lib/client/adminFetch';
import { useDebounce } from '@/hooks/useDebounce';

const fetcher = (url) => adminJson(url);

/**
 * Search products and highlight racks that hold them.
 */
export default function LocatorSearchBar({ layoutRacks, onLocateRacks }) {
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query.trim(), 300);

  const searchUrl = debounced ? `/api/admin/inventory/search?q=${encodeURIComponent(debounced)}&limit=20` : null;
  const { data, isLoading } = useSWR(searchUrl, fetcher, { revalidateOnFocus: false });

  const results = data?.results || [];

  const handleSelect = useCallback(
    (product) => {
      const locations = product.stockLocations || [];
      const rackIdsOnFloor = new Set(layoutRacks.map((r) => r._id));
      const matchingRackIds = locations
        .map((loc) => loc.locationId)
        .filter((id) => id && rackIdsOnFloor.has(String(id)));

      if (!matchingRackIds.length) {
        onLocateRacks?.({ rackIds: [], product, message: 'Product not on this floor' });
        return;
      }

      onLocateRacks?.({ rackIds: matchingRackIds.map(String), product, message: null });
      setQuery('');
    },
    [layoutRacks, onLocateRacks]
  );

  return (
    <div className="relative flex-1 max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search product to locate on floor…"
        className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
      />
      {debounced && (
        <div className="absolute z-40 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {isLoading ? (
            <p className="px-3 py-3 text-xs text-gray-500 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Searching…
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-3 text-xs text-gray-500">No products found</p>
          ) : (
            results.map((product) => (
              <button
                key={product._id}
                type="button"
                onClick={() => handleSelect(product)}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0"
              >
                <p className="text-sm font-medium text-gray-900 truncate">{product.title}</p>
                <p className="text-xs text-gray-500 font-mono">{product.sku || '—'}</p>
                {(product.sellableQty ?? 0) > 0 && (
                  <p className="text-[10px] text-emerald-700 mt-0.5">{product.sellableQty} sellable</p>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
