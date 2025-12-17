/**
 * Custom Hook: useProductFilters
 * 
 * Manages product filtering logic with URL state synchronization.
 * Handles:
 * - Context-aware filtering (category, business, search)
 * - User filters (price, colors, brands, filters, specs, status)
 * - URL state management
 * - Filter validation and debouncing
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

const PREDEFINED_COLORS = [
  'Blue', 'Green', 'Red', 'Yellow', 'Purple', 'Orange', 
  'Pink', 'Brown', 'Gray', 'Black', 'White', 'Silver'
];

// Debounce utility
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function useProductFilters(products, categories) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Read URL params
  const selectedCategorySlug = searchParams.get('category') || '';
  const selectedBusinessSlug = searchParams.get('business') || '';
  const searchQuery = searchParams.get('search') || '';
  const sortBy = searchParams.get('sort') || 'newest';

  // Filter states from URL
  const priceMin = searchParams.get('priceMin') || '';
  const priceMax = searchParams.get('priceMax') || '';
  const colorsParam = searchParams.get('colors') || '';
  const brandsParam = searchParams.get('brands') || '';
  const statusParam = searchParams.get('status') || '';
  const filtersParam = searchParams.get('filters') || '';
  const specsParam = searchParams.get('specs') || '';

  // Parse URL params into arrays/objects
  const selectedColors = useMemo(() => 
    colorsParam ? colorsParam.split(',').filter(Boolean) : [], 
    [colorsParam]
  );
  const selectedBrands = useMemo(() => 
    brandsParam ? brandsParam.split(',').filter(Boolean) : [], 
    [brandsParam]
  );
  const selectedStatus = useMemo(() => 
    statusParam ? statusParam.split(',').filter(Boolean) : [], 
    [statusParam]
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
  const selectedSpecs = useMemo(() => {
    if (!specsParam) return {};
    try {
      const parsed = JSON.parse(decodeURIComponent(specsParam));
      return typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }, [specsParam]);

  // Debounced price inputs for URL updates
  const [priceMinInput, setPriceMinInput] = useState(priceMin);
  const [priceMaxInput, setPriceMaxInput] = useState(priceMax);
  const debouncedPriceMin = useDebounce(priceMinInput, 500);
  const debouncedPriceMax = useDebounce(priceMaxInput, 500);

  // Update URL when debounced prices change
  useEffect(() => {
    updateURL({ priceMin: debouncedPriceMin, priceMax: debouncedPriceMax });
  }, [debouncedPriceMin, debouncedPriceMax]);

  // Sync local inputs with URL params
  useEffect(() => {
    setPriceMinInput(priceMin);
    setPriceMaxInput(priceMax);
  }, [priceMin, priceMax]);

  // Update URL helper
  const updateURL = useCallback((updates) => {
    const params = new URLSearchParams(searchParams.toString());
    
    // Update each parameter
    if (updates.category !== undefined) {
      if (updates.category) params.set('category', updates.category);
      else params.delete('category');
    }
    if (updates.business !== undefined) {
      if (updates.business) params.set('business', updates.business);
      else params.delete('business');
    }
    if (updates.search !== undefined) {
      if (updates.search) params.set('search', updates.search);
      else params.delete('search');
    }
    if (updates.sort !== undefined) {
      if (updates.sort && updates.sort !== 'newest') params.set('sort', updates.sort);
      else params.delete('sort');
    }
    if (updates.priceMin !== undefined) {
      if (updates.priceMin) params.set('priceMin', updates.priceMin);
      else params.delete('priceMin');
    }
    if (updates.priceMax !== undefined) {
      if (updates.priceMax) params.set('priceMax', updates.priceMax);
      else params.delete('priceMax');
    }
    if (updates.colors !== undefined) {
      if (updates.colors.length > 0) params.set('colors', updates.colors.join(','));
      else params.delete('colors');
    }
    if (updates.brands !== undefined) {
      if (updates.brands.length > 0) params.set('brands', updates.brands.join(','));
      else params.delete('brands');
    }
    if (updates.status !== undefined) {
      if (updates.status.length > 0) params.set('status', updates.status.join(','));
      else params.delete('status');
    }
    if (updates.filters !== undefined) {
      if (Object.keys(updates.filters).length > 0) {
        params.set('filters', encodeURIComponent(JSON.stringify(updates.filters)));
      } else {
        params.delete('filters');
      }
    }
    if (updates.specs !== undefined) {
      if (Object.keys(updates.specs).length > 0) {
        params.set('specs', encodeURIComponent(JSON.stringify(updates.specs)));
      } else {
        params.delete('specs');
      }
    }

    router.push(`/catalog?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  // Get contextually filtered products (before user filters)
  const contextFilteredProducts = useMemo(() => {
    let filtered = [...products];

    // Search filter
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.title?.toLowerCase().includes(lowerQuery) || 
        p.brand?.toLowerCase().includes(lowerQuery) ||
        p.tags?.some(t => t.toLowerCase().includes(lowerQuery))
      );
    }

    // Category filter
    if (selectedCategorySlug) {
      const getSubtreeIds = (slug) => {
        const cat = categories.find(c => c.slug === slug);
        if (!cat) return [];
        const catId = cat._id || cat.id;
        let ids = [catId];
        const children = categories.filter(c => {
          const cParent = c.parent?._id || c.parent;
          return cParent === catId;
        });
        children.forEach(child => ids.push(...getSubtreeIds(child.slug)));
        return ids;
      };
      const categoryIds = getSubtreeIds(selectedCategorySlug);
      filtered = filtered.filter(p => {
        const pCategoryId = p.categoryId?._id || p.categoryId;
        return categoryIds.some(id => {
          const idStr = id.toString();
          const pIdStr = pCategoryId?.toString();
          return idStr === pIdStr;
        });
      });
    }

    // Business type filter
    if (selectedBusinessSlug) {
      filtered = filtered.filter(p => 
        p.businessTypeSlugs?.includes(selectedBusinessSlug)
      );
    }

    return filtered;
  }, [products, categories, selectedCategorySlug, selectedBusinessSlug, searchQuery]);

  // Apply user filters
  const filteredProducts = useMemo(() => {
    let filtered = [...contextFilteredProducts];

    // Price filter
    if (priceMin) {
      const min = Number(priceMin);
      if (!isNaN(min)) filtered = filtered.filter(p => p.price >= min);
    }
    if (priceMax) {
      const max = Number(priceMax);
      if (!isNaN(max)) filtered = filtered.filter(p => p.price <= max);
    }

    // Color filter
    if (selectedColors.length > 0) {
      filtered = filtered.filter(p => {
        const productColors = p.colorVariants
          ?.map(cv => cv.colorName)
          .filter(colorName => PREDEFINED_COLORS.includes(colorName)) || [];
        return productColors.some(c => selectedColors.includes(c));
      });
    }

    // Brand filter
    if (selectedBrands.length > 0) {
      filtered = filtered.filter(p => 
        p.brand && selectedBrands.includes(p.brand.trim())
      );
    }

    // Status filter
    if (selectedStatus.length > 0) {
      filtered = filtered.filter(p => 
        p.status && selectedStatus.includes(p.status)
      );
    }

    // Dynamic filters
    Object.entries(selectedFilters).forEach(([filterKey, filterValues]) => {
      if (filterValues.length > 0) {
        filtered = filtered.filter(p => {
          const productFilter = p.filters?.find(f => f.key === filterKey);
          return productFilter && productFilter.values?.some(v => filterValues.includes(v));
        });
      }
    });

    // Specifications
    Object.entries(selectedSpecs).forEach(([specLabel, specValues]) => {
      if (specValues.length > 0) {
        filtered = filtered.filter(p => {
          const productSpec = p.specifications?.find(s => s.label === specLabel);
          return productSpec && specValues.includes(`${productSpec.value}${productSpec.unit || ''}`);
        });
      }
    });

    // Sorting
    switch (sortBy) {
      case 'price-asc':
        filtered.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case 'price-desc':
        filtered.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case 'newest':
      default:
        filtered.sort((a, b) => {
          const aDate = new Date(a.createdAt || 0);
          const bDate = new Date(b.createdAt || 0);
          return bDate - aDate;
        });
        break;
    }

    return filtered;
  }, [
    contextFilteredProducts,
    priceMin,
    priceMax,
    selectedColors,
    selectedBrands,
    selectedStatus,
    selectedFilters,
    selectedSpecs,
    sortBy
  ]);

  // Filter handlers
  const handlePriceMinChange = useCallback((value) => {
    setPriceMinInput(value);
  }, []);

  const handlePriceMaxChange = useCallback((value) => {
    setPriceMaxInput(value);
  }, []);

  const handleColorToggle = useCallback((color) => {
    const newColors = selectedColors.includes(color)
      ? selectedColors.filter(c => c !== color)
      : [...selectedColors, color];
    updateURL({ colors: newColors });
  }, [selectedColors, updateURL]);

  const handleBrandToggle = useCallback((brand) => {
    const newBrands = selectedBrands.includes(brand)
      ? selectedBrands.filter(b => b !== brand)
      : [...selectedBrands, brand];
    updateURL({ brands: newBrands });
  }, [selectedBrands, updateURL]);

  const handleStatusToggle = useCallback((status) => {
    const newStatus = selectedStatus.includes(status)
      ? selectedStatus.filter(s => s !== status)
      : [...selectedStatus, status];
    updateURL({ status: newStatus });
  }, [selectedStatus, updateURL]);

  const handleFilterToggle = useCallback((filterKey, value) => {
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
    updateURL({ filters: newFilters });
  }, [selectedFilters, updateURL]);

  const handleSpecToggle = useCallback((label, value) => {
    const current = selectedSpecs[label] || [];
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    const newSpecs = { ...selectedSpecs, [label]: updated };
    // Remove empty arrays
    Object.keys(newSpecs).forEach(key => {
      if (newSpecs[key].length === 0) {
        delete newSpecs[key];
      }
    });
    updateURL({ specs: newSpecs });
  }, [selectedSpecs, updateURL]);

  const handleSortChange = useCallback((newSort) => {
    updateURL({ sort: newSort });
  }, [updateURL]);

  const clearAllFilters = useCallback(() => {
    updateURL({
      priceMin: '',
      priceMax: '',
      colors: [],
      brands: [],
      status: [],
      filters: {},
      specs: {},
    });
    setPriceMinInput('');
    setPriceMaxInput('');
  }, [updateURL]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return !!(
      priceMin ||
      priceMax ||
      selectedColors.length > 0 ||
      selectedBrands.length > 0 ||
      selectedStatus.length > 0 ||
      Object.keys(selectedFilters).length > 0 ||
      Object.keys(selectedSpecs).length > 0
    );
  }, [priceMin, priceMax, selectedColors, selectedBrands, selectedStatus, selectedFilters, selectedSpecs]);

  return {
    // Context filters
    selectedCategorySlug,
    selectedBusinessSlug,
    searchQuery,
    
    // User filters
    priceRange: {
      min: priceMinInput,
      max: priceMaxInput,
      minValue: priceMin,
      maxValue: priceMax,
    },
    selectedColors,
    selectedBrands,
    selectedStatus,
    selectedFilters,
    selectedSpecs,
    sortBy,
    
    // Filtered products
    contextFilteredProducts,
    filteredProducts,
    
    // Handlers
    handlePriceMinChange,
    handlePriceMaxChange,
    handleColorToggle,
    handleBrandToggle,
    handleStatusToggle,
    handleFilterToggle,
    handleSpecToggle,
    handleSortChange,
    clearAllFilters,
    
    // State
    hasActiveFilters,
  };
}

