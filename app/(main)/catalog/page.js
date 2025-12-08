/**
 * Catalog Page
 * 
 * Product catalog with filtering, search, and category navigation.
 * Supports URL-based filtering via query parameters.
 */

'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ProductCard from '@/components/ProductCard';
import ProductCardSkeleton from '@/components/ProductCardSkeleton';
import { useAppContext } from '@/context/AppContext';
import { PlusIcon, MinusIcon, FilterIcon, XIcon, ChevronLeftIcon } from '@/components/Icons';

const FILTERABLE_SPECS = ['Diameter', 'Volume'];

export default function CatalogPage() {
  const { products, categories, loading } = useAppContext();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [openFilterSections, setOpenFilterSections] = useState({
    price: true,
    color: true,
    tags: true,
  });
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [selectedColors, setSelectedColors] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedSpecs, setSelectedSpecs] = useState({});
  const [sortBy, setSortBy] = useState('newest');

  const selectedCategorySlug = searchParams.get('category');
  const selectedBusinessSlug = searchParams.get('business');
  const searchQuery = searchParams.get('search');

  useEffect(() => {
    setIsFilterOpen(false);
  }, [selectedCategorySlug, selectedBusinessSlug, searchQuery]);

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

  const filteredProducts = useMemo(() => {
    let filtered = [...products];

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.title.toLowerCase().includes(lowerQuery) || 
        p.brand.toLowerCase().includes(lowerQuery) ||
        p.tags.some(t => t.toLowerCase().includes(lowerQuery))
      );
    }

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

    if (selectedBusinessSlug) {
      filtered = filtered.filter(p => p.businessTypeSlugs?.includes(selectedBusinessSlug));
    }
    
    if (priceRange.min) filtered = filtered.filter(p => p.price >= Number(priceRange.min));
    if (priceRange.max) filtered = filtered.filter(p => p.price <= Number(priceRange.max));
    if (selectedColors.length > 0) filtered = filtered.filter(p => p.filters?.color?.some(c => selectedColors.includes(c)));
    if (selectedTags.length > 0) filtered = filtered.filter(p => p.tags?.some(t => selectedTags.includes(t)));
    
    Object.entries(selectedSpecs).forEach(([specLabel, specValues]) => {
      if (specValues.length > 0) {
        filtered = filtered.filter(p => {
          const productSpec = p.specifications?.find(s => s.label === specLabel);
          return productSpec && specValues.includes(`${productSpec.value}${productSpec.unit || ''}`);
        });
      }
    });

    switch (sortBy) {
      case 'price-asc':
        filtered.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        filtered.sort((a, b) => b.price - a.price);
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
  }, [selectedCategorySlug, selectedBusinessSlug, searchQuery, priceRange, selectedColors, selectedTags, selectedSpecs, sortBy, products, categories]);

  const filterOptions = useMemo(() => {
    const allColors = new Set();
    const allTags = new Set();
    const allSpecs = {};

    products.forEach(p => {
      p.filters?.color?.forEach(c => allColors.add(c));
      p.tags?.forEach(t => allTags.add(t));
      p.specifications?.forEach(spec => {
        if (FILTERABLE_SPECS.includes(spec.label)) {
          if (!allSpecs[spec.label]) allSpecs[spec.label] = new Set();
          allSpecs[spec.label].add(`${spec.value}${spec.unit || ''}`);
        }
      });
    });
    return {
      colors: Array.from(allColors),
      tags: Array.from(allTags),
      specs: Object.fromEntries(Object.entries(allSpecs).map(([key, value]) => [key, Array.from(value)]))
    };
  }, [products]);

  const toggleFilterSection = (section) => setOpenFilterSections(prev => ({ ...prev, [section]: !prev[section] }));
  const handleColorToggle = (color) => {
    setSelectedColors(prev => prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color]);
  };
  const handleTagToggle = (tag) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };
  const handleSpecToggle = (label, value) => {
    setSelectedSpecs(prev => {
      const current = prev[label] || [];
      const updated = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
      return { ...prev, [label]: updated };
    });
  };

  const FilterSection = ({ title, id, children }) => (
    <div className="py-4 border-b border-medium">
      <button onClick={() => toggleFilterSection(id)} className="w-full flex justify-between items-center">
        <h3 className="text-sm font-semibold uppercase tracking-wider">{title}</h3>
        {openFilterSections[id] ? <MinusIcon className="w-4 h-4" /> : <PlusIcon className="w-4 h-4" />}
      </button>
      {openFilterSections[id] && <div className="pt-3">{children}</div>}
    </div>
  );
  
  const FilterSidebar = () => (
    <aside>
      <div className="flex justify-between items-center mb-4 lg:hidden">
        <h2 className="text-lg font-semibold">Filter</h2>
        <button onClick={() => setIsFilterOpen(false)}><XIcon/></button>
      </div>

      <div className="py-4 border-b border-medium">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider">Categories</h3>
          {selectedCategorySlug && (
            <Link href="/catalog" className="text-xs text-primary hover:underline font-semibold">
              Reset
            </Link>
          )}
        </div>
        <ul className="space-y-2 text-sm">
          {parentCategory && (
            <li>
              <Link href={`/catalog?category=${parentCategory.slug}`} className="flex items-center text-gray-700 hover:text-primary font-medium">
                <ChevronLeftIcon className="w-4 h-4 mr-1" />
                {parentCategory.name}
              </Link>
            </li>
          )}
          {displayCategories.map(cat => (
            <li key={cat._id || cat.id} style={{ paddingLeft: parentCategory ? '1rem' : '0' }}>
              <Link
                href={`/catalog?category=${cat.slug}`}
                className="block text-gray-700 hover:text-primary"
              >
                {cat.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <FilterSection title="Price" id="price">
        <div className="flex items-center gap-2">
          <input 
            type="number" 
            placeholder="Min" 
            value={priceRange.min} 
            onChange={e => setPriceRange(p => ({ ...p, min: e.target.value }))} 
            className="w-full p-2 border border-medium rounded-sm text-sm" 
          />
          <span>-</span>
          <input 
            type="number" 
            placeholder="Max" 
            value={priceRange.max} 
            onChange={e => setPriceRange(p => ({ ...p, max: e.target.value }))} 
            className="w-full p-2 border border-medium rounded-sm text-sm" 
          />
        </div>
      </FilterSection>
      <FilterSection title="Color" id="color">
        <div className="grid grid-cols-5 gap-2">
          {filterOptions.colors.map(color => (
            <button 
              key={color} 
              onClick={() => handleColorToggle(color)} 
              className={`w-8 h-8 rounded-full border-2 ${selectedColors.includes(color) ? 'border-primary' : 'border-transparent'}`} 
              title={color}
            >
              <div 
                className="w-full h-full rounded-full border border-gray-200" 
                style={{ backgroundColor: color.toLowerCase() === 'white' ? '#f8f8f8' : color.toLowerCase() }}
              />
            </button>
          ))}
        </div>
      </FilterSection>
      <FilterSection title="Tags" id="tags">
        <div className="space-y-2">
          {filterOptions.tags.map(tag => (
            <label key={tag} className="flex items-center space-x-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={selectedTags.includes(tag)} 
                onChange={() => handleTagToggle(tag)} 
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary-500" 
              />
              <span className="text-sm text-gray-700">{tag}</span>
            </label>
          ))}
        </div>
      </FilterSection>
      {Object.entries(filterOptions.specs).map(([label, values]) => (
        <FilterSection title={label} id={label.toLowerCase()} key={label}>
          <div className="space-y-2">
            {values.map(value => (
              <label key={value} className="flex items-center space-x-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={selectedSpecs[label]?.includes(value)} 
                  onChange={() => handleSpecToggle(label, value)} 
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary-500" 
                />
                <span className="text-sm text-gray-700">{value}</span>
              </label>
            ))}
          </div>
        </FilterSection>
      ))}
    </aside>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{currentCategoryName}</h1>
        {searchQuery && <p className="text-gray-500 mt-2">Found {filteredProducts.length} results</p>}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm border-y border-medium my-8 py-4 text-center">
        <div>Express Delivery Dispatch within 24 Hours</div>
        <div className="border-x-0 md:border-x border-medium">Easy Return, COD</div>
        <div>100% Sustainable Packaging</div>
      </div>

      <div className="flex flex-col lg:flex-row gap-12">
        <div className="hidden lg:block w-1/4 xl:w-1/5">
          <FilterSidebar />
        </div>

        {isFilterOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setIsFilterOpen(false)} />
            <div className="relative bg-white w-4/5 max-w-sm h-full shadow-lg p-6 overflow-y-auto">
              <FilterSidebar />
            </div>
          </div>
        )}
        
        <main className="w-full lg:w-3/4 xl:w-4/5">
          <div className="flex justify-between items-center mb-6">
            <button 
              onClick={() => setIsFilterOpen(true)} 
              className="flex items-center gap-2 font-semibold lg:hidden"
            >
              <FilterIcon /> Filter
            </button>
            <div className="hidden lg:block text-sm">{filteredProducts.length} items</div>
            
            <div className="flex items-center gap-2">
              <label htmlFor="sort" className="text-sm">Sort by:</label>
              <select 
                id="sort" 
                value={sortBy} 
                onChange={e => setSortBy(e.target.value)} 
                className="border border-medium rounded-sm p-2 text-sm"
              >
                <option value="newest">Date, new to old</option>
                <option value="price-asc">Price, low to high</option>
                <option value="price-desc">Price, high to low</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-3 gap-4 md:gap-8">
              {Array.from({ length: 6 }).map((_, index) => (
                <ProductCardSkeleton key={`skeleton-${index}`} />
              ))}
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-3 gap-4 md:gap-8">
              {filteredProducts.map(product => (
                <ProductCard key={product._id || product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <h3 className="text-2xl font-semibold">No Products Found</h3>
              <p className="text-gray-500 mt-2">Try adjusting your filters or search term.</p>
              {searchQuery && (
                <Link href="/catalog" className="mt-4 inline-block text-primary font-medium hover:underline">
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

