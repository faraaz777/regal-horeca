'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { CATALOG_PREDEFINED_COLORS, getCatalogColorSwatchStyle } from '@/lib/shared/catalogColors';
import {
  ARTICLE_MAINTAINED,
  ARTICLE_NON_MAINTAINED,
  STOCK_DEAD,
  STOCK_LOW,
  STOCK_OK,
  STOCK_OVER,
} from '@/lib/shared/maintainedArticle';

const STOCK_CHOICES = [
  { id: '', label: 'Any' },
  { id: STOCK_LOW, label: 'Low', dot: 'bg-rose-500' },
  { id: STOCK_OK, label: 'In range', dot: 'bg-sky-500' },
  { id: STOCK_OVER, label: 'Over', dot: 'bg-violet-500' },
  { id: STOCK_DEAD, label: 'Dead', dot: 'bg-gray-500' },
];

const ARTICLE_CHOICES = [
  { id: '', label: 'Any' },
  { id: ARTICLE_MAINTAINED, label: 'Maintained', dot: 'bg-emerald-600' },
  { id: ARTICLE_NON_MAINTAINED, label: 'Non-maintained', dot: 'bg-amber-500' },
];

function filtersMatch(left, right) {
  return left.brand === right.brand
    && left.categoryId === right.categoryId
    && left.subCategoryId === right.subCategoryId
    && left.articleStatus === right.articleStatus
    && left.stockStatus === right.stockStatus
    && left.color === right.color;
}

function hasFilter(filters) {
  return Boolean(
    filters.brand
    || filters.categoryId
    || filters.subCategoryId
    || filters.articleStatus
    || filters.stockStatus
    || filters.color
  );
}

function Rail({ label, children }) {
  return (
    <div className="flex items-center gap-2 min-h-8">
      <span className="w-16 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</span>
      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
    </div>
  );
}

