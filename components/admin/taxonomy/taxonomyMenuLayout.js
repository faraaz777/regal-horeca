/** Shared layout tokens for taxonomy menu builder rows. */

export const TAXONOMY_DRAG_COL_W = 36;
export const TAXONOMY_INDENT_PX = 24;
export const TAXONOMY_GUIDE_COL_W = 20;

/** Very subtle level badge colors — bg / border / text */
const LEVEL_BADGE_STYLES = {
  department: 'bg-slate-50 border-slate-200/80 text-slate-600',
  category: 'bg-stone-50 border-stone-200/70 text-stone-600',
  subcategory: 'bg-teal-50/70 border-teal-200/60 text-teal-700/80',
  type: 'bg-violet-50/70 border-violet-200/60 text-violet-700/75',
};

/** @param {string} level */
export function formatTaxonomyLevelLabel(level) {
  if (!level) return 'Item';
  return level.charAt(0).toUpperCase() + level.slice(1);
}

/** @param {string} level */
export function getTaxonomyLevelBadgeClass(level) {
  return LEVEL_BADGE_STYLES[level] || 'bg-gray-50 border-gray-200 text-gray-500';
}
