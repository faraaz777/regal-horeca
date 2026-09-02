'use client';

import { TAXONOMY_DRAG_COL_W } from './taxonomyMenuLayout';

/**
 * Shared row chrome: drag column + tree indent slot + main content.
 */
export default function TaxonomyRowShell({
  isParent = false,
  isExpanded = false,
  variant = 'item',
  dragHandle,
  treeIndent,
  children,
}) {
  const isAddRow = variant === 'add';

  return (
    <div
      className={[
        'group flex items-stretch border-b border-gray-100 transition-colors',
        isAddRow ? 'bg-slate-50/80' : 'bg-white hover:bg-gray-50/60',
        isParent && isExpanded && !isAddRow ? 'bg-gray-50/45' : '',
      ].join(' ')}
    >
      <div
        className="flex shrink-0 items-center justify-center border-r border-gray-100/80 bg-gray-50/40"
        style={{ width: TAXONOMY_DRAG_COL_W }}
      >
        {dragHandle}
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-2 py-2.5 pl-2 pr-2 sm:pr-3">
        {treeIndent}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
