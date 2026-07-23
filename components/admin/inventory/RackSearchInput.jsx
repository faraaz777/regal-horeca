'use client';

import { Search } from 'lucide-react';

/**
 * Compact rack filter — always visible above floor rack lists.
 */
export default function RackSearchInput({
  value,
  onChange,
  accent = 'emerald',
  className = '',
}) {
  const focusRing =
    accent === 'emerald'
      ? 'focus:border-emerald-500 focus:ring-emerald-200'
      : accent === 'sky'
        ? 'focus:border-sky-500 focus:ring-sky-200'
        : 'focus:border-gray-400 focus:ring-gray-200';

  return (
    <label className={`relative block ${className}`}>
      <Search
        size={13}
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search racks by code, name, or id…"
        aria-label="Search racks"
        className={`w-full pl-8 pr-2.5 py-2 text-xs border border-gray-300 rounded-md bg-gray-50 text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:ring-2 ${focusRing}`}
      />
    </label>
  );
}
