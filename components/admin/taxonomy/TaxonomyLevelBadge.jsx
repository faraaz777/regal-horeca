'use client';

import { formatTaxonomyLevelLabel, getTaxonomyLevelBadgeClass } from './taxonomyMenuLayout';

/**
 * Subtle level badge — department, category, subcategory, type each with a distinct muted tint.
 */
export default function TaxonomyLevelBadge({ level, className = '' }) {
  return (
    <span
      className={[
        'shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        getTaxonomyLevelBadgeClass(level),
        className,
      ].join(' ')}
    >
      {formatTaxonomyLevelLabel(level)}
    </span>
  );
}
