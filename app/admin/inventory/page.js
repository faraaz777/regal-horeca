'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useDebounce } from '@/hooks/useDebounce';
import Link from 'next/link';
import Image from 'next/image';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { Plus, Minus, Search, Package, Eye, Pencil } from 'lucide-react';
import { adminJson } from '@/lib/client/adminFetch';
import { canWriteInventory, canWriteProducts } from '@/lib/shared/permissions';
import StockMovementModal from '@/components/admin/inventory/StockMovementModal';

const STATUS_STYLES = {
  in_stock: 'bg-emerald-100 text-emerald-800',
  low: 'bg-amber-100 text-amber-800',
  out: 'bg-red-100 text-red-800',
};

const STATUS_LABELS = {
  in_stock: 'In stock',
  low: 'Low',
  out: 'Out',
};

const STOCK_BUCKET_STYLES = {
  dead_stock: 'bg-slate-200 text-slate-800',
};

function StockStatusBadges({ item }) {
  const buckets = [
    {
      key: 'sellable',
      qty: item.sellableQty ?? 0,
      label: 'Sellable',
      style: STATUS_STYLES[item.stockStatus] || STATUS_STYLES.out,
    },
    {
      key: 'dead_stock',
      qty: item.deadStockQty ?? 0,
      label: 'Dead stock',
      style: STOCK_BUCKET_STYLES.dead_stock,
    },
  ].filter((b) => b.qty > 0);

  if (buckets.length === 0) {
    return <span className="text-xs text-gray-400">—</span>;
  }

  return (
    <div className="flex flex-col gap-0.5 items-start">
      {buckets.map((b) => (
        <span
          key={b.key}
          className={`inline-flex px-1.5 py-px rounded-full text-[10px] font-semibold leading-tight ${b.style}`}
        >
          {b.qty} {b.label}
        </span>
      ))}
    </div>
  );
}

