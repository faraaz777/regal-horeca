'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

function normalizeSearch(text) {
  return String(text || '').toLowerCase().trim();
}

function matchesQuery(option, query) {
  if (!query) return true;
  const q = normalizeSearch(query);
  const haystack = normalizeSearch(
    [option.label, option.searchText, option.meta].filter(Boolean).join(' ')
  );
  return haystack.includes(q);
}

/**
 * @param {{
 *   options?: { value: string; label: string; searchText?: string; meta?: string }[];
 *   value?: string;
 *   onChange?: (value: string) => void;
 *   disabled?: boolean;
 *   placeholder?: string;
 *   emptyOption?: { value?: string; label: string; searchText?: string } | null;
 *   className?: string;
 *   inputClassName?: string;
 *   maxHeight?: number;
 * }} props
 */
export default function SearchableSelect({
  options = [],
  value = '',
  onChange,
  disabled = false,
  placeholder = 'Search…',
  emptyOption = null,
  className = '',
  inputClassName = '',
  maxHeight = 240,
}) {
  const listId = useId();
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedOption = useMemo(
    () => options.find((o) => String(o.value) === String(value)),
    [options, value]
  );

  const filtered = useMemo(() => {
    const list = options.filter((o) => matchesQuery(o, query));
    if (emptyOption && matchesQuery(emptyOption, query)) {
      return [{ value: emptyOption.value ?? '', label: emptyOption.label, isEmpty: true }, ...list];
    }
    return list;
  }, [options, query, emptyOption]);

  useEffect(() => {
    if (!open) {
      setQuery(selectedOption?.label || '');
    }
  }, [value, selectedOption, open]);

  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  const pick = useCallback(
    (nextValue) => {
      onChange?.(nextValue);
      setOpen(false);
      const opt = options.find((o) => String(o.value) === String(nextValue));
      setQuery(opt?.label || '');
    },
    [onChange, options]
  );

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setOpen(false);
      setQuery(selectedOption?.label || '');
      inputRef.current?.blur();
      return;
    }
    if (e.key === 'Enter' && open && filtered.length > 0) {
      e.preventDefault();
      pick(filtered[0].value);
    }
  };

  const displayValue = open ? query : selectedOption?.label || '';

  const defaultInputClass =
    'w-full px-3 py-2 pr-9 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:bg-gray-50 disabled:text-gray-400';

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          disabled={disabled}
          placeholder={placeholder}
          value={displayValue}
          className={inputClassName || defaultInputClass}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery('');
          }}
          onKeyDown={handleKeyDown}
        />
        <ChevronDown
          size={16}
          className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </div>

      {open && !disabled && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-y-auto"
          style={{ maxHeight }}
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2.5 text-xs text-gray-400">No matches</li>
          ) : (
            filtered.map((opt) => {
              const selected = String(opt.value) === String(value);
              return (
                <li key={opt.value || '__empty__'}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(opt.value)}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      selected
                        ? 'bg-emerald-50 text-emerald-900 font-medium'
                        : 'text-gray-800 hover:bg-gray-50'
                    } ${opt.isEmpty ? 'text-gray-500 italic' : ''}`}
                  >
                    <span className="block truncate">{opt.label}</span>
                    {opt.meta && !opt.isEmpty && (
                      <span className="block text-[10px] text-gray-400 truncate mt-0.5">{opt.meta}</span>
                    )}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
