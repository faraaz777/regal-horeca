/**
 * Persist effective brand collection on child SKUs.
 *
 * Parent brandCategoryId = default. Parent brandCategoryIds = allowed overrides.
 * Children never receive the full additional array as membership.
 */

import Brand from '@/lib/models/Brand';
import { resolveChildBrandCategoryId } from '@/lib/shared/brandCollection';

export async function resolveAndValidateChildBrandCategoryId({
  requestedId,
  parent,
}) {
  const brands = await Brand.find({})
    .select('_id name level parent')
    .lean();

  return resolveChildBrandCategoryId({
    requestedId,
    parentBrandCategoryId: parent?.brandCategoryId,
    additionalBrandCategoryIds: parent?.brandCategoryIds || [],
    brands,
  });
}
