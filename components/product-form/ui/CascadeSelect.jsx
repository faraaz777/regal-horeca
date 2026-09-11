'use client';

import { CATEGORY_LEVEL_ORDER } from '@/components/product-form/constants';
import { getChildrenByParent } from '@/components/product-form/lib/taxonomyAncestry';

const LABELS = {
  department: 'Department',
  category: 'Category',
  subcategory: 'Subcategory',
  type: 'Type',
};

/**
 * Cascading taxonomy selects.
 *
 * Each filled select unlocks the next; connectors show the chain.
 * Presentation stays light so it matches the rest of the product form.
 */
export default function CascadeSelect({
  nodes,
  selection,
  onChange,
  levels = CATEGORY_LEVEL_ORDER,
  disabled = false,
  presentation = 'linked',
}) {
  const useLinked = presentation !== 'plain';

  if (!useLinked) {
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {levels.map((level, index) => {
          const parentLevel = index === 0 ? null : levels[index - 1];
          const parentId = parentLevel ? selection[parentLevel] : null;
          const options =
            index === 0
              ? (nodes || []).filter((n) => n.level === level)
              : parentId
                ? getChildrenByParent(nodes, parentId)
                : [];
          const isDisabled = disabled || (index > 0 && !parentId);

          return (
            <label key={level} className="block min-w-0">
              <span className="mb-1 block text-xs font-medium text-gray-700">
                {LABELS[level] || level}
              </span>
              <select
                value={selection[level] || ''}
                disabled={isDisabled}
                onChange={(e) => onChange(level, e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white p-2 text-sm shadow-sm focus:border-primary focus:ring-2 focus:ring-primary disabled:bg-gray-100"
              >
                <option value="">Select {LABELS[level]?.toLowerCase() || level}</option>
                {options.map((node) => {
                  const id = node._id || node.id;
                  return (
                    <option key={id} value={id}>
                      {node.name}
                    </option>
                  );
                })}
              </select>
            </label>
          );
        })}
      </div>
    );
  }

  const deepestFilled = levels.reduce((acc, level, index) => (selection[level] ? index : acc), -1);
  const nextOpen = deepestFilled + 1;

  return (
    <div className="w-full">
      {/* Linked selects: shared border, hairline joins, active edge on the open step */}
      <div className="flex flex-col overflow-hidden rounded-lg border border-gray-300 bg-white sm:flex-row">
        {levels.map((level, index) => {
          const parentLevel = index === 0 ? null : levels[index - 1];
          const parentId = parentLevel ? selection[parentLevel] : null;
          const options =
            index === 0
              ? (nodes || []).filter((n) => n.level === level)
              : parentId
                ? getChildrenByParent(nodes, parentId)
                : [];
          const isDisabled = disabled || (index > 0 && !parentId);
          const filled = Boolean(selection[level]);
          const isNext = !isDisabled && !filled && index === nextOpen;

          return (
            <div
              key={level}
              className={`relative min-w-0 flex-1 ${
                index > 0 ? 'border-t border-gray-200 sm:border-t-0 sm:border-l sm:border-gray-200' : ''
              }`}
            >
              <label className="flex h-full flex-col px-2 pb-2 pt-1.5">
                <span className="mb-1 flex items-center justify-between gap-1">
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-[0.07em] ${
                      isNext ? 'text-gray-900' : filled ? 'text-gray-600' : 'text-gray-400'
                    }`}
                  >
                    {LABELS[level] || level}
                  </span>
                  {filled ? (
                    <span className="text-[9px] font-medium text-emerald-600">set</span>
                  ) : isNext ? (
                    <span className="text-[9px] font-semibold text-gray-500">next</span>
                  ) : isDisabled ? (
                    <span className="text-[9px] text-gray-300">locked</span>
                  ) : null}
                </span>

                {/* Anchor connectors to the select row so they sit mid-dropdown, not mid-cell */}
                <div className="relative">
                  {index > 0 ? (
                    <span
                      className="pointer-events-none absolute -left-[14px] top-1/2 z-10 hidden h-3 w-3 -translate-y-1/2 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-400 sm:flex"
                      aria-hidden
                    >
                      <svg viewBox="0 0 10 10" className="h-1.5 w-1.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3.5 1.5 L6.5 5 L3.5 8.5" />
                      </svg>
                    </span>
                  ) : null}

                  <select
                    value={selection[level] || ''}
                    disabled={isDisabled}
                    onChange={(e) => onChange(level, e.target.value)}
                    className={`h-8 w-full appearance-none truncate rounded border bg-[length:10px] bg-[right_0.5rem_center] bg-no-repeat px-2 pr-7 text-[12px] leading-none outline-none transition-colors focus:ring-1 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 ${
                      isNext
                        ? 'border-gray-900 bg-white text-gray-900 focus:border-gray-900 focus:ring-gray-900/15'
                        : filled
                          ? 'border-gray-300 bg-white text-gray-900 focus:border-gray-700 focus:ring-gray-700/10'
                          : 'border-gray-200 bg-white text-gray-500 focus:border-gray-400 focus:ring-gray-200'
                    }`}
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                    }}
                  >
                    <option value="">
                      {isDisabled ? '—' : 'Select'}
                    </option>
                    {options.map((node) => {
                      const id = node._id || node.id;
                      return (
                        <option key={id} value={id}>
                          {node.name}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
