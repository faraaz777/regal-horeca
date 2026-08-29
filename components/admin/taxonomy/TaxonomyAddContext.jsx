'use client';

import { formatTaxonomyLevelLabel } from './taxonomyMenuLayout';

/**
 * Context label for same-level add rows — clarifies where the new item goes.
 */
export default function TaxonomyAddContext({ level, parentName }) {
  const levelLabel = formatTaxonomyLevelLabel(level);

  return (
    <div className="min-w-0">
      <div className="text-sm font-medium text-primary">Add {levelLabel}</div>
      <div className="text-[11px] text-gray-500 truncate">
        {parentName ? `Same level · under ${parentName}` : 'Top level'}
      </div>
    </div>
  );
}
