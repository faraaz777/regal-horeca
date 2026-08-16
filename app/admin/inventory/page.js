'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useDebounce } from '@/hooks/useDebounce';
import Link from 'next/link';
import Image from 'next/image';
import useSWR from 'swr';
import {
  Plus,
  Minus,
  Search,
  Package,
  Eye,
  Pencil,
  MapPin,
  X,
  Filter,
  MoreVertical,
  Barcode,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { adminJson } from '@/lib/client/adminFetch';
import { canWriteInventory } from '@/lib/shared/permissions';
import dynamic from 'next/dynamic';
import { LOCATION_PATH_SEP } from '@/lib/shared/inventoryConstants';
import MiniBarcode from '@/components/admin/inventory/MiniBarcode';

/** Load movement modal only when opened — keeps the inventory list bundle lighter. */
const StockMovementModal = dynamic(
  () => import('@/components/admin/inventory/StockMovementModal'),
  { ssr: false }
);

const STATUS_STYLES = {
  in_stock: 'bg-emerald-100 text-emerald-800',
  low: 'bg-amber-100 text-amber-800',
  out: 'bg-red-100 text-red-800',
};

const STATUS_LABELS = {
  in_stock: 'In Stock',
  low: 'Low',
  out: 'Out',
};

/** Preview up to 4 locations in a 2-column grid; expand for the rest. */
const LOCATION_PREVIEW_COUNT = 4;
const MOBILE_PAGE_SIZE = 20;
const DESKTOP_PAGE_SIZE = 200;

/** Prefer the visible list node when desktop table + mobile cards both mount. */
function bindVisibleRowRef(rowRefs, id, el) {
  if (!el) {
    const existing = rowRefs.current.get(id);
    if (existing && !document.body.contains(existing)) {
      rowRefs.current.delete(id);
    }
    return;
  }
  const visible =
    typeof el.checkVisibility === 'function'
      ? el.checkVisibility()
      : el.getClientRects().length > 0;
  if (visible) {
    rowRefs.current.set(id, el);
  }
}

/** Numbered mobile pagination items, e.g. [1, 2, 3, 'ellipsis', 10]. */
function buildMobilePaginationItems(currentPage, totalPages) {
  if (totalPages <= 1) return [];

  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = new Set([1, totalPages, currentPage]);
  if (currentPage > 1) pages.add(currentPage - 1);
  if (currentPage < totalPages) pages.add(currentPage + 1);
  if (currentPage <= 3) {
    pages.add(2);
    pages.add(3);
  }
  if (currentPage >= totalPages - 2) {
    pages.add(totalPages - 1);
    pages.add(totalPages - 2);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const items = [];
  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      items.push('ellipsis');
    }
    items.push(sorted[i]);
  }
  return items;
}

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

function LocationCard({ loc, unit }) {
  const { primary, context, title, unassigned } = splitLocationDisplay(loc);
  const qty = loc.totalQty || loc.sellableQty || 0;

  return (
    <div className="min-w-0" title={title}>
      <div className="flex items-center gap-1 min-w-0">
        <MapPin
          size={11}
          className={`shrink-0 ${unassigned ? 'text-amber-500' : 'text-emerald-600'}`}
          aria-hidden
        />
        <p
          className={`text-[11px] font-semibold truncate leading-none min-w-0 ${
            unassigned ? 'text-amber-800' : 'text-gray-900'
          }`}
        >
          {primary}
        </p>
        <span className="inline-flex px-1 py-px rounded text-[9px] font-semibold bg-gray-200 text-gray-900 tabular-nums shrink-0 leading-none ring-1 ring-inset ring-gray-300">
          {qty} {unit}
        </span>
      </div>
      {context ? (
        <p className="pl-[15px] mt-px text-[9px] text-gray-500 truncate tracking-wide leading-tight">
          {context}
        </p>
      ) : null}
    </div>
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
    <div className="w-full max-w-[300px]">
      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
        {visible.map((loc) => (
          <LocationCard
            key={loc.locationId || loc.locationPath}
            loc={loc}
            unit={unit}
          />
        ))}
      </div>
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-[10px] font-medium text-emerald-700 hover:text-emerald-900"
        >
          {expanded ? 'Show less' : `Show more (+${hiddenCount})`}
        </button>
      )}
    </div>
  );
}

