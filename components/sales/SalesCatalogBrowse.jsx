'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { adminJson } from '@/lib/client/adminFetch';
import SalesCatalogProductCard from '@/components/sales/SalesCatalogProductCard';
import SalesCatalogCategoryNav from '@/components/sales/SalesCatalogCategoryNav';

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
    <div className="border-b border-gray-100 pb-3 last:border-b-0">
      <button
        type="button"
        className="w-full flex items-center justify-between text-left text-sm font-semibold text-gray-800 py-1"
        onClick={() => setOpen((v) => !v)}
      >
        {title}
        <span className="text-gray-400 text-xs">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}

function FilterSidebarPanel({ children, onClear, hasActiveFilters, className = '' }) {
  return (
    <div
      className={`flex flex-col h-full min-h-0 bg-white border border-gray-200 rounded-lg overflow-hidden ${className}`}
    >
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/80">
        <h2 className="text-sm font-semibold text-gray-900">Filters</h2>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-gray-600 underline hover:text-gray-900"
          >
            Clear all
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y px-4 py-3 pb-8 [scrollbar-gutter:stable]">
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
        <div className="space-y-2">
          {[
            { value: 'all', label: 'All products' },
            { value: 'in_stock', label: 'In stock' },
            { value: 'out', label: 'Out of stock' },
          ].map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
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
        <p className="text-[11px] text-gray-400 mt-2">Stock from live inventory ledger</p>
      </FilterSection>

      <SalesCatalogCategoryNav selectedSlug={category} onSelect={setCategory} />

      <FilterSection title="Price (₹)">
        <div className="flex gap-2">
          <input
            type="number"
            min={0}
            placeholder={`Min${facets.priceRange?.min ? ` ${facets.priceRange.min}` : ''}`}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
            value={priceMinInput}
            onChange={(e) => setPriceMinInput(e.target.value)}
          />
          <input
            type="number"
            min={0}
            placeholder={`Max${facets.priceRange?.max ? ` ${facets.priceRange.max}` : ''}`}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
            value={priceMaxInput}
            onChange={(e) => setPriceMaxInput(e.target.value)}
          />
        </div>
      </FilterSection>

      {facets.brands?.length > 0 && (
        <FilterSection title="Brand" defaultOpen={facets.brands.length <= 12}>
          <div className="space-y-2">
            {facets.brands.map((b) => (
              <label
                key={b.name}
                className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedBrands.includes(b.name)}
                  onChange={() => toggleBrand(b.name)}
                  className="accent-black rounded"
                />
                <span className="truncate flex-1">{b.name}</span>
                <span className="text-xs text-gray-400 shrink-0">{b.count}</span>
              </label>
            ))}
          </div>
        </FilterSection>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="search"
          placeholder="Search name, SKU, barcode, tags, colour, category…"
          className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        {searchInput && (
          <button
            type="button"
            className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-md"
            onClick={() => {
              setSearch('');
              setSearchInput('');
            }}
          >
            Clear
          </button>
        )}
        <button
          type="button"
          className="lg:hidden px-3 py-2 text-sm border border-gray-300 rounded-md"
          onClick={() => setMobileFiltersOpen((v) => !v)}
        >
          Filters{hasActiveFilters ? ' •' : ''}
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
          <div className="absolute inset-x-0 bottom-0 h-[min(88vh,720px)] flex flex-col rounded-t-2xl shadow-2xl">
            <FilterSidebarPanel
              hasActiveFilters={hasActiveFilters}
              onClear={clearFilters}
              className="h-full rounded-t-2xl rounded-b-none border-b-0"
            >
              <div className="flex items-center justify-end -mt-1 mb-2 lg:hidden">
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(false)}
                  className="text-xs font-medium text-gray-600 px-3 py-1.5 rounded-md border border-gray-200"
                >
                  Done
                </button>
              </div>
              {filterBody}
            </FilterSidebarPanel>
          </div>
        </div>
      )}

      <div className="flex gap-6 items-start">
        <aside className="hidden lg:block w-64 shrink-0 self-start sticky top-6 h-[calc(100vh-3rem)]">
          <FilterSidebarPanel
            hasActiveFilters={hasActiveFilters}
            onClear={clearFilters}
            className="h-full"
          >
            {filterBody}
          </FilterSidebarPanel>
        </aside>

        <div className="flex-1 min-w-0 space-y-3">
          {hasActiveFilters && (
            <p className="text-xs text-gray-500">
              {catalogData?.pagination?.total ?? '…'} products match your filters
            </p>
          )}

          {catalogError && (
            <p className="text-sm text-red-600">
              Could not load catalog: {catalogError.message || 'Unknown error'}
            </p>
          )}

          {catalogLoading && !catalogData ? (
            <p className="text-sm text-gray-500">Loading catalog…</p>
          ) : catalogItems.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
              <p className="text-gray-600 text-sm">
                {search || hasActiveFilters
                  ? 'No products match your search or filters.'
                  : 'No products found in the catalog.'}
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-2 gap-3">
              {catalogItems.map((p) => (
                <SalesCatalogProductCard
                  key={p.id}
                  product={p}
                  canAdd={canAdd}
                  onAdd={() => onAddProduct(p)}
                />
              ))}
            </div>
          )}

          {catalogData?.pagination?.total > catalogItems.length && (
            <p className="text-xs text-gray-500">
              Showing {catalogItems.length} of {catalogData.pagination.total} products. Refine
              search or filters to narrow results.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
