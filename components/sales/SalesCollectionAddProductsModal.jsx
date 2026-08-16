'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { adminJson } from '@/lib/client/adminFetch';
import { useDebounce } from '@/hooks/useDebounce';
import { PlusIcon, SearchIcon, XIcon } from '@/components/Icons';

const fetcher = (url) => adminJson(url);

/**
 * Lightweight catalog picker for a collection.
 * Plus saves immediately (existing items POST). Done only closes — no draft list.
 */
export default function SalesCollectionAddProductsModal({
  collectionId,
  existingProductIds = [],
  onClose,
  onAdded,
}) {
  const [query, setQuery] = useState('');
  const [addingId, setAddingId] = useState(null);
  const [localAdded, setLocalAdded] = useState(() => new Set(existingProductIds));
  const debounced = useDebounce(query.trim(), 300);

  const catalogUrl = `/api/sales/catalog?q=${encodeURIComponent(debounced)}&limit=24`;
  const { data, isLoading } = useSWR(catalogUrl, fetcher, { revalidateOnFocus: false });
  const items = data?.items || [];

  useEffect(() => {
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
  }, [onClose]);

  const handleAdd = async (product) => {
    if (localAdded.has(product.id) || addingId) return;
    setAddingId(product.id);
    try {
      await adminJson(`/api/sales/collections/${collectionId}/items`, {
        method: 'POST',
        body: JSON.stringify({ productId: product.id }),
      });
      setLocalAdded((prev) => {
        const next = new Set(prev);
        next.add(product.id);
        return next;
      });
      onAdded?.(product);
    } catch (e) {
      toast.error(e.message || 'Failed to add product');
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/45"
        onClick={onClose}
      />

      <div
        className="relative bg-white w-full sm:max-w-2xl h-[92dvh] sm:h-[min(88vh,720px)] flex flex-col overflow-hidden shadow-2xl sm:rounded-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="collection-add-products-title"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-black/[0.06] shrink-0">
          <h2 id="collection-add-products-title" className="font-display text-xl font-semibold text-rich-black tracking-tight">
            Add products
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 text-[10px] font-semibold uppercase tracking-[0.14em] bg-rich-black text-white rounded-sm hover:opacity-90"
            >
              Done
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-black/35 hover:text-rich-black"
              aria-label="Close"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-4 py-3 border-b border-black/[0.06] shrink-0">
          <label className="relative block">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/30 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search catalog"
              autoFocus
              className="w-full min-h-[44px] pl-9 pr-3 border border-black/10 bg-warm-white rounded-sm text-sm text-rich-black placeholder:text-black/35 focus:outline-none focus:border-rich-black"
            />
          </label>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-warm-white/40">
          {isLoading ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">Searching…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-black/40">No products match that search.</p>
          ) : (
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {items.map((product) => {
                const added = localAdded.has(product.id);
                return (
                  <li key={product.id} className="border border-black/[0.06] rounded-sm overflow-hidden bg-white">
                    <div className="aspect-square bg-warm-white">
                      {product.heroImage ? (
                        <img
                          src={product.heroImage}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] uppercase tracking-[0.14em] text-black/30">
                          No image
                        </div>
                      )}
                    </div>
                    <div className="flex items-start gap-1 p-2">
                      <p className="flex-1 min-w-0 text-[13px] font-medium text-rich-black line-clamp-2 leading-snug">
                        {product.title}
                      </p>
                      {added ? (
                        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-black/35 pt-1">Added</span>
                      ) : (
                        <button
                          type="button"
                          disabled={addingId === product.id}
                          onClick={() => handleAdd(product)}
                          className="shrink-0 min-w-[44px] min-h-[44px] -mt-1 -mr-1 inline-flex items-center justify-center text-rich-black hover:text-accent disabled:opacity-40"
                          aria-label={`Add ${product.title}`}
                        >
                          <PlusIcon className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
