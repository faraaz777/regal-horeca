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
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import ProductCard from '@/components/ProductCard';
import ProductCardSkeleton from '@/components/ProductCardSkeleton';
import { useAppContext } from '@/context/AppContext';
import { useProductFilters } from '@/hooks/useProductFilters';
import { PlusIcon, MinusIcon, FilterIcon, XIcon, ChevronLeftIcon } from '@/components/Icons';

const ITEMS_PER_PAGE = 24;

// Fetcher for SWR
const fetcher = (url) => fetch(url).then(res => res.json());

function CatalogPageContent() {
  const { products, categories, loading: contextLoading } = useAppContext();
  const searchParams = useSearchParams();
  
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [openFilterSections, setOpenFilterSections] = useState({
    price: true,
    color: true,
    brand: true,
    status: true,
  });

  // Get context filters from URL
  const selectedCategorySlug = searchParams.get('category') || '';
  const selectedBusinessSlug = searchParams.get('business') || '';
  const searchQuery = searchParams.get('search') || '';

  // Use custom filter hook
  const {
    priceRange,
    selectedColors,
    selectedBrands,
    selectedStatus,
    selectedFilters,
    selectedSpecs,
    sortBy,
    contextFilteredProducts,
    filteredProducts,
    handlePriceMinChange,
    handlePriceMaxChange,
    handleColorToggle,
    handleBrandToggle,
    handleStatusToggle,
    handleFilterToggle,
    handleSpecToggle,
    handleSortChange,
    clearAllFilters,
    hasActiveFilters,
  } = useProductFilters(products, categories);

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
    specs: {},
    statuses: [],
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

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredProducts, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategorySlug, selectedBusinessSlug, searchQuery, selectedColors, selectedBrands, selectedStatus, selectedFilters, selectedSpecs, priceRange.minValue, priceRange.maxValue]);

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
    if (facets.specs && Object.keys(facets.specs).length > 0) {
      setOpenFilterSections(prev => {
        const newSections = { ...prev };
        Object.keys(facets.specs).forEach(key => {
          const sectionId = key.toLowerCase().replace(/\s+/g, '-');
          if (newSections[sectionId] === undefined) {
            newSections[sectionId] = true;
          }
        });
        return newSections;
      });
    }
  }, [facets.filters, facets.specs]);

  const toggleFilterSection = (section) => {
    setOpenFilterSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Calculate filter counts (how many products would match if this filter is applied)
  const getFilterCount = useCallback((filterType, value) => {
    // This is a simplified count - in production, you'd want to calculate this more accurately
    // by checking how many products match when this filter is added
    if (filterType === 'color') {
      return contextFilteredProducts.filter(p => {
        const productColors = p.colorVariants?.map(cv => cv.colorName) || [];
        return productColors.includes(value);
      }).length;
    }
    if (filterType === 'brand') {
      return contextFilteredProducts.filter(p => p.brand?.trim() === value).length;
    }
    if (filterType === 'status') {
      return contextFilteredProducts.filter(p => p.status === value).length;
    }
    return 0;
  }, [contextFilteredProducts]);

  // Filter Section Component
  const FilterSection = ({ title, id, children, count }) => {
    const isOpen = openFilterSections[id] !== false;
    const hasItems = count !== undefined ? count > 0 : true;
    
    if (!hasItems) return null;

    return (
      <div className="py-4 border-b border-medium">
        <button 
          onClick={() => toggleFilterSection(id)} 
          className="w-full flex justify-between items-center"
        >
          <h3 className="text-sm font-semibold uppercase tracking-wider">
            {title}
            {count !== undefined && count > 0 && (
              <span className="ml-2 text-xs font-normal text-black/50">({count})</span>
            )}
          </h3>
          {isOpen ? <MinusIcon className="w-4 h-4" /> : <PlusIcon className="w-4 h-4" />}
        </button>
        {isOpen && <div className="pt-3">{children}</div>}
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

    selectedStatus.forEach(status => {
      chips.push({
        label: `Status: ${status}`,
        onRemove: () => handleStatusToggle(status)
      });
    });

    Object.entries(selectedFilters).forEach(([key, values]) => {
      values.forEach(value => {
        chips.push({
          label: `${key}: ${value}`,
          onRemove: () => handleFilterToggle(key, value)
        });
      });
    });

    Object.entries(selectedSpecs).forEach(([key, values]) => {
      values.forEach(value => {
        chips.push({
          label: `${key}: ${value}`,
          onRemove: () => handleSpecToggle(key, value)
        });
      });
    });

    if (chips.length === 0) return null;

    return (
      <div className="mb-6 flex flex-wrap gap-2 items-center">
        <span className="text-sm font-medium text-black/70">Active Filters:</span>
        {chips.map((chip, index) => (
          <button
            key={index}
            onClick={chip.onRemove}
            className="flex items-center gap-1 px-3 py-1 text-xs bg-black/5 hover:bg-black/10 rounded-full transition-colors"
          >
            <span>{chip.label}</span>
            <XIcon className="w-3 h-3" />
          </button>
        ))}
        <button
          onClick={clearAllFilters}
          className="px-3 py-1 text-xs text-accent hover:text-black font-semibold transition-colors"
        >
          Clear All
        </button>
      </div>
    );
  };

  // Filter Sidebar Component
  const FilterSidebar = () => (
    <aside>
      <div className="flex justify-between items-center mb-4 lg:hidden">
        <h2 className="text-lg font-semibold">Filter</h2>
        <button onClick={() => setIsFilterOpen(false)}>
          <XIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Categories */}
      <div className="py-4 border-b border-medium">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider">Categories</h3>
          {(selectedCategorySlug || hasActiveFilters) && (
            <button
              onClick={() => {
                clearAllFilters();
                window.location.href = '/catalog';
              }}
              className="text-xs text-accent hover:text-black transition-colors font-semibold"
            >
              Reset
            </button>
          )}
        </div>
        <ul className="space-y-2 text-sm">
          {parentCategory && (
            <li>
              <Link 
                href={`/catalog?category=${parentCategory.slug}`} 
                className="flex items-center text-black/70 hover:text-black font-medium transition-colors"
              >
                <ChevronLeftIcon className="w-4 h-4 mr-1" />
                {parentCategory.name}
              </Link>
            </li>
          )}
          {displayCategories.map(cat => (
            <li key={cat._id || cat.id} style={{ paddingLeft: parentCategory ? '1rem' : '0' }}>
              <Link
                href={`/catalog?category=${cat.slug}`}
                className={`block transition-colors ${
                  selectedCategorySlug === cat.slug 
                    ? 'text-accent font-semibold' 
                    : 'text-black/70 hover:text-black'
                }`}
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
        <div className="space-y-2">
          <div className="text-xs text-black/60 mb-2">
            Range: ${facets.priceRange.min} - ${facets.priceRange.max}
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="number" 
              placeholder={`Min (${facets.priceRange.min})`}
              value={priceRange.min} 
              onChange={e => handlePriceMinChange(e.target.value)} 
              min={facets.priceRange.min}
              max={facets.priceRange.max}
              className="w-full p-2 border border-medium rounded-sm text-sm" 
            />
            <span className="text-black/40">-</span>
            <input 
              type="number" 
              placeholder={`Max (${facets.priceRange.max})`}
              value={priceRange.max} 
              onChange={e => handlePriceMaxChange(e.target.value)} 
              min={facets.priceRange.min}
              max={facets.priceRange.max}
              className="w-full p-2 border border-medium rounded-sm text-sm" 
            />
          </div>
        </div>
      </FilterSection>

      {/* Status Filter */}
      {facets.statuses && facets.statuses.length > 0 && (
        <FilterSection title="Availability" id="status" count={facets.statuses.length}>
          <div className="space-y-2">
            {facets.statuses.map(status => {
              const count = getFilterCount('status', status);
              const isSelected = selectedStatus.includes(status);
              const isDisabled = count === 0 && !isSelected;
              
              return (
                <label 
                  key={status} 
                  className={`flex items-center space-x-2 cursor-pointer ${
                    isDisabled ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <input 
                    type="checkbox" 
                    checked={isSelected}
                    onChange={() => !isDisabled && handleStatusToggle(status)}
                    disabled={isDisabled}
                    className="h-4 w-4 rounded border-black/20 text-accent focus:ring-accent disabled:cursor-not-allowed" 
                  />
                  <span className="text-sm text-black/70">
                    {status}
                    {count > 0 && <span className="ml-1 text-black/40">({count})</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </FilterSection>
      )}

      {/* Brand Filter */}
      {facets.brands && facets.brands.length > 0 && (
        <FilterSection title="Brand" id="brand" count={facets.brands.length}>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {facets.brands.map(brand => {
              const count = getFilterCount('brand', brand);
              const isSelected = selectedBrands.includes(brand);
              const isDisabled = count === 0 && !isSelected;
              
              return (
                <label 
                  key={brand} 
                  className={`flex items-center space-x-2 cursor-pointer ${
                    isDisabled ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <input 
                    type="checkbox" 
                    checked={isSelected}
                    onChange={() => !isDisabled && handleBrandToggle(brand)}
                    disabled={isDisabled}
                    className="h-4 w-4 rounded border-black/20 text-accent focus:ring-accent disabled:cursor-not-allowed" 
                  />
                  <span className="text-sm text-black/70">
                    {brand}
                    {count > 0 && <span className="ml-1 text-black/40">({count})</span>}
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
          <div className="grid grid-cols-5 gap-2">
            {facets.colors.map(color => {
              const count = getFilterCount('color', color);
              const isSelected = selectedColors.includes(color);
              const isDisabled = count === 0 && !isSelected;
              
              return (
                <button 
                  key={color} 
                  onClick={() => !isDisabled && handleColorToggle(color)}
                  disabled={isDisabled}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    isSelected 
                      ? 'border-accent ring-2 ring-accent/20' 
                      : 'border-transparent hover:border-black/20'
                  } ${isDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                  title={`${color}${count > 0 ? ` (${count})` : ''}`}
                >
                  <div 
                    className="w-full h-full rounded-full border border-gray-200" 
                    style={{ 
                      backgroundColor: color.toLowerCase() === 'white' ? '#f8f8f8' : color.toLowerCase() 
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
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {values.map(({ value, count: filterCount }) => {
              const isSelected = selectedFilters[key]?.includes(value) || false;
              const isDisabled = filterCount === 0 && !isSelected;
              
              return (
                <label 
                  key={value} 
                  className={`flex items-center space-x-2 cursor-pointer ${
                    isDisabled ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <input 
                    type="checkbox" 
                    checked={isSelected}
                    onChange={() => !isDisabled && handleFilterToggle(key, value)}
                    disabled={isDisabled}
                    className="h-4 w-4 rounded border-black/20 text-accent focus:ring-accent disabled:cursor-not-allowed" 
                  />
                  <span className="text-sm text-black/70">
                    {value}
                    {filterCount > 0 && <span className="ml-1 text-black/40">({filterCount})</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </FilterSection>
      ))}

      {/* Specifications */}
      {facets.specs && Object.entries(facets.specs).map(([key, values]) => (
        <FilterSection 
          title={key} 
          id={key.toLowerCase().replace(/\s+/g, '-')} 
          key={key}
          count={values.length}
        >
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {values.map(({ value, count: specCount }) => {
              const isSelected = selectedSpecs[key]?.includes(value) || false;
              const isDisabled = specCount === 0 && !isSelected;
              
              return (
                <label 
                  key={value} 
                  className={`flex items-center space-x-2 cursor-pointer ${
                    isDisabled ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <input 
                    type="checkbox" 
                    checked={isSelected}
                    onChange={() => !isDisabled && handleSpecToggle(key, value)}
                    disabled={isDisabled}
                    className="h-4 w-4 rounded border-black/20 text-accent focus:ring-accent disabled:cursor-not-allowed" 
                  />
                  <span className="text-sm text-black/70">
                    {value}
                    {specCount > 0 && <span className="ml-1 text-black/40">({specCount})</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </FilterSection>
      ))}
    </aside>
  );

  const isLoading = contextLoading || facetsLoading;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{currentCategoryName}</h1>
        <p className="text-black/60 mt-2">
          {searchQuery 
            ? `Found ${filteredProducts.length} result${filteredProducts.length !== 1 ? 's' : ''}` 
            : `${filteredProducts.length} product${filteredProducts.length !== 1 ? 's' : ''}`
          }
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm border-y border-black/10 my-8 py-4 text-center text-black/70">
        <div>Express Delivery Dispatch within 24 Hours</div>
        <div className="border-x-0 md:border-x border-black/10">Easy Return, COD</div>
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
                   Object.keys(selectedSpecs).length + 
                   selectedColors.length + 
                   selectedBrands.length + 
                   selectedStatus.length + 
                   (priceRange.minValue || priceRange.maxValue ? 1 : 0)}
                </span>
              )}
            </button>
            <div className="hidden lg:block text-sm text-black/70">
              Showing {paginatedProducts.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredProducts.length)} of {filteredProducts.length}
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
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-3 gap-4 md:gap-8">
              {Array.from({ length: 6 }).map((_, index) => (
                <ProductCardSkeleton key={`skeleton-${index}`} />
              ))}
            </div>
          ) : paginatedProducts.length > 0 ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-3 gap-4 md:gap-8">
                {paginatedProducts.map(product => (
                  <ProductCard key={product._id || product.id} product={product} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-12 flex justify-center items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
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
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-2 border rounded-sm text-sm transition-colors ${
                            currentPage === pageNum
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
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
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
                  className="mt-4 inline-block text-accent font-medium hover:text-black transition-colors"
                >
                  Clear Search
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
      <div className="min-h-screen bg-white">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, index) => (
              <ProductCardSkeleton key={`skeleton-${index}`} />
            ))}
          </div>
        </div>
      </div>
    }>
      <CatalogPageContent />
    </Suspense>
  );
}
