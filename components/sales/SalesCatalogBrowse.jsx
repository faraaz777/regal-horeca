'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { adminJson } from '@/lib/client/adminFetch';
import SalesCatalogProductCard from '@/components/sales/SalesCatalogProductCard';
import SalesCatalogCategoryNav from '@/components/sales/SalesCatalogCategoryNav';
import { SearchIcon } from '@/components/Icons';

const fetcher = (url) => adminJson(url);

function buildCatalogUrl({ q, brands, priceMin, priceMax, stock, category, sort }) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (brands.length) params.set('brands', brands.join(','));
  if (priceMin) params.set('priceMin', String(priceMin));
  if (priceMax) params.set('priceMax', String(priceMax));
  if (stock && stock !== 'all') params.set('stock', stock);
  if (category) params.set('category', category);
  params.set('limit', '24');
  params.set('sort', sort || 'availability');
  const qs = params.toString();
  return `/api/sales/catalog?${qs}`;
}

function FilterSection({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-black/5 pb-4 last:border-b-0">
      <button
        type="button"
        className="w-full flex items-center justify-between text-left min-h-[44px] lg:min-h-0 py-2 lg:py-1"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45">
          {title}
        </span>
        <span className="text-black/30 text-xs">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

function FilterSidebarPanel({ children, onClear, hasActiveFilters, className = '' }) {
  return (
    <div className={`flex flex-col h-full min-h-0 bg-white overflow-hidden ${className}`}>
      <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-black/5">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/50">
          Filters
        </h2>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClear}
            className="text-[10px] uppercase tracking-wider text-black/45 underline hover:text-rich-black min-h-[44px] lg:min-h-0 px-1"
          >
            Clear all
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y px-5 py-4 pb-8 [scrollbar-gutter:stable]">
        {children}
      </div>
    </div>
  );
}

export default function SalesCatalogBrowse({ activeBucket, onAddProduct }) {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [priceMinInput, setPriceMinInput] = useState('');
  const [priceMaxInput, setPriceMaxInput] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [stock, setStock] = useState('all');
  const [category, setCategory] = useState('');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    if (!mobileFiltersOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileFiltersOpen]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPriceMin(priceMinInput.trim());
      setPriceMax(priceMaxInput.trim());
    }, 500);
    return () => clearTimeout(t);
  }, [priceMinInput, priceMaxInput]);

  const facetsUrl = `/api/sales/catalog/facets?q=${encodeURIComponent(search)}`;
  const { data: facetsData } = useSWR(facetsUrl, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  const catalogUrl = useMemo(
    () =>
      buildCatalogUrl({
        q: search,
        brands: selectedBrands,
        priceMin,
        priceMax,
        stock,
        category,
        sort: 'availability',
      }),
    [search, selectedBrands, priceMin, priceMax, stock, category]
  );

  const {
    data: catalogData,
    error: catalogError,
    isLoading: catalogLoading,
  } = useSWR(catalogUrl, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  const facets = facetsData?.facets || { brands: [], priceRange: { min: 0, max: 0 } };
  const catalogItems = catalogData?.items || [];

  const toggleBrand = useCallback((brand) => {
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
    );
  }, []);

  const clearFilters = useCallback(() => {
    setSelectedBrands([]);
    setPriceMinInput('');
    setPriceMaxInput('');
    setPriceMin('');
    setPriceMax('');
    setStock('all');
    setCategory('');
  }, []);

  const hasActiveFilters =
    selectedBrands.length > 0 || priceMin || priceMax || stock !== 'all' || Boolean(category);

  const canAdd = Boolean(activeBucket && activeBucket.status === 'draft');

  const filterBody = (
    <div className="space-y-1">
      <FilterSection title="Availability">
        <div className="space-y-2.5">
          {[
            { value: 'all', label: 'All products' },
            { value: 'in_stock', label: 'In stock' },
            { value: 'out', label: 'Out of stock' },
          ].map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2.5 text-sm text-rich-black/80 cursor-pointer min-h-[44px] lg:min-h-0"
            >
              <input
                type="radio"
                name="stock"
                checked={stock === opt.value}
                onChange={() => setStock(opt.value)}
                className="accent-black"
              />
              {opt.label}
            </label>
          ))}
        </div>
        <p className="text-[11px] text-black/35 mt-2.5">Stock from live inventory ledger</p>
      </FilterSection>

      <SalesCatalogCategoryNav selectedSlug={category} onSelect={setCategory} />

      <FilterSection title="Price (₹)">
        <div className="flex gap-2">
          <input
            type="number"
            min={0}
            placeholder={`Min${facets.priceRange?.min ? ` ${facets.priceRange.min}` : ''}`}
            className="w-full border-b border-black/15 bg-transparent px-0 py-3 lg:py-2 text-base lg:text-sm focus:outline-none focus:border-rich-black"
            value={priceMinInput}
            onChange={(e) => setPriceMinInput(e.target.value)}
          />
          <input
            type="number"
            min={0}
            placeholder={`Max${facets.priceRange?.max ? ` ${facets.priceRange.max}` : ''}`}
            className="w-full border-b border-black/15 bg-transparent px-0 py-3 lg:py-2 text-base lg:text-sm focus:outline-none focus:border-rich-black"
            value={priceMaxInput}
            onChange={(e) => setPriceMaxInput(e.target.value)}
          />
        </div>
      </FilterSection>

      {facets.brands?.length > 0 && (
        <FilterSection title="Brand" defaultOpen={facets.brands.length <= 12}>
          <div className="space-y-2.5">
            {facets.brands.map((b) => (
              <label
                key={b.name}
                className="flex items-center gap-2.5 text-sm text-rich-black/80 cursor-pointer min-h-[44px] lg:min-h-0"
              >
                <input
                  type="checkbox"
                  checked={selectedBrands.includes(b.name)}
                  onChange={() => toggleBrand(b.name)}
                  className="accent-black rounded"
                />
                <span className="truncate flex-1">{b.name}</span>
                <span className="text-xs text-black/30 shrink-0">{b.count}</span>
              </label>
            ))}
          </div>
        </FilterSection>
      )}
    </div>
  );

  return (
    <div className="space-y-5 lg:h-full lg:min-h-0 lg:flex lg:flex-col">
      <div className="flex gap-2 items-center shrink-0">
        <div className="flex-1 flex items-center gap-2.5 rounded-full bg-white border border-black/[0.08] px-4 py-3 lg:py-2.5 shadow-[0_1px_0_rgba(0,0,0,0.03)] focus-within:border-black/20">
          <SearchIcon className="w-5 h-5 text-black/40 shrink-0" />
          <input
            type="search"
            placeholder="Search name, SKU, barcode, tags, colour, category…"
            className="flex-1 min-w-0 bg-transparent text-base lg:text-sm placeholder:text-black/35 focus:outline-none"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {searchInput ? (
            <button
              type="button"
              className="h-9 w-9 lg:h-6 lg:w-6 shrink-0 rounded-full text-black/40 hover:text-rich-black hover:bg-black/5 text-lg lg:text-sm leading-none"
              onClick={() => {
                setSearch('');
                setSearchInput('');
              }}
              aria-label="Clear search"
            >
              ×
            </button>
          ) : null}
        </div>
        <button
          type="button"
          className="lg:hidden inline-flex items-center min-h-[48px] px-4 py-2.5 text-sm font-semibold rounded-full border border-black/15 text-rich-black"
          onClick={() => setMobileFiltersOpen((v) => !v)}
        >
          Filters{hasActiveFilters ? ' ·' : ''}
        </button>
      </div>

      {mobileFiltersOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <button
            type="button"
            aria-label="Close filters"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileFiltersOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[min(100vw,22rem)] flex flex-col bg-white shadow-2xl">
            <FilterSidebarPanel
              hasActiveFilters={hasActiveFilters}
              onClear={clearFilters}
              className="h-full"
            >
              <div className="flex items-center justify-end -mt-1 mb-3 lg:hidden">
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(false)}
                  className="text-sm font-semibold text-black/60 px-3 min-h-[44px]"
                >
                  Done
                </button>
              </div>
              {filterBody}
            </FilterSidebarPanel>
          </div>
        </div>
      )}

      <div className="flex gap-8 items-start lg:flex-1 lg:min-h-0 lg:overflow-hidden">
        <aside className="hidden lg:block w-60 shrink-0 h-full border-r border-black/5">
          <FilterSidebarPanel
            hasActiveFilters={hasActiveFilters}
            onClear={clearFilters}
            className="h-full"
          >
            {filterBody}
          </FilterSidebarPanel>
        </aside>

        <div className="flex-1 min-w-0 space-y-4 lg:h-full lg:overflow-y-auto">
          {hasActiveFilters && (
            <p className="text-[11px] uppercase tracking-wider text-black/40">
              {catalogData?.pagination?.total ?? '…'} products match
            </p>
          )}

          {catalogError && (
            <p className="text-sm text-accent">
              Could not load catalog: {catalogError.message || 'Unknown error'}
            </p>
          )}

          {catalogLoading && !catalogData ? (
            <p className="text-sm text-black/40 py-12 text-center">Loading catalog…</p>
          ) : catalogItems.length === 0 ? (
            <div className="bg-white py-16 text-center">
              <p className="text-black/50 text-sm">
                {search || hasActiveFilters
                  ? 'No products match your search or filters.'
                  : 'No products found in the catalog.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 3xl:grid-cols-3 gap-4">
              {catalogItems.map((p) => (
                <SalesCatalogProductCard
                  key={p.id}
                  product={p}
                  canAdd={canAdd}
                  onAdd={onAddProduct}
                />
              ))}
            </div>
          )}

          {catalogData?.pagination?.total > catalogItems.length && (
            <p className="text-[11px] text-black/40 text-center pt-2">
              Showing {catalogItems.length} of {catalogData.pagination.total}. Refine search to
              narrow results.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