function RadioGroup({ label, value, options, onChange }) {
  return (
    <Rail label={label}>
      <div className="flex gap-1" role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const checked = value === option.id;
          return (
            <button
              key={option.label}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => onChange(option.id)}
              className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2 text-xs ${
                checked ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200' : 'text-gray-500 hover:bg-white/70'
              }`}
            >
              <span
                className={`h-3.5 w-3.5 rounded-full border ${
                  checked ? 'border-emerald-700' : 'border-gray-300'
                }`}
              >
                {checked ? (
                  <span className={`block h-full w-full scale-50 rounded-full ${option.dot || 'bg-emerald-700'}`} />
                ) : null}
              </span>
              {option.label}
            </button>
          );
        })}
      </div>
    </Rail>
  );
}

/**
 * Brand and category use one menu: type to narrow, then one click.
 * The list stays short, so a long catalog does not become a swipe row.
 */
function Picker({ label, selectedId, display, placeholder, options, disabled, onChange }) {
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => option.label.toLowerCase().includes(needle));
  }, [options, query]);

  useEffect(() => {
    if (!open) return undefined;
    inputRef.current?.focus();
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (id) => {
    onChange(id);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={rootRef} className={`relative min-w-0 ${open ? 'z-30' : ''}`}>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        onClick={() => {
          if (disabled) return;
          setOpen((current) => !current);
          setQuery('');
        }}
        className={`flex h-9 w-full items-center gap-2 rounded-xl bg-white px-2.5 text-left ring-1 ${
          open ? 'ring-gray-900' : 'ring-gray-200'
        } ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:ring-gray-300'}`}
      >
        <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</span>
        <span className={`min-w-0 flex-1 truncate text-sm ${display ? 'text-gray-900' : 'text-gray-400'}`}>
          {display || placeholder}
        </span>
        <ChevronDown size={14} className={`shrink-0 text-gray-400 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-gray-200">
          <div className="border-b border-gray-100 p-1.5">
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Find ${label.toLowerCase()}`}
              className="h-8 w-full rounded-lg bg-gray-50 px-2.5 text-sm outline-none"
            />
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            <li>
              <button
                type="button"
                onClick={() => choose('')}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-500 hover:bg-gray-50"
              >
                <Check size={14} className={selectedId ? 'opacity-0' : 'text-emerald-700'} />
                Any
              </button>
            </li>
            {shown.map((option) => {
              const selected = option.id === selectedId;
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    onClick={() => choose(option.id)}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50 ${
                      selected ? 'bg-emerald-50 text-gray-900' : 'text-gray-700'
                    }`}
                  >
                    <Check size={14} className={selected ? 'text-emerald-700' : 'opacity-0'} />
                    <span className="truncate">{option.label}</span>
                  </button>
                </li>
              );
            })}
            {shown.length === 0 ? <li className="px-3 py-2 text-sm text-gray-400">Nothing matches.</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Brand and category are typed menus. Article and stock stay radios.
 * Color stays a swipe. Enter in search does not apply the filters.
 */
export default function BrandReportFilterBar({
  search,
  onSearchChange,
  onSearch,
  draft,
  appliedFilters,
  onChange,
  onApply,
  brands,
  categories,
}) {
  const dirty = !filtersMatch(draft, appliedFilters);
  const settled = !dirty && hasFilter(appliedFilters);
  const categoryList = categories.filter((item) => item.level === 'category');
  const subList = categories.filter(
    (item) => item.level === 'subcategory' && item.parentId === draft.categoryId
  );

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2 space-y-1">
      <div className="flex items-center gap-2 pb-1">
        <form
          className="relative min-w-0 flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            onSearch();
          }}
        >
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search, then Enter"
            aria-label="Search products"
            className="h-8 w-full rounded-full border border-transparent bg-white pl-8 pr-3 text-sm outline-none ring-1 ring-gray-200 focus:ring-gray-400"
          />
        </form>
        <button
          type="button"
          onClick={onApply}
          className={`h-8 shrink-0 rounded-full px-3 text-xs font-semibold ${
            dirty || !settled ? 'bg-emerald-700 text-white' : 'bg-white text-emerald-800 ring-1 ring-emerald-200'
          }`}
        >
          {dirty || !settled ? 'Apply' : 'Applied'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Picker
          label="Brand"
          selectedId={draft.brand}
          display={draft.brand}
          placeholder="Any brand"
          options={brands.map((brand) => ({ id: brand, label: brand }))}
          onChange={(brand) => onChange({ brand })}
        />
        <Picker
          label="Category"
          selectedId={draft.categoryId}
          display={categoryList.find((item) => item.id === draft.categoryId)?.name || ''}
          placeholder="Any category"
          options={categoryList.map((item) => ({ id: item.id, label: item.name }))}
          onChange={(categoryId) => onChange({ categoryId, subCategoryId: '' })}
        />
        <Picker
          label="Inside"
          selectedId={draft.subCategoryId}
          display={subList.find((item) => item.id === draft.subCategoryId)?.name || ''}
          placeholder={draft.categoryId ? 'Any sub-category' : 'Pick a category'}
          options={subList.map((item) => ({ id: item.id, label: item.name }))}
          disabled={!draft.categoryId}
          onChange={(subCategoryId) => onChange({ subCategoryId })}
        />
      </div>

      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <RadioGroup
            label="Article"
            value={draft.articleStatus}
            options={ARTICLE_CHOICES}
            onChange={(articleStatus) => onChange({ articleStatus })}
          />
        </div>
        <div className="min-w-0 flex-1">
          <RadioGroup
            label="Stock"
            value={draft.stockStatus}
            options={STOCK_CHOICES}
            onChange={(stockStatus) => onChange({ stockStatus })}
          />
        </div>
      </div>

      <Rail label="Color">
        <button
          type="button"
          onClick={() => onChange({ color: '' })}
          className={`h-7 shrink-0 rounded-full px-2 text-xs ${!draft.color ? 'bg-gray-900 text-white' : 'text-gray-500'}`}
        >
          Any
        </button>
        {CATALOG_PREDEFINED_COLORS.map((color) => {
          const selected = draft.color === color;
          return (
            <button
              key={color}
              type="button"
              title={color}
              aria-label={color}
              aria-pressed={selected}
              onClick={() => onChange({ color })}
              className={`h-6 w-6 shrink-0 rounded-full border border-gray-200 ${
                selected ? 'ring-2 ring-gray-900 ring-offset-1' : ''
              }`}
              style={getCatalogColorSwatchStyle(color)}
            />
          );
        })}
      </Rail>
    </div>
  );
}
