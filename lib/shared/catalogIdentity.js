/**
 * Parent and standalone products must name a brand and sit in a department.
 *
 * categoryId is whatever level the existing cascade last selected.
 * Choosing a department is enough; deeper levels stay optional.
 * This does not change brand-tree matching or how departments unlock
 * category, subcategory, and type.
 *
 * Child SKUs copy both fields from the parent, so callers skip this
 * check when productType is child.
 */
export function catalogIdentityGap({ brand, categoryId } = {}) {
  const name = String(brand || '').trim();
  const category = categoryId && typeof categoryId === 'object'
    ? categoryId._id || categoryId.id
    : categoryId;
  const hasCategory = Boolean(category && String(category).trim());

  if (!name && !hasCategory) return 'Brand and a department are required.';
  if (!name) return 'Brand is required.';
  if (!hasCategory) return 'Select a department.';
  return '';
}
