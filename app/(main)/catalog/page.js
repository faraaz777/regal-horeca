/**
 * Catalog Page
 * 
 * Product catalog with advanced filtering, search, and category navigation.
 * Features:
 * - Context-aware faceted navigation
 * - URL state management for all filters
 * - Backend facets API integration
 * - Filter counts and disabled states
 * - Active filter chips
 * - Pagination support
 */

'use client';

import { useState, useMemo, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import ProductCard from '@/components/ProductCard';
import ProductCardSkeleton from '@/components/ProductCardSkeleton';
import { useAppContext } from '@/context/AppContext';
import { PlusIcon, MinusIcon, FilterIcon, XIcon, ChevronLeftIcon } from '@/components/Icons';
import '@/components/new/SidebarFilter.css';

const ITEMS_PER_PAGE = 24;

// Fetcher for SWR
const fetcher = (url) => fetch(url).then(res => res.json());

function CatalogPageContent() {
  const { categories } = useAppContext();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [openFilterSections, setOpenFilterSections] = useState({
    price: true,
    color: true,
    brand: true,
  });

  // Get all filters from URL (server-side filtering)
  const selectedCategorySlug = searchParams.get('category') || '';
  const selectedBusinessSlug = searchParams.get('business') || '';
  const searchQuery = searchParams.get('search') || '';
  const priceMin = searchParams.get('priceMin') || '';
  const priceMax = searchParams.get('priceMax') || '';
  const colorsParam = searchParams.get('colors') || '';
  const brandsParam = searchParams.get('brands') || '';
  const filtersParam = searchParams.get('filters') || '';
  const sortBy = searchParams.get('sortBy') || 'newest';

  // Parse filter arrays
  const selectedColors = useMemo(() => 
    colorsParam ? colorsParam.split(',').filter(Boolean) : [], 
    [colorsParam]
  );
  const selectedBrands = useMemo(() => 
    brandsParam ? brandsParam.split(',').filter(Boolean) : [], 
    [brandsParam]
  );
  const selectedFilters = useMemo(() => {
    if (!filtersParam) return {};
    try {
      const parsed = JSON.parse(decodeURIComponent(filtersParam));
      return typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }, [filtersParam]);

  // Build API params with ALL filters for server-side filtering
  const productsParams = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedCategorySlug) params.set('category', selectedCategorySlug);
    if (selectedBusinessSlug) params.set('business', selectedBusinessSlug);
    if (searchQuery) params.set('search', searchQuery);
    if (priceMin) params.set('priceMin', priceMin);
    if (priceMax) params.set('priceMax', priceMax);
    if (selectedColors.length > 0) params.set('colors', selectedColors.join(','));
    if (selectedBrands.length > 0) params.set('brands', selectedBrands.join(','));
    if (Object.keys(selectedFilters).length > 0) {
      params.set('filters', encodeURIComponent(JSON.stringify(selectedFilters)));
    }
    if (sortBy && sortBy !== 'newest') params.set('sortBy', sortBy);
    params.set('page', String(currentPage));
    params.set('limit', String(ITEMS_PER_PAGE));
    return params;
  }, [selectedCategorySlug, selectedBusinessSlug, searchQuery, priceMin, priceMax, selectedColors, selectedBrands, selectedFilters, sortBy, currentPage]);

  // Fetch products from API with server-side filtering and pagination
  const { data: productsData, isLoading: productsLoading } = useSWR(
    `/api/products?${productsParams.toString()}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // Cache for 1 minute
    }
  );

  const products = productsData?.products || [];
  const pagination = productsData?.pagination || { total: 0, page: 1, totalPages: 1 };
  const contextLoading = productsLoading;

  // Filter handlers - only update URL, no client-side filtering
  const handlePriceMinChange = useCallback((value) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set('priceMin', value);
    else params.delete('priceMin');
    router.push(`/catalog?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  const handlePriceMaxChange = useCallback((value) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set('priceMax', value);
    else params.delete('priceMax');
    router.push(`/catalog?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  const handleColorToggle = useCallback((color) => {
    const params = new URLSearchParams(searchParams.toString());
    const newColors = selectedColors.includes(color)
      ? selectedColors.filter(c => c !== color)
      : [...selectedColors, color];
    if (newColors.length > 0) params.set('colors', newColors.join(','));
    else params.delete('colors');
    router.push(`/catalog?${params.toString()}`, { scroll: false });
  }, [selectedColors, searchParams, router]);

  const handleBrandToggle = useCallback((brand) => {
    const params = new URLSearchParams(searchParams.toString());
    const newBrands = selectedBrands.includes(brand)
      ? selectedBrands.filter(b => b !== brand)
      : [...selectedBrands, brand];
    if (newBrands.length > 0) params.set('brands', newBrands.join(','));
    else params.delete('brands');
    router.push(`/catalog?${params.toString()}`, { scroll: false });
  }, [selectedBrands, searchParams, router]);

  const handleFilterToggle = useCallback((filterKey, value) => {
    const params = new URLSearchParams(searchParams.toString());
    const current = selectedFilters[filterKey] || [];
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    const newFilters = { ...selectedFilters, [filterKey]: updated };
    // Remove empty arrays
    Object.keys(newFilters).forEach(key => {
      if (newFilters[key].length === 0) {
        delete newFilters[key];
      }
    });
    if (Object.keys(newFilters).length > 0) {
      params.set('filters', encodeURIComponent(JSON.stringify(newFilters)));
    } else {
      params.delete('filters');
    }
    router.push(`/catalog?${params.toString()}`, { scroll: false });
  }, [selectedFilters, searchParams, router]);

  const handleSortChange = useCallback((newSort) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newSort && newSort !== 'newest') params.set('sortBy', newSort);
    else params.delete('sortBy');
    router.push(`/catalog?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  const clearAllFilters = useCallback(() => {
    const params = new URLSearchParams();
    if (selectedCategorySlug) params.set('category', selectedCategorySlug);
    if (selectedBusinessSlug) params.set('business', selectedBusinessSlug);
    if (searchQuery) params.set('search', searchQuery);
    router.push(`/catalog?${params.toString()}`, { scroll: false });
  }, [selectedCategorySlug, selectedBusinessSlug, searchQuery, router]);

  const hasActiveFilters = useMemo(() => {
    return !!(
      priceMin ||
      priceMax ||
      selectedColors.length > 0 ||
      selectedBrands.length > 0 ||
      Object.keys(selectedFilters).length > 0
    );
  }, [priceMin, priceMax, selectedColors, selectedBrands, selectedFilters]);

  // Price range for display
  const priceRange = useMemo(() => ({
    min: priceMin,
    max: priceMax,
    minValue: priceMin,
    maxValue: priceMax,
  }), [priceMin, priceMax]);

  // Fetch facets from backend API
  const facetsParams = new URLSearchParams();
  if (selectedCategorySlug) facetsParams.set('category', selectedCategorySlug);
  if (selectedBusinessSlug) facetsParams.set('business', selectedBusinessSlug);
  if (searchQuery) facetsParams.set('search', searchQuery);

  const { data: facetsData, isLoading: facetsLoading } = useSWR(
    `/api/products/facets?${facetsParams.toString()}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // Cache for 1 minute
    }
  );

  const facets = facetsData?.facets || {
    colors: [],
    brands: [],
    filters: {},
    // specs removed - specifications are for product detail page only, not sidebar
    // statuses removed - not needed in sidebar
    priceRange: { min: 0, max: 0 },
    totalProducts: 0,
  };

  // Category navigation
  const { currentCategory, parentCategory, displayCategories } = useMemo(() => {
    const findCategoryBySlug = (slug) => slug ? categories.find(c => c.slug === slug) : undefined;

    const current = findCategoryBySlug(selectedCategorySlug);
    const parent = current?.parent ? categories.find(p => {
      const pId = p._id || p.id;
      const currentParent = current.parent?._id || current.parent;
      return pId === currentParent;
    }) : null;

    const children = current
      ? categories.filter(c => {
        const cParent = c.parent?._id || c.parent;
        const currentId = current._id || current.id;
        return cParent === currentId;
      })
      : categories.filter(c => {
        const cParent = c.parent?._id || c.parent;
        return cParent === null;
      });

    return {
      currentCategory: current,
      parentCategory: parent,
      displayCategories: children,
    };
  }, [selectedCategorySlug, categories]);

  const currentCategoryName = searchQuery
    ? `Search: "${searchQuery}"`
    : (currentCategory?.name || 'All Products');

  // Server-side pagination - get from API response
  const totalPages = pagination.totalPages || 1;
  const totalProducts = pagination.total || 0;
  const paginatedProducts = products; // Products are already paginated from API

  // Reset page to 1 when filters change (but keep current page if just changing page)
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategorySlug, selectedBusinessSlug, searchQuery, selectedColors, selectedBrands, selectedFilters, priceMin, priceMax, sortBy]);

  // Update currentPage when URL page param changes
  useEffect(() => {
    const pageParam = searchParams.get('page');
    if (pageParam) {
      const pageNum = parseInt(pageParam);
      if (!isNaN(pageNum) && pageNum > 0) {
        setCurrentPage(pageNum);
      }
    } else {
      setCurrentPage(1);
    }
  }, [searchParams]);

  // Page change handler - updates URL
  const handlePageChange = useCallback((newPage) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newPage > 1) {
      params.set('page', String(newPage));
    } else {
      params.delete('page');
    }
    router.push(`/catalog?${params.toString()}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [searchParams, router]);

  // Close mobile filter on route change
  useEffect(() => {
    setIsFilterOpen(false);
  }, [selectedCategorySlug, selectedBusinessSlug, searchQuery]);

  // Initialize filter sections dynamically
  useEffect(() => {
    if (facets.filters && Object.keys(facets.filters).length > 0) {
      setOpenFilterSections(prev => {
        const newSections = { ...prev };
        Object.keys(facets.filters).forEach(key => {
          const sectionId = key.toLowerCase().replace(/\s+/g, '-');
          if (newSections[sectionId] === undefined) {
            newSections[sectionId] = true;
          }
        });
        return newSections;
      });
    }
    // NOTE: specs removed - they are for product detail page only
  }, [facets.filters]);

  const toggleFilterSection = (section) => {
    setOpenFilterSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Calculate filter counts from facets API (server-side calculated)
  const getFilterCount = useCallback((filterType, value) => {
    // Filter counts come from facets API which calculates them server-side
    // This is just a fallback - facets should provide the counts
    if (filterType === 'color') {
      const colorFacet = facets.colors?.find(c => c === value);
      return colorFacet ? 1 : 0; // Facets API should provide counts
    }
    if (filterType === 'brand') {
      const brandFacet = facets.brands?.find(b => b === value);
      return brandFacet ? 1 : 0; // Facets API should provide counts
    }
    return 0;
  }, [facets]);

  // Filter Section Component
  const FilterSection = ({ title, id, children, count }) => {
    const isOpen = openFilterSections[id] !== false;
    const hasItems = count !== undefined ? count > 0 : true;

    if (!hasItems) return null;

    return (
      <div className="filter-section">
        <button
          onClick={() => toggleFilterSection(id)}
          className="w-full flex justify-between items-center group"
        >
          <h3 className="filter-section-title group-hover:text-accent transition-colors">
            {title}
            {count !== undefined && count > 0 && (
              <span className="ml-2 text-[10px] font-medium text-black/30 bg-black/5 px-1.5 py-0.5 rounded-full">
                {count}
              </span>
            )}
          </h3>
          <div className="text-black/50 group-hover:text-accent transition-colors">
            {isOpen ? <MinusIcon className="w-3.5 h-3.5" /> : <PlusIcon className="w-3.5 h-3.5" />}
          </div>
        </button>
        {isOpen && (
          <div className="pt-4">
            {children}
          </div>
        )}
      </div>
    );
  };

  // Active Filter Chips Component
  const ActiveFiltersChips = () => {
    if (!hasActiveFilters) return null;

    const chips = [];

    if (priceRange.minValue || priceRange.maxValue) {
      chips.push({
        label: `Price: ${priceRange.minValue || '0'} - ${priceRange.maxValue || '∞'}`,
        onRemove: () => {
          handlePriceMinChange('');
          handlePriceMaxChange('');
        }
      });
    }

    selectedColors.forEach(color => {
      chips.push({
        label: `Color: ${color}`,
        onRemove: () => handleColorToggle(color)
      });
    });

    selectedBrands.forEach(brand => {
      chips.push({
        label: `Brand: ${brand}`,
        onRemove: () => handleBrandToggle(brand)
      });
    });

    // Status chips removed - not in sidebar

    Object.entries(selectedFilters).forEach(([key, values]) => {
      values.forEach(value => {
        chips.push({
          label: `${key}: ${value}`,
          onRemove: () => handleFilterToggle(key, value)
        });
      });
    });

    // NOTE: specs removed from chips - they are for product detail page only

    if (chips.length === 0) return null;

    return (
      <div className="mb-6 flex flex-wrap gap-2.5 items-center">
        <span className="text-[10px] font-bold uppercase tracking-widest text-black/40">Filters:</span>
        {chips.map((chip, index) => (
          <button
            key={index}
            onClick={chip.onRemove}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium bg-black/[0.03] hover:bg-black/[0.06] border border-black/5 rounded-full transition-all group"
          >
            <span className="text-black/70 group-hover:text-black">{chip.label}</span>
            <XIcon className="w-3 h-3 text-black/20 group-hover:text-accent transition-colors" />
          </button>
        ))}
        <button
          onClick={clearAllFilters}
          className="px-2 py-1 text-[10px] uppercase tracking-widest text-accent hover:text-black font-bold transition-colors ml-1"
        >
          Clear All
        </button>
      </div>
    );
  };

  // Filter Sidebar Component
  const FilterSidebar = () => (
    <aside className="sidebar-container">
      <div className="flex justify-between items-center mb-6 lg:hidden">
        <h2 className="text-xl font-bold tracking-tight">Filters</h2>
        <button
          onClick={() => setIsFilterOpen(false)}
          className="p-2 hover:bg-black/5 rounded-full transition-colors"
        >
          <XIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Categories */}
      <div className="category-section first:pt-0">
        <div className="flex justify-between items-center mb-4">
          <h3 className="filter-section-title">Categories</h3>
          {(selectedCategorySlug || hasActiveFilters) && (
            <button
              onClick={() => {
                clearAllFilters();
                window.location.href = '/catalog';
              }}
              className="text-[10px] uppercase tracking-wider text-accent hover:text-black transition-colors font-bold"
            >
              Reset
            </button>
          )}
        </div>
        <ul className="category-list">
          {parentCategory ? (
            <li>
              <Link
                href={`/catalog?category=${parentCategory.slug}`}
                className="category-link opacity-40 hover:opacity-100"
              >
                <ChevronLeftIcon className="w-4 h-4 mr-1" />
                {parentCategory.name}
              </Link>
            </li>
          ) : selectedCategorySlug && (
            <li>
              <Link
                href="/catalog"
                className="category-link opacity-40 hover:opacity-100"
              >
                <ChevronLeftIcon className="w-4 h-4 mr-1" />
                All Products
              </Link>
            </li>
          )}
          {displayCategories.map(cat => (
            <li key={cat._id || cat.id}>
              <Link
                href={`/catalog?category=${cat.slug}`}
                className={`category-link ${selectedCategorySlug === cat.slug ? 'active' : ''}`}
              >
                {cat.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Price Range */}
      <FilterSection
        title="Price"
        id="price"
        count={facets.priceRange.min !== facets.priceRange.max ? undefined : 0}
      >
        <div className="space-y-4">
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-black/40">
            <span>Min</span>
            <span>Max</span>
          </div>
          <div className="price-input-group">
            <input
              type="number"
              placeholder={facets.priceRange.min}
              value={priceRange.min}
              onChange={e => handlePriceMinChange(e.target.value)}
              className="price-field"
            />
            <div className="price-divider" />
            <input
              type="number"
              placeholder={facets.priceRange.max}
              value={priceRange.max}
              onChange={e => handlePriceMaxChange(e.target.value)}
              className="price-field"
            />
          </div>
        </div>
      </FilterSection>

      {/* Brand Filter */}
      {facets.brands && facets.brands.length > 0 && (
        <FilterSection title="Brand" id="brand" count={facets.brands.length}>
          <div className="space-y-1 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
            {facets.brands.map(brand => {
              const count = getFilterCount('brand', brand);
              const isSelected = selectedBrands.includes(brand);
              const isDisabled = count === 0 && !isSelected;

              return (
                <label
                  key={brand}
                  className={`custom-checkbox-container ${isDisabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => !isDisabled && handleBrandToggle(brand)}
                    disabled={isDisabled}
                  />
                  <span className="custom-checkbox" />
                  <span className="text-sm font-medium text-black/70 flex justify-between w-full">
                    {brand}
                    {count > 0 && <span className="text-[10px] text-black/30">({count})</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </FilterSection>
      )}

      {/* Color Filter */}
      {facets.colors && facets.colors.length > 0 && (
        <FilterSection title="Color" id="color" count={facets.colors.length}>
          <div className="color-swatch-grid">
            {facets.colors.map(color => {
              const count = getFilterCount('color', color);
              const isSelected = selectedColors.includes(color);
              const isDisabled = count === 0 && !isSelected;

              return (
                <button
                  key={color}
                  onClick={() => !isDisabled && handleColorToggle(color)}
                  disabled={isDisabled}
                  className={`color-swatch-btn ${isSelected ? 'active ring-1 ring-accent ring-offset-2' : ''} ${isDisabled ? 'opacity-20 cursor-not-allowed' : ''}`}
                  title={`${color}${count > 0 ? ` (${count})` : ''}`}
                >
                  <div
                    className="color-swatch-inner"
                    style={{
                      backgroundColor: color.toLowerCase() === 'white' ? '#FAFAF9' : color.toLowerCase()
                    }}
                  />
                </button>
              );
            })}
          </div>
        </FilterSection>
      )}

      {/* Dynamic Filters */}
      {facets.filters && Object.entries(facets.filters).map(([key, values]) => (
        <FilterSection
          title={key}
          id={key.toLowerCase().replace(/\s+/g, '-')}
          key={key}
          count={values.length}
        >
          <div className="space-y-1 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
            {values.map(({ value, count: filterCount }) => {
              const isSelected = selectedFilters[key]?.includes(value) || false;
              const isDisabled = filterCount === 0 && !isSelected;

              return (
                <label
                  key={value}
                  className={`custom-checkbox-container ${isDisabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => !isDisabled && handleFilterToggle(key, value)}
                    disabled={isDisabled}
                  />
                  <span className="custom-checkbox" />
                  <span className="text-sm font-medium text-black/70 flex justify-between w-full">
                    {value}
                    {filterCount > 0 && <span className="text-[10px] text-black/30">({filterCount})</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </FilterSection>
      ))}
      {/* NOTE: Specifications removed from sidebar - they are for product detail page only */}
      {/* Golden Rule: filterable = filters (admin form), descriptive = specifications */}
    </aside>
  );

  const isLoading = contextLoading || facetsLoading;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{currentCategoryName}</h1>
        <p className="text-black/60 mt-2">
          {searchQuery
            ? `Found ${totalProducts} result${totalProducts !== 1 ? 's' : ''}`
            : `${totalProducts} product${totalProducts !== 1 ? 's' : ''}`
          }
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm border-y border-black/10 my-8 py-4 text-center text-black/70">
        <div>Express Delivery Dispatch within 24 Hours</div>
        <div className="border-x-0 md:border-x border-black/10">Easy Return</div>
        <div>100% Sustainable Packaging</div>
      </div>

      <div className="flex flex-col lg:flex-row gap-12">
        {/* Filter Sidebar */}
        <div className="hidden lg:block w-1/4 xl:w-1/5">
          <FilterSidebar />
        </div>

        {/* Mobile Filter Overlay */}
        {isFilterOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setIsFilterOpen(false)} />
            <div className="relative bg-white w-4/5 max-w-sm h-full shadow-lg p-6 overflow-y-auto">
              <FilterSidebar />
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="w-full lg:w-3/4 xl:w-4/5">
          {/* Toolbar */}
          <div className="flex justify-between items-center mb-6">
            <button
              onClick={() => setIsFilterOpen(true)}
              className="flex items-center gap-2 font-semibold lg:hidden"
            >
              <FilterIcon /> Filter
              {hasActiveFilters && (
                <span className="ml-1 px-2 py-0.5 text-xs bg-accent text-white rounded-full">
                  {Object.keys(selectedFilters).length +
                    selectedColors.length +
                    selectedBrands.length +
                    (priceRange.minValue || priceRange.maxValue ? 1 : 0)}
                </span>
              )}
            </button>
            <div className="hidden lg:block text-sm text-black/70">
              Showing {paginatedProducts.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0} - {Math.min(currentPage * ITEMS_PER_PAGE, totalProducts)} of {totalProducts}
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="sort" className="text-sm text-black/70">Sort by:</label>
              <select
                id="sort"
                value={sortBy}
                onChange={e => handleSortChange(e.target.value)}
                className="border border-black/20 rounded-sm p-2 text-sm text-black bg-white"
              >
                <option value="newest">Date, new to old</option>
                <option value="price-asc">Price, low to high</option>
                <option value="price-desc">Price, high to low</option>
              </select>
            </div>
          </div>

          {/* Active Filters Chips */}
          <ActiveFiltersChips />

          {/* Products Grid */}
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
              {Array.from({ length: 6 }).map((_, index) => (
                <ProductCardSkeleton key={`skeleton-${index}`} />
              ))}
            </div>
          ) : paginatedProducts.length > 0 ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                {paginatedProducts.map(product => (
                  <ProductCard key={product._id || product.id} product={product} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-12 flex justify-center items-center gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-4 py-2 border border-black/20 rounded-sm text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black/5 transition-colors"
                  >
                    Previous
                  </button>

                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`px-3 py-2 border rounded-sm text-sm transition-colors ${currentPage === pageNum
                            ? 'border-accent bg-accent text-white'
                            : 'border-black/20 hover:bg-black/5'
                            }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 border border-black/20 rounded-sm text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black/5 transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-16">
              <h3 className="text-2xl font-semibold text-black">No Products Found</h3>
              <p className="text-black/60 mt-2">
                {hasActiveFilters
                  ? 'Try adjusting your filters or clearing them to see more products.'
                  : 'Try adjusting your search term or browsing categories.'
                }
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="mt-4 px-6 py-2 bg-accent text-white rounded-sm hover:bg-accent/90 transition-colors"
                >
                  Clear All Filters
                </button>
              )}
              {searchQuery && (
                <Link
                  href="/catalog"
                  className="mt-4 px-6 py-2 bg-accent text-white rounded-sm hover:bg-accent/90 transition-colors inline-block"
                >
                  Back to Catalog
                </Link>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function CatalogPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <ProductCardSkeleton key={`skeleton-${index}`} />
          ))}
        </div>
      </div>
    }>
      <CatalogPageContent />
    </Suspense>
  );
}
