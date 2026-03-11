'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PlusIcon, MinusIcon, XIcon, ChevronLeftIcon } from '@/components/Icons';
import '@/components/new/SidebarFilter.css';

const COLOR_HEX_MAP = {
  blue: '#3B82F6',
  green: '#10B981',
  red: '#EF4444',
  yellow: '#F59E0B',
  purple: '#8B5CF6',
  orange: '#F97316',
  pink: '#EC4899',
  brown: '#92400E',
  gray: '#6B7280',
  grey: '#6B7280',
  black: '#121212',
  white: '#FAFAF9',
  silver: '#9CA3AF',
};

function getColorHex(colorName) {
  return COLOR_HEX_MAP[colorName?.toLowerCase()] || '#CCCCCC';
}

function FilterSection({ title, id, children, count, isOpen, onToggle }) {
  const hasItems = count !== undefined ? count > 0 : true;
  if (!hasItems) return null;

  return (
    <div className="filter-section">
      <button onClick={() => onToggle(id)} className="w-full flex justify-between items-center group">
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
      {isOpen && <div className="pt-4">{children}</div>}
    </div>
  );
}

export default function CatalogFilterSidebar({
  onClose,
  selectedCategorySlug,
  hasActiveFilters,
  parentCategory,
  displayCategories,
  facets,
  priceRange,
  selectedColors,
  selectedBrands,
  selectedFilters,
  openFilterSections,
  toggleFilterSection,
  onPriceMinChange,
  onPriceMaxChange,
  onColorToggle,
  onBrandToggle,
  onFilterToggle,
  onClearAllFilters,
  getFilterCount,
}) {
  const router = useRouter();

  const handleReset = () => {
    router.push('/catalog');
  };

  return (
    <aside className="sidebar-container">
      <div className="flex justify-between items-center mb-6 lg:hidden">
        <h2 className="text-xl font-bold tracking-tight">Filters</h2>
        <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full transition-colors">
          <XIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="category-section first:pt-0">
        <div className="flex justify-between items-center mb-4">
          <h3 className="filter-section-title">Categories</h3>
          {(selectedCategorySlug || hasActiveFilters) && (
            <button
              onClick={handleReset}
              className="text-[10px] uppercase tracking-wider text-accent hover:text-black transition-colors font-bold"
            >
              Reset
            </button>
          )}
        </div>
        <ul className="category-list">
          {parentCategory ? (
            <li>
              <Link href={`/catalog?category=${parentCategory.slug}`} className="category-link opacity-40 hover:opacity-100">
                <ChevronLeftIcon className="w-4 h-4 mr-1" />
                {parentCategory.name}
              </Link>
            </li>
          ) : selectedCategorySlug ? (
            <li>
              <Link href="/catalog" className="category-link opacity-40 hover:opacity-100">
                <ChevronLeftIcon className="w-4 h-4 mr-1" />
                All Products
              </Link>
            </li>
          ) : null}
          {(displayCategories || []).map((cat) => (
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

      <FilterSection
        title="Price"
        id="price"
        count={facets?.priceRange?.min !== facets?.priceRange?.max ? undefined : 0}
        isOpen={openFilterSections?.price !== false}
        onToggle={toggleFilterSection}
      >
        <div className="space-y-4">
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-black/40">
            <span>Min</span>
            <span>Max</span>
          </div>
          <div className="price-input-group">
            <input
              type="number"
              placeholder={facets?.priceRange?.min}
              value={priceRange?.min ?? ''}
              onChange={(e) => onPriceMinChange?.(e.target.value)}
              className="price-field"
            />
            <div className="price-divider" />
            <input
              type="number"
              placeholder={facets?.priceRange?.max}
              value={priceRange?.max ?? ''}
              onChange={(e) => onPriceMaxChange?.(e.target.value)}
              className="price-field"
            />
          </div>
        </div>
      </FilterSection>

      {facets?.brands?.length > 0 && (
        <FilterSection
          title="Brand"
          id="brand"
          count={facets.brands.length}
          isOpen={openFilterSections?.brand !== false}
          onToggle={toggleFilterSection}
        >
          <div className="space-y-1 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
            {facets.brands.map((brand) => {
              const count = getFilterCount?.('brand', brand) ?? 0;
              const isSelected = selectedBrands?.includes(brand);
              const isDisabled = count === 0 && !isSelected;
              return (
                <label
                  key={brand}
                  className={`custom-checkbox-container ${isDisabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={!!isSelected}
                    onChange={() => !isDisabled && onBrandToggle?.(brand)}
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

      {facets?.colors?.length > 0 && (
        <FilterSection
          title="Color"
          id="color"
          count={facets.colors.length}
          isOpen={openFilterSections?.color !== false}
          onToggle={toggleFilterSection}
        >
          <div className="color-swatch-grid">
            {facets.colors.map((color) => {
              const count = getFilterCount?.('color', color) ?? 0;
              const isSelected = selectedColors?.includes(color);
              const isDisabled = count === 0 && !isSelected;
              return (
                <button
                  key={color}
                  onClick={() => !isDisabled && onColorToggle?.(color)}
                  disabled={isDisabled}
                  className={`color-swatch-btn ${isSelected ? 'active' : ''} ${isDisabled ? 'opacity-20 cursor-not-allowed' : ''}`}
                  title={`${color}${count > 0 ? ` (${count})` : ''}`}
                >
                  <div className="color-swatch-circle" style={{ backgroundColor: getColorHex(color) }} />
                  <span className="color-swatch-label">{color}</span>
                </button>
              );
            })}
          </div>
        </FilterSection>
      )}

      {facets?.filters &&
        Object.entries(facets.filters).map(([key, values]) => (
          <FilterSection
            key={key}
            title={key}
            id={key.toLowerCase().replace(/\s+/g, '-')}
            count={values?.length}
            isOpen={openFilterSections?.[key.toLowerCase().replace(/\s+/g, '-')] !== false}
            onToggle={toggleFilterSection}
          >
            <div className="space-y-1 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
              {(values || []).map(({ value, count: filterCount }) => {
                const isSelected = selectedFilters?.[key]?.includes(value) || false;
                const isDisabled = filterCount === 0 && !isSelected;
                return (
                  <label
                    key={value}
                    className={`custom-checkbox-container ${isDisabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => !isDisabled && onFilterToggle?.(key, value)}
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
    </aside>
  );
}
