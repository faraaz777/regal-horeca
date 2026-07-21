'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useDebounce } from '@/hooks/useDebounce';
import Link from 'next/link';
import Image from 'next/image';
import useSWR from 'swr';
import { Plus, Minus, Search, Package, Eye, Pencil, MapPin } from 'lucide-react';
import { adminJson } from '@/lib/client/adminFetch';
import { canWriteInventory, canWriteProducts } from '@/lib/shared/permissions';
import { LOCATION_PATH_SEP } from '@/lib/shared/inventoryConstants';
import StockMovementModal from '@/components/admin/inventory/StockMovementModal';
import MiniBarcode from '@/components/admin/inventory/MiniBarcode';

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

const LOCATION_PREVIEW_COUNT = 2;

/**
 * Rack-first label for the live inventory list.
 * Path like "b1 › f2 › Rack 12" → primary "Rack 12", context "b1 · f2".
 */
function splitLocationDisplay(loc) {
  const path = String(loc?.locationPath || '').trim();
  const full = String(loc?.locationPathFull || path).trim();

  if (!path || path === '—') {
    return {
      primary: 'No assigned location',
      context: '',
      title: full || 'Stock has no valid rack path',
      unassigned: true,
    };
  }

  const parts = path.split(LOCATION_PATH_SEP).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 1) {
    return { primary: parts[0], context: '', title: full, unassigned: false };
  }

  const primary = parts[parts.length - 1];
  const context = parts.slice(0, -1).join(' · ');
  return { primary, context, title: full, unassigned: false };
}

function LocationQtyBadges({ loc, unit }) {
  return (
    <div className="flex flex-wrap gap-1 justify-end shrink-0 max-w-[55%]">
      {loc.sellableQty > 0 && (
        <span className="inline-flex px-1.5 py-px rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-100">
          {loc.sellableQty} Sellable
        </span>
      )}
      {loc.deadStockQty > 0 && (
        <span className="inline-flex px-1 py-px rounded text-[9px] font-semibold bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-300">
          {loc.deadStockQty} Dead stock
        </span>
      )}
      {loc.sellableQty <= 0 && (loc.deadStockQty || 0) <= 0 && (
        <span className="text-[10px] text-gray-500">
          {loc.totalQty} {unit}
        </span>
      )}
    </div>
  );
}

function LocationRow({ loc, unit }) {
  const { primary, context, title, unassigned } = splitLocationDisplay(loc);

  return (
    <li className="flex items-center justify-between gap-3">
      <div className="flex items-start gap-2 min-w-0">
        <MapPin
          size={13}
          className={`mt-1 shrink-0 ${unassigned ? 'text-amber-500' : 'text-emerald-600'}`}
          aria-hidden
        />
        <div className="min-w-0 space-y-1" title={title}>
          <p
            className={`text-xs font-semibold truncate leading-none ${
              unassigned ? 'text-amber-800' : 'text-gray-900'
            }`}
          >
            {primary}
          </p>
          {context ? (
            <p className="text-[11px] text-gray-600 truncate leading-none tracking-wide">
              {context}
            </p>
          ) : null}
        </div>
      </div>
      <LocationQtyBadges loc={loc} unit={unit} />
    </li>
  );
}

function StockLocationsCell({ item }) {
  const [expanded, setExpanded] = useState(false);
  const locations = item.stockLocations || [];
  const unit = item.stockUnit || 'Pcs';

  if (!locations.length) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-400">
        <MapPin size={12} className="shrink-0 text-gray-300" aria-hidden />
        <span>No assigned location</span>
      </div>
    );
  }

  const hiddenCount = locations.length - LOCATION_PREVIEW_COUNT;
  const visible = expanded ? locations : locations.slice(0, LOCATION_PREVIEW_COUNT);

  return (
    <div>
      <ul className="space-y-2">
        {visible.map((loc) => (
          <LocationRow
            key={loc.locationId || loc.locationPath}
            loc={loc}
            unit={unit}
          />
        ))}
      </ul>
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 ml-[18px] text-[11px] font-medium text-emerald-700 hover:text-emerald-900"
        >
          {expanded ? 'Show less' : `+${hiddenCount} more location${hiddenCount === 1 ? '' : 's'}`}
        </button>
      )}
    </div>
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
  const [movementItem, setMovementItem] = useState(null);
  const [movementTab, setMovementTab] = useState('add');
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

  const clearFocusParams = useCallback(() => {
    router.replace('/admin/inventory', { scroll: false });
    setHighlightId('');
  }, [router]);

  const openMovement = useCallback(
    (item, tab = 'add') => {
      if (!canAdjust) return;
      setMovementTab(tab === 'minus' ? 'minus' : 'add');
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
      setMovementTab('add');
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
                <th className="px-4 py-3 w-[28%]">Name</th>
                <th className="px-4 py-3 w-[10%]">SKU</th>
                <th className="px-4 py-3 w-[12%]">Total</th>
                <th className="px-4 py-3 w-[10%]">Status</th>
                <th className="px-4 py-3 w-[26%]">Location & qty</th>
                <th className="px-4 py-3 w-[14%] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {showLoading && items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
                    <p className="mt-2">Loading inventory…</p>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
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
                    <td className="px-4 py-3 align-middle">
                      <div className="min-w-0">
                        <div className="font-mono text-xs text-gray-600 truncate">
                          {item.sku || '—'}
                        </div>
                        {item.barcode ? <MiniBarcode value={item.barcode} /> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="inline-flex items-center gap-1">
                        {canAdjust && (
                          <button
                            type="button"
                            onClick={() => openMovement(item, 'minus')}
                            className="p-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-100"
                            aria-label="Decrease stock"
                            title="Minus stock"
                          >
                            <Minus size={14} />
                          </button>
                        )}
                        <span
                          className="min-w-[2.5rem] text-center font-semibold text-gray-900"
                          title={`Sellable: ${item.sellableQty ?? 0} · Dead stock: ${item.deadStockQty ?? 0}`}
                        >
                          {(item.sellableQty ?? 0) + (item.deadStockQty ?? 0)}
                        </span>
                        {canAdjust && (
                          <button
                            type="button"
                            onClick={() => openMovement(item, 'add')}
                            className="p-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-100"
                            aria-label="Increase stock"
                            title="Add stock"
                          >
                            <Plus size={14} />
                          </button>
                        )}
                      </div>
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
          key={`${movementItem._id}-${movementTab}`}
          item={movementItem}
          initialTab={movementTab}
          onClose={() => {
            setMovementItem(null);
            setMovementTab('add');
            clearFocusParams();
          }}
          onSuccess={() => mutate()}
        />
      )}
    </div>
  );
}
