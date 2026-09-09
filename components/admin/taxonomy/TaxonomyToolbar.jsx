'use client';

import { SearchIcon } from '@/components/Icons';

/**
 * Search and expand/collapse controls for the taxonomy menu list.
 */
export default function TaxonomyToolbar({
  search,
  onSearchChange,
  itemCount,
  responseKey,
  onExpandAll,
  onCollapseAll,
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative max-w-md flex-1">
        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={`Search ${responseKey}…`}
          className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
        <span className="text-gray-500">{itemCount} items</span>
        <button
          type="button"
          onClick={onExpandAll}
          className="rounded border border-gray-200 px-2.5 py-1.5 text-gray-600 hover:bg-gray-50"
        >
          Expand all
        </button>
        <button
          type="button"
          onClick={onCollapseAll}
          className="rounded border border-gray-200 px-2.5 py-1.5 text-gray-600 hover:bg-gray-50"
        >
          Collapse all
        </button>
      </div>
    </div>
  );
}