/** Compact location chips for mobile cards — e.g. "Rack 7 30 Pcs". */
function MobileLocationChips({ item }) {
  const [expanded, setExpanded] = useState(false);
  const locations = item.stockLocations || [];
  const unit = item.stockUnit || 'Pcs';

  if (!locations.length) return null;

  const previewCount = 3;
  const hiddenCount = locations.length - previewCount;
  const visible = expanded ? locations : locations.slice(0, previewCount);

  return (
    <div className="mt-2.5 pt-2 border-t border-gray-100">
      <div className="flex flex-wrap gap-1.5">
        {visible.map((loc) => {
          const { primary, title, unassigned } = splitLocationDisplay(loc);
          const qty = loc.totalQty || loc.sellableQty || 0;
          return (
            <span
              key={loc.locationId || loc.locationPath}
              title={title}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium leading-none ${
                unassigned
                  ? 'bg-amber-50 text-amber-800'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              <span>{primary}</span>
              <span
                className={`font-semibold tabular-nums ${
                  unassigned ? 'text-amber-900' : 'text-emerald-700'
                }`}
              >
                {qty} {unit}
              </span>
            </span>
          );
        })}
      </div>
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 text-[10px] font-medium text-emerald-700"
        >
          {expanded ? 'Show less' : `Show more (+${hiddenCount})`}
        </button>
      )}
    </div>
  );
}

