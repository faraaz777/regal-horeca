'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import useSWR from 'swr';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ProductCard from '@/components/ProductCard';
import ProductCardSkeleton from '@/components/ProductCardSkeleton';
import { useAppContext } from '@/context/AppContext';
import { PlusIcon, MinusIcon, XIcon, ChevronLeftIcon, Grid2x2Icon, Grid3x3Icon, Grid4x4Icon, Grid5x5Icon, ListIcon, FilterIcon } from '@/components/Icons';
import '@/components/new/SidebarFilter.css';

const ITEMS_PER_PAGE = 24;

// Fetcher for SWR
const fetcher = (url) => fetch(url).then(res => res.json());

export default function CatalogPageClient({ initialProductsData, initialFacetsData }) {
  const { categories } = useAppContext();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [openFilterSections, setOpenFilterSections] = useState({
    price: true,
    color: true,
    brand: true,
  });

  // Grid view states - separate for mobile and desktop
  // Initialize with default values to avoid hydration mismatch
  const [mobileGridView, setMobileGridView] = useState('2');
  const [desktopGridView, setDesktopGridView] = useState('3');
  const [isClient, setIsClient] = useState(false);

  // Subcategories scroll (CircularCategories-style)
  const subcategoriesScrollRef = useRef(null);
  const [showSubcatLeftArrow, setShowSubcatLeftArrow] = useState(false);
  const [showSubcatRightArrow, setShowSubcatRightArrow] = useState(true);

  // Load from localStorage after component mounts (client-side only)
  useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined') {
      const savedMobile = localStorage.getItem('catalog-mobile-grid-view');
      if (savedMobile) {
        setMobileGridView(savedMobile);
      }
      
      const savedDesktop = localStorage.getItem('catalog-desktop-grid-view');
      if (savedDesktop) {
        // Migrate old '2' preference to '3', or use saved value if valid (3, 4, or 5)
        if (savedDesktop === '2') {
          setDesktopGridView('3');
        } else if (savedDesktop === '3' || savedDesktop === '4' || savedDesktop === '5') {
          setDesktopGridView(savedDesktop);
        }
      }
    }
  }, []);

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
  // Use initial data from server-side fetch for instant display
  const { data: productsData, isLoading: productsLoading } = useSWR(
    `/api/products?${productsParams.toString()}`,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnMount: false,
      revalidateIfStale: false,
      dedupingInterval: 60000, // Cache for 1 minute
      fallbackData: initialProductsData, // Use server-side data immediately
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
      revalidateOnMount: false,
      revalidateIfStale: false,
      dedupingInterval: 60000, // Cache for 1 minute
      fallbackData: initialFacetsData, // Use server-side data immediately
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

  // Save grid view preferences to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('catalog-mobile-grid-view', mobileGridView);
    }
  }, [mobileGridView]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('catalog-desktop-grid-view', desktopGridView);
    }
  }, [desktopGridView]);

  // Subcategories with images only (for CircularCategories-style display)
  const subcategoriesWithImages = useMemo(() => 
    (displayCategories || []).filter(cat => cat.image && cat.image.trim()),
    [displayCategories]
  );

  const truncateCategoryName = (name) => {
    if (!name) return '';
    const words = name.trim().split(/\s+/);
    if (words.length >= 3) return words.slice(0, 2).join(' ') + '...';
    return name;
  };

  const checkSubcategoriesScrollPosition = useCallback(() => {
    const container = subcategoriesScrollRef.current;
    if (!container) return;
    const { scrollLeft, scrollWidth, clientWidth } = container;
    setShowSubcatLeftArrow(scrollLeft > 0);
    setShowSubcatRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
  }, []);

  useEffect(() => {
    checkSubcategoriesScrollPosition();
    const container = subcategoriesScrollRef.current;
    if (container) {
      container.addEventListener('scroll', checkSubcategoriesScrollPosition);
      window.addEventListener('resize', checkSubcategoriesScrollPosition);
      return () => {
        container.removeEventListener('scroll', checkSubcategoriesScrollPosition);
        window.removeEventListener('resize', checkSubcategoriesScrollPosition);
      };
    }
  }, [subcategoriesWithImages.length, checkSubcategoriesScrollPosition]);

  // Initialize filter sections dynamically
  useEffect(() => {
    if (facets.filters && Object.keys(facets.filters).length > 0) {
      setOpenFilterSections(prev => {
        const newSections = { ...prev };
        Object.keys(facets.filters).forEach(key => {
          const sectionId = key.toLowerCase().replace(/\s+/g, '-');
          if (newSections[sectionId] === undefined) {
            // Size filter should be closed by default
            newSections[sectionId] = key.toLowerCase() !== 'size';
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

              // Color mapping to hex values
              const getColorHex = (colorName) => {
                const colorMap = {
                  'blue': '#3B82F6',
                  'green': '#10B981',
                  'red': '#EF4444',
                  'yellow': '#F59E0B',
                  'purple': '#8B5CF6',
                  'orange': '#F97316',
                  'pink': '#EC4899',
                  'brown': '#92400E',
                  'gray': '#6B7280',
                  'grey': '#6B7280',
                  'black': '#121212',
                  'white': '#FAFAF9',
                  'silver': '#9CA3AF',
                };
                return colorMap[colorName.toLowerCase()] || '#CCCCCC';
              };

              return (
                <button
                  key={color}
                  onClick={() => !isDisabled && handleColorToggle(color)}
                  disabled={isDisabled}
                  className={`color-swatch-btn ${isSelected ? 'active' : ''} ${isDisabled ? 'opacity-20 cursor-not-allowed' : ''}`}
                  title={`${color}${count > 0 ? ` (${count})` : ''}`}
                >
                  <div
                    className="color-swatch-circle"
                    style={{
                      backgroundColor: getColorHex(color)
                    }}
                  />
                  <span className="color-swatch-label">{color}</span>
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

  // Get grid classes based on view preference
  const getGridClasses = useCallback(() => {
    // Mobile grid classes
    const mobileClasses = {
      '1': 'grid-cols-1',
      '2': 'grid-cols-2',
    };

    // Desktop grid classes
    const desktopClasses = {
      '3': 'lg:grid-cols-3',
      '4': 'lg:grid-cols-4',
      '5': 'lg:grid-cols-5',
    };

    return `${mobileClasses[mobileGridView] || 'grid-cols-2'} ${desktopClasses[desktopGridView] || 'lg:grid-cols-3'}`;
  }, [mobileGridView, desktopGridView]);

  return (
    <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 md:py-5">
      {/* Category title - left on mobile, centered on md+ */}
      <div className={`mb-2 sm:mb-3 ${currentCategory && subcategoriesWithImages.length > 0 ? 'text-left md:text-center' : 'text-center'}`}>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-medium tracking-tight text-gray-900">
          {currentCategory ? currentCategory.name : 'All Products'}
        </h1>
      </div>

      <div className="text-left md:text-center">
        {currentCategory && subcategoriesWithImages.length > 0 && (
          <div className="relative w-full">
            {showSubcatLeftArrow && (
              <button
                onClick={() => subcategoriesScrollRef.current?.scrollBy({ left: -300, behavior: 'smooth' })}
                className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white border border-black/10 rounded-full p-2 shadow-md hover:shadow-lg transition-all duration-200 items-center justify-center"
                aria-label="Scroll left"
              >
                <ChevronLeft className="w-5 h-5 text-black" />
              </button>
            )}
            {showSubcatRightArrow && (
              <button
                onClick={() => subcategoriesScrollRef.current?.scrollBy({ left: 300, behavior: 'smooth' })}
                className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white border border-black/10 rounded-full p-2 shadow-md hover:shadow-lg transition-all duration-200 items-center justify-center"
                aria-label="Scroll right"
              >
                <ChevronRight className="w-5 h-5 text-black" />
              </button>
            )}
            <div
              ref={subcategoriesScrollRef}
              className="flex py-1.5 sm:py-2 overflow-x-auto hide-scrollbar gap-3 sm:gap-4 md:gap-5 lg:gap-6 pb-1.5 sm:pb-2 snap-x snap-mandatory justify-start md:justify-center px-0 sm:px-4"
            >
              {subcategoriesWithImages.map((cat, index) => (
                <Link
                  key={cat._id || cat.id || `subcat-${index}`}
                  href={`/catalog?category=${cat.slug}`}
                  className={`group flex flex-col items-center gap-1.5 sm:gap-2 transition-all duration-300 hover:-translate-y-1 flex-shrink-0 snap-center min-w-[70px] sm:min-w-[90px] md:min-w-[100px] lg:min-w-[110px] ${
                    selectedCategorySlug === cat.slug ? 'ring-2 ring-accent ring-offset-2 rounded-full' : ''
                  }`}
                >
                  <div className={`relative w-[88px] h-[88px] sm:w-[88px] sm:h-[88px] md:w-[104px] md:h-[104px] lg:w-[120px] lg:h-[120px] rounded-none group-hover:rounded-full border-0 group-hover:border-[3px] group-hover:border-accent transition-all duration-300 overflow-hidden bg-white shadow-sm group-hover:shadow-md ${
                    selectedCategorySlug === cat.slug ? 'rounded-full border-[3px] border-accent' : ''
                  }`}>
                    <Image
                      src={cat.image}
                      alt={cat.name}
                      fill
                      unoptimized
                      sizes="(max-width: 640px) 88px, (max-width: 768px) 88px, (max-width: 1024px) 104px, 120px"
                      className="object-contain group-hover:object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  </div>
                  <span className="text-[9px] sm:text-xs font-semibold uppercase tracking-wide text-black group-hover:text-accent transition-colors duration-300 text-center whitespace-nowrap px-1">
                    {truncateCategoryName(cat.name)}
                  </span>
                </Link>
              ))}
            </div>
      
          </div>
        )}
      </div>


      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 mt-2 sm:mt-4">
        {/* Filter Sidebar */}
        {isDesktopSidebarOpen && (
          <div className="hidden lg:block w-1/4 xl:w-1/5 pr-6 transition-all duration-300 ease-in-out">
            <FilterSidebar />
          </div>
        )}

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
        <main className={`w-full transition-all duration-300 ease-in-out ${isDesktopSidebarOpen ? 'lg:w-3/4 xl:w-4/5' : 'lg:w-full'}`}>
          {/* Toolbar */}
          <div className="flex flex-col sm:grid sm:grid-cols-[auto_1fr_auto] sm:items-center gap-2 sm:gap-3 py-2 sm:py-3 mb-3 sm:mb-4 border-b border-gray-100">
            {/* Filter (left) | Showing (center) | Grid (right) */}
            <div className="flex items-center justify-between gap-3 sm:contents">
              {/* Left: Filter */}
              <div className="flex items-center gap-2 shrink-0 sm:order-1">
              <button
                onClick={() => setIsFilterOpen(true)}
                className="flex items-center gap-2  lg:hidden min-h-[44px] px-3 py-2 -ml-2 rounded-lg active:bg-black/5"
              >
                <FilterIcon className="w-5 h-5" /> Filter
                {hasActiveFilters && (
                  <span className="ml-1 px-2 py-0.5 text-xs bg-accent text-white rounded-full">
                    {Object.keys(selectedFilters).length +
                      selectedColors.length +
                      selectedBrands.length +
                      (priceRange.minValue || priceRange.maxValue ? 1 : 0)}
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  const willBeOpen = !isDesktopSidebarOpen;
                  setIsDesktopSidebarOpen(willBeOpen);
                  if (!willBeOpen) {
                    setDesktopGridView('4');
                  }
                }}
                className="hidden lg:flex items-center gap-2 font-semibold hover:text-accent transition-colors"
              >
                <FilterIcon className="w-5 h-5" />
                <span>{isDesktopSidebarOpen ? 'Hide' : 'Show'} Filters</span>
                {hasActiveFilters && (
                  <span className="ml-1 px-2 py-0.5 text-xs bg-accent text-white rounded-full">
                    {Object.keys(selectedFilters).length +
                      selectedColors.length +
                      selectedBrands.length +
                      (priceRange.minValue || priceRange.maxValue ? 1 : 0)}
                  </span>
                )}
              </button>
              </div>

              {/* Center: Showing count */}
              <div className="text-xs sm:text-sm text-black/60 text-center sm:order-2 min-w-0">
                Showing {paginatedProducts.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0} - {Math.min(currentPage * ITEMS_PER_PAGE, totalProducts)}
               {" "} of {totalProducts}
              </div>

              {/* Right: Grid layout */}
              <div className="flex items-center gap-2 sm:justify-end sm:order-3 shrink-0">
              {/* Grid View Selector - Mobile */}
              <div className="flex items-center gap-0.5 lg:hidden border border-black/20 rounded-md p-0.5" suppressHydrationWarning>
                <button
                  onClick={() => setMobileGridView('1')}
                  className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded transition-colors ${
                    mobileGridView === '1'
                      ? 'bg-accent text-white'
                      : 'text-black/60 hover:text-black active:bg-black/5'
                  }`}
                  title="1 Column"
                  suppressHydrationWarning
                >
                  <ListIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setMobileGridView('2')}
                  className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded transition-colors ${
                    mobileGridView === '2'
                      ? 'bg-accent text-white'
                      : 'text-black/60 hover:text-black active:bg-black/5'
                  }`}
                  title="2 Columns"
                  suppressHydrationWarning
                >
                  <Grid2x2Icon className="w-4 h-4" />
                </button>
              </div>

              {/* Grid View Selector - Desktop */}
              <div className="hidden lg:flex items-center gap-1 border border-black/20 rounded-sm p-1" suppressHydrationWarning>
                <button
                  onClick={() => setDesktopGridView('3')}
                  className={`p-1.5 rounded transition-colors ${
                    desktopGridView === '3'
                      ? 'bg-accent text-white'
                      : 'text-black/60 hover:text-black hover:bg-black/5'
                  }`}
                  title="3 Columns"
                  suppressHydrationWarning
                >
                  <Grid3x3Icon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDesktopGridView('4')}
                  className={`p-1.5 rounded transition-colors ${
                    desktopGridView === '4'
                      ? 'bg-accent text-white'
                      : 'text-black/60 hover:text-black hover:bg-black/5'
                  }`}
                  title="4 Columns"
                  suppressHydrationWarning
                >
                  <Grid4x4Icon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDesktopGridView('5')}
                  className={`p-1.5 rounded transition-colors ${
                    desktopGridView === '5'
                      ? 'bg-accent text-white'
                      : 'text-black/60 hover:text-black hover:bg-black/5'
                  }`}
                  title="5 Columns"
                  suppressHydrationWarning
                >
                  <Grid5x5Icon className="w-4 h-4" />
                </button>
              </div>
            </div>
            </div>
          </div>

          {/* Active Filters Chips */}
          <ActiveFiltersChips />

          {/* Products Grid */}
          {isLoading ? (
            <div className={`grid ${getGridClasses()} gap-4 md:gap-6`}>
              {Array.from({ length: 6 }).map((_, index) => (
                <ProductCardSkeleton key={`skeleton-${index}`} />
              ))}
            </div>
          ) : paginatedProducts.length > 0 ? (
            <>
              <div className={`grid ${getGridClasses()} gap-4 md:gap-6`}>
                {paginatedProducts.map(product => (
                  <ProductCard key={product._id || product.id} product={product} hidePrice={true} />
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