function StockLocationsCell({ item }) {
  const locations = item.stockLocations || [];
  const unit = item.stockUnit || 'Pcs';

  if (!locations.length) {
    return <span className="text-xs text-gray-400">—</span>;
  }

  return (
    <ul className="space-y-1.5">
      {locations.map((loc) => (
        <li key={loc.locationId || loc.locationPath} className="text-xs leading-snug">
          <p
            className="font-mono text-gray-700 truncate"
            title={loc.locationPathFull || loc.locationPath}
          >
            {loc.locationPath}
          </p>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {loc.sellableQty > 0 && (
              <span className="inline-flex px-1.5 py-px rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                {loc.sellableQty} Sellable
              </span>
            )}
            {loc.deadStockQty > 0 && (
              <span className="inline-flex px-1.5 py-px rounded-full text-[10px] font-semibold bg-slate-200 text-slate-800">
                {loc.deadStockQty} Dead stock
              </span>
            )}
            {loc.sellableQty <= 0 && (loc.deadStockQty || 0) <= 0 && (
              <span className="text-[10px] text-gray-500">
                {loc.totalQty} {unit}
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

const fetcher = (url) => adminJson(url);

const blurDataURL =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q==';

export default function AdminInventoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusProductId = searchParams.get('productId') || '';
  const initialSearch = searchParams.get('q') || '';
  const openMovementOnLoad = searchParams.get('movement') === '1';

  const { data: meData } = useSWR('/api/auth/me', fetcher, { revalidateOnFocus: false });
  const role = meData?.user?.role;
  const canAdjust = canWriteInventory(role);
  const canAddToInventory = canWriteInventory(role) || canWriteProducts(role);

  const [search, setSearch] = useState(initialSearch);
  const debouncedSearch = useDebounce(search.trim(), 300);
  const [brand, setBrand] = useState('');
  const [stockStatus, setStockStatus] = useState('');
  const [condition, setCondition] = useState('');
  const [adjustingId, setAdjustingId] = useState(null);
  const [movementItem, setMovementItem] = useState(null);
  const [highlightId, setHighlightId] = useState(focusProductId);
  const rowRefs = useRef(new Map());
  const autoOpenedRef = useRef(false);
  const isSearchPending = search.trim() !== debouncedSearch;

  const inventoryUrl = useMemo(() => {
    const params = new URLSearchParams({ page: '1', limit: '200' });
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (brand) params.set('brand', brand);
    if (stockStatus) params.set('stockStatus', stockStatus);
    if (condition) params.set('condition', condition);
    return `/api/admin/inventory?${params}`;
  }, [debouncedSearch, brand, stockStatus, condition]);

  const { data, error, isLoading, isValidating, mutate } = useSWR(inventoryUrl, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
    keepPreviousData: true,
  });

  const showLoading = isLoading || isValidating || isSearchPending;

  const { data: brandsData } = useSWR('/api/admin/inventory/brands', fetcher, {
    revalidateOnFocus: false,
  });

  const items = data?.items || [];
  const totalCount = data?.pagination?.total ?? items.length;
  const brands = brandsData?.brands || [];

  const handleAdjust = useCallback(
    async (productId, delta) => {
      if (!canAdjust) return;
      setAdjustingId(productId);
      try {
        await adminJson('/api/admin/inventory/adjust', {
          method: 'POST',
          body: JSON.stringify({ productId, delta }),
        });
        toast.success(delta > 0 ? 'Stock added' : 'Stock reduced');
        mutate();
      } catch (err) {
        toast.error(err.message || 'Adjustment failed');
      } finally {
        setAdjustingId(null);
      }
    },
    [canAdjust, mutate]
  );

  const clearFocusParams = useCallback(() => {
    router.replace('/admin/inventory', { scroll: false });
    setHighlightId('');
  }, [router]);

  const openMovement = useCallback(
    (item) => {
      if (!canAdjust) return;
      setMovementItem(item);
      setHighlightId(String(item._id));
    },
    [canAdjust]
  );

  useEffect(() => {
    if (!focusProductId || showLoading || autoOpenedRef.current) return;

    const match = items.find((item) => String(item._id) === focusProductId);
    if (!match) return;

    setHighlightId(focusProductId);
    const row = rowRefs.current.get(focusProductId);
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    if (openMovementOnLoad && canAdjust) {
      autoOpenedRef.current = true;
      setMovementItem(match);
      router.replace('/admin/inventory', { scroll: false });
    }
  }, [
    focusProductId,
    openMovementOnLoad,
    items,
    showLoading,
    canAdjust,
    router,
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">
            Live stock ledger · {totalCount} product{totalCount === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Name, SKU, barcode, HSN, brand, tags…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
            </div>
            <select
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 min-w-[140px]"
            >
              <option value="">All brands</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <select
              value={stockStatus}
              onChange={(e) => setStockStatus(e.target.value)}
              className="px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 min-w-[140px]"
            >
              <option value="">All stock levels</option>
              <option value="in_stock">In stock</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </select>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 min-w-[130px]"
            >
              <option value="">All conditions</option>
              <option value="NORMAL">Normal</option>
              <option value="HAS_DEAD_STOCK">Has dead stock</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/inventory/reports"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              Reports
            </Link>
            {canAddToInventory && (
              <Link
                href="/admin/inventory/add"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <Plus size={18} />
                Add to inventory
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {error && (
          <div className="p-4 text-sm text-red-600 bg-red-50 border-b border-red-100">
            {error.message || 'Failed to load inventory'}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 w-[26%]">Name</th>
                <th className="px-4 py-3 w-[9%]">SKU</th>
                <th className="px-4 py-3 w-[11%]">Sellable</th>
                <th className="px-4 py-3 w-[12%]">Stock status</th>
                <th className="px-4 py-3 w-[8%]">Status</th>
                <th className="px-4 py-3 w-[22%]">Location & qty</th>
                <th className="px-4 py-3 w-[12%] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {showLoading && items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
                    <p className="mt-2">Loading inventory…</p>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    <Package className="mx-auto text-gray-300 mb-2" size={32} />
                    No products found
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item._id}
                    ref={(el) => {
                      if (el) rowRefs.current.set(String(item._id), el);
                    }}
                    className={`hover:bg-gray-50/80 transition-colors ${
                      highlightId === String(item._id)
                        ? 'bg-emerald-50/80 ring-1 ring-inset ring-emerald-200'
                        : ''
                    }`}
                  >
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative h-14 w-14 flex-shrink-0">
                          {item.heroImage ? (
                            <Image
                              src={item.heroImage}
                              alt={item.title}
                              fill
                              sizes="56px"
                              unoptimized
                              className="rounded-md object-cover"
                              loading="lazy"
                              placeholder="blur"
                              blurDataURL={blurDataURL}
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-md bg-gray-100 border border-dashed border-gray-300" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 truncate">{item.title}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {item.brand}
                            {item.categoryName ? ` · ${item.categoryName}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle font-mono text-xs text-gray-600 truncate">
                      {item.sku || '—'}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="inline-flex items-center gap-1">
                        {canAdjust && (
                          <button
                            type="button"
                            disabled={adjustingId === item._id}
                            onClick={() => handleAdjust(item._id, -1)}
                            className="p-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                            aria-label="Decrease stock"
                          >
                            <Minus size={14} />
                          </button>
                        )}
                        <span className="min-w-[2.5rem] text-center font-semibold text-gray-900">
                          {item.sellableQty}
                        </span>
                        {canAdjust && (
                          <button
                            type="button"
                            disabled={adjustingId === item._id}
                            onClick={() => handleAdjust(item._id, 1)}
                            className="p-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                            aria-label="Increase stock"
                          >
                            <Plus size={14} />
                          </button>
                        )}
                        <span className="text-xs text-gray-400 ml-1">{item.stockUnit}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <StockStatusBadges item={item} />
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <span
                        className={`inline-flex px-1.5 py-px rounded-full text-[10px] font-semibold leading-tight capitalize ${
                          STATUS_STYLES[item.stockStatus] || STATUS_STYLES.out
                        }`}
                      >
                        {STATUS_LABELS[item.stockStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <StockLocationsCell item={item} />
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center justify-end gap-1">
                        {canAdjust && (
                          <button
                            type="button"
                            onClick={() => openMovement(item)}
                            className="p-1.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-100"
                            title="Stock movement"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        {item.slug && (
                          <a
                            href={`/products/${item.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-100"
                            title="View on storefront"
                          >
                            <Eye size={14} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-500 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="italic">Sellable qty is a live projection of the ledger.</span>
          <a href="/admin/inventory/movements" className="text-emerald-700 hover:underline not-italic font-medium">
            View movement ledger →
          </a>
        </div>
      </div>

      {movementItem && (
        <StockMovementModal
          item={movementItem}
          onClose={() => {
            setMovementItem(null);
            clearFocusParams();
          }}
          onSuccess={() => mutate()}
        />
      )}
    </div>
  );
}