function InventoryMobileCard({
  item,
  canAdjust,
  highlightId,
  menuOpenId,
  setMenuOpenId,
  openMovement,
  rowRefs,
  showBarcodes,
}) {
  const [nameExpanded, setNameExpanded] = useState(false);
  const isDeadStock = item.isDeadStock || item.condition === 'HAS_DEAD_STOCK';
  const isMenuOpen = menuOpenId === String(item._id);
  const isHighlighted = highlightId === String(item._id);

  return (
    <article
      ref={(el) => bindVisibleRowRef(rowRefs, String(item._id), el)}
      className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5 transition-colors ${
        isHighlighted ? 'ring-2 ring-emerald-300 bg-emerald-50/40' : ''
      }`}
    >
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setNameExpanded((v) => !v)}
          className="relative h-[72px] w-[72px] flex-shrink-0 self-start rounded-xl overflow-hidden bg-gray-50 border border-gray-100"
          aria-label={nameExpanded ? 'Collapse product name' : 'Show full product name'}
          aria-expanded={nameExpanded}
        >
          {item.heroImage ? (
            <Image
              src={item.heroImage}
              alt={item.title}
              fill
              sizes="72px"
              unoptimized
              className="object-cover"
              loading="lazy"
              placeholder="blur"
              blurDataURL={blurDataURL}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package size={22} className="text-gray-300" />
            </div>
          )}
        </button>

        <div className="flex-1 min-w-0 flex items-start gap-2">
          <button
            type="button"
            onClick={() => setNameExpanded((v) => !v)}
            className="min-w-0 flex-1 text-left"
            aria-label={nameExpanded ? 'Collapse product name' : 'Show full product name'}
            aria-expanded={nameExpanded}
          >
            <h3
              className={`text-[13px] font-semibold text-gray-900 leading-snug ${
                nameExpanded ? '' : 'line-clamp-2'
              }`}
            >
              {item.title}
            </h3>
            {item.brand ? (
              <p className="text-[11px] text-gray-400 mt-0.5 uppercase tracking-wide truncate">
                {item.brand}
              </p>
            ) : null}
            {isDeadStock ? (
              <span className="inline-flex mt-1.5 items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold leading-tight bg-amber-100 text-amber-800">
                Dead stock
              </span>
            ) : null}
            <div className="mt-1.5 flex items-center gap-1 text-[11px] text-gray-400 min-w-0">
              <Barcode size={12} className="shrink-0" aria-hidden />
              <span className="truncate font-mono">SKU: {item.sku || '—'}</span>
            </div>
          </button>

          <div className="relative shrink-0 flex flex-col items-end gap-2">
            {(canAdjust || item.slug) && (
              <button
                type="button"
                onClick={() =>
                  setMenuOpenId(isMenuOpen ? null : String(item._id))
                }
                className="p-1 -mr-1 text-gray-400 hover:text-gray-600"
                aria-label="More actions"
              >
                <MoreVertical size={16} />
              </button>
            )}

            {isMenuOpen && (canAdjust || item.slug) && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-20 cursor-default"
                  aria-label="Close menu"
                  onClick={() => setMenuOpenId(null)}
                />
                <div className="absolute right-0 top-7 z-30 w-44 bg-white rounded-xl border border-gray-200 shadow-lg py-1">
                  {canAdjust && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpenId(null);
                        openMovement(item);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Pencil size={14} />
                      Stock movement
                    </button>
                  )}
                  {item.slug && (
                    <a
                      href={`/products/${item.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setMenuOpenId(null)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Eye size={14} />
                      View on storefront
                    </a>
                  )}
                </div>
              </>
            )}

            <div className="inline-flex items-center gap-1.5">
              {canAdjust && (
                <button
                  type="button"
                  onClick={() => openMovement(item, 'minus')}
                  className="h-7 w-7 inline-flex items-center justify-center rounded-full border border-gray-200 text-gray-600 bg-white active:bg-gray-50"
                  aria-label="Decrease stock"
                  title="Minus stock"
                >
                  <Minus size={14} />
                </button>
              )}
              <span
                className="min-w-[1.75rem] text-center text-sm font-bold text-gray-900 tabular-nums"
                title={`${item.sellableQty ?? 0} ${item.stockUnit || 'Pcs'} on hand`}
              >
                {item.sellableQty ?? 0}
              </span>
              {canAdjust && (
                <button
                  type="button"
                  onClick={() => openMovement(item, 'add')}
                  className="h-7 w-7 inline-flex items-center justify-center rounded-full border border-gray-200 text-gray-600 bg-white active:bg-gray-50"
                  aria-label="Increase stock"
                  title="Add stock"
                >
                  <Plus size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showBarcodes ? (
        <div className="mt-2.5 pt-2 border-t border-gray-100">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
            Barcode
          </p>
          {item.barcode ? (
            <>
              <MiniBarcode
                value={item.barcode}
                className="block w-full max-w-[220px] h-10"
                height={40}
              />
              <p className="text-xs font-mono text-gray-600 mt-1.5">{item.barcode}</p>
            </>
          ) : (
            <p className="text-xs text-gray-400">No barcode on file</p>
          )}
        </div>
      ) : null}

      <MobileLocationChips item={item} />
    </article>
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
  const canAddToInventory = canWriteInventory(role);

  const [search, setSearch] = useState(initialSearch);
  const debouncedSearch = useDebounce(search.trim(), 300);
  const [brand, setBrand] = useState('');
  const [stockStatus, setStockStatus] = useState('');
  const [condition, setCondition] = useState('');
  const [movementItem, setMovementItem] = useState(null);
  const [movementTab, setMovementTab] = useState('add');
  const [highlightId, setHighlightId] = useState(focusProductId);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showBarcodes, setShowBarcodes] = useState(false);
  const [mobilePage, setMobilePage] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const rowRefs = useRef(new Map());
  const searchInputRef = useRef(null);
  const autoOpenedRef = useRef(false);
  const isSearchPending = search.trim() !== debouncedSearch;

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    setMobilePage(1);
  }, [debouncedSearch, brand, stockStatus, condition]);

  useEffect(() => {
    if (!isMobile) return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [mobilePage, isMobile]);

  const inventoryUrl = useMemo(() => {
    const params = new URLSearchParams({
      page: String(isMobile ? mobilePage : 1),
      limit: String(isMobile ? MOBILE_PAGE_SIZE : DESKTOP_PAGE_SIZE),
    });
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (brand) params.set('brand', brand);
    if (stockStatus) params.set('stockStatus', stockStatus);
    if (condition) params.set('condition', condition);
    return `/api/admin/inventory?${params}`;
  }, [debouncedSearch, brand, stockStatus, condition, isMobile, mobilePage]);

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
  const pagination = data?.pagination || {
    page: isMobile ? mobilePage : 1,
    limit: isMobile ? MOBILE_PAGE_SIZE : DESKTOP_PAGE_SIZE,
    total: totalCount,
    pages: Math.ceil(totalCount / (isMobile ? MOBILE_PAGE_SIZE : DESKTOP_PAGE_SIZE)) || 1,
  };
  const brands = brandsData?.brands || [];
  const hasExtraFilters = Boolean(condition);

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
    <div className="space-y-4 md:space-y-5 pb-24 md:pb-0">
      {/* Desktop page header */}
      <div className="hidden md:block">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Inventory</h1>
            <p className="text-sm text-gray-500 mt-1">
              Live stock ledger · {totalCount} product{totalCount === 1 ? '' : 's'}
            </p>
          </div>
        </div>
      </div>

      {/* Mobile page header — title + barcode toggle */}
      <div className="md:hidden flex items-center justify-between gap-3 px-0.5">
        <div className="w-9" aria-hidden />
        <h1 className="text-lg font-bold text-gray-900 tracking-tight">Inventory</h1>
        <button
          type="button"
          onClick={() => setShowBarcodes((v) => !v)}
          className={`w-9 h-9 inline-flex items-center justify-center rounded-lg transition-colors ${
            showBarcodes
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'text-gray-500 hover:bg-gray-100'
          }`}
          aria-label={showBarcodes ? 'Hide barcodes' : 'Show barcodes'}
          aria-pressed={showBarcodes}
          title={showBarcodes ? 'Hide barcodes' : 'Show barcodes'}
        >
          <Barcode size={20} strokeWidth={1.75} />
        </button>
      </div>

      {/* Filters — desktop panel */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
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
              <option value="HAS_DEAD_STOCK">Dead stock</option>
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

      {/* Filters — mobile search + pill selects */}
      <div className="md:hidden space-y-2.5">
        <div className="relative">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            size={18}
          />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Name, SKU, barcode, HSN, brand, tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-10 py-3 text-sm bg-white border border-gray-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <select
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="w-full appearance-none pl-3 pr-7 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              aria-label="Filter by brand"
            >
              <option value="">All brands</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">
              ▾
            </span>
          </div>

          <div className="relative flex-1 min-w-0">
            <select
              value={stockStatus}
              onChange={(e) => setStockStatus(e.target.value)}
              className="w-full appearance-none pl-3 pr-7 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              aria-label="Filter by stock level"
            >
              <option value="">All stock levels</option>
              <option value="in_stock">In stock</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </select>
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">
              ▾
            </span>
          </div>

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className={`h-9 w-9 inline-flex items-center justify-center rounded-xl border shadow-sm transition-colors ${
                hasExtraFilters || filtersOpen
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-white border-gray-200 text-gray-600'
              }`}
              aria-label="More filters"
              aria-expanded={filtersOpen}
            >
              <Filter size={16} />
            </button>

            {filtersOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-20 cursor-default"
                  aria-label="Close filters"
                  onClick={() => setFiltersOpen(false)}
                />
                <div className="absolute right-0 top-11 z-30 w-56 bg-white rounded-xl border border-gray-200 shadow-lg p-3 space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                      Condition
                    </label>
                    <select
                      value={condition}
                      onChange={(e) => setCondition(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    >
                      <option value="">All conditions</option>
                      <option value="NORMAL">Normal</option>
                      <option value="HAS_DEAD_STOCK">Dead stock</option>
                    </select>
                  </div>
                  <Link
                    href="/admin/inventory/reports"
                    onClick={() => setFiltersOpen(false)}
                    className="block w-full text-center px-3 py-2 text-sm font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg"
                  >
                    Reports
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
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
                    ref={(el) => bindVisibleRowRef(rowRefs, String(item._id), el)}
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
                          {(item.isDeadStock || item.condition === 'HAS_DEAD_STOCK') && (
                            <span className="inline-flex mt-1 items-center gap-1 px-1.5 py-px rounded text-[10px] font-semibold bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-200">
                              ⚠ Dead stock
                            </span>
                          )}
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
                          title={`${item.sellableQty ?? 0} ${item.stockUnit || 'Pcs'} on hand`}
                        >
                          {(item.sellableQty ?? 0)}
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
                    <td className="px-4 py-2 align-middle">
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
          <span className="italic">sellableQty is a live projection of the ledger. Dead stock is a product tag — sales can still sell it.</span>
          <a href="/admin/inventory/movements" className="text-emerald-700 hover:underline not-italic font-medium">
            View movement ledger →
          </a>
        </div>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl">
            {error.message || 'Failed to load inventory'}
          </div>
        )}

        {showLoading && items.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
            <p className="mt-2 text-sm">Loading inventory…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-gray-500 bg-white rounded-2xl border border-gray-100">
            <Package className="mx-auto text-gray-300 mb-2" size={32} />
            <p className="text-sm">No products found</p>
          </div>
        ) : (
          items.map((item) => (
            <InventoryMobileCard
              key={item._id}
              item={item}
              canAdjust={canAdjust}
              highlightId={highlightId}
              menuOpenId={menuOpenId}
              setMenuOpenId={setMenuOpenId}
              openMovement={openMovement}
              rowRefs={rowRefs}
              showBarcodes={showBarcodes}
            />
          ))
        )}

        {pagination.total > pagination.limit && (
          <div className="flex items-center justify-center gap-1 px-2 py-3 bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => setMobilePage((p) => Math.max(1, p - 1))}
              className="shrink-0 p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>

            {buildMobilePaginationItems(pagination.page, pagination.pages).map((item, index) =>
              item === 'ellipsis' ? (
                <span
                  key={`ellipsis-${index}`}
                  className="shrink-0 px-1 text-sm text-gray-400 select-none"
                  aria-hidden
                >
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => setMobilePage(item)}
                  className={`shrink-0 min-w-[2.25rem] h-9 px-2 rounded-lg border text-sm font-medium transition-colors ${
                    pagination.page === item
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                  aria-label={`Page ${item}`}
                  aria-current={pagination.page === item ? 'page' : undefined}
                >
                  {item}
                </button>
              )
            )}

            <button
              type="button"
              disabled={pagination.page >= pagination.pages}
              onClick={() => setMobilePage((p) => p + 1)}
              className="shrink-0 p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        <p className="text-center text-[11px] text-gray-400 pt-1 pb-2">
          Live stock ledger · {totalCount} product{totalCount === 1 ? '' : 's'}
        </p>
        <div className="text-center">
          <a
            href="/admin/inventory/movements"
            className="text-[11px] text-emerald-700 font-medium"
          >
            View movement ledger →
          </a>
        </div>
      </div>

      {/* Mobile FAB — same Add to inventory action as desktop */}
      {canAddToInventory && (
        <Link
          href="/admin/inventory/add"
          className="md:hidden fixed bottom-5 right-5 z-40 h-14 w-14 rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Add to inventory"
          title="Add to inventory"
        >
          <Plus size={26} strokeWidth={2.25} />
        </Link>
      )}

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
