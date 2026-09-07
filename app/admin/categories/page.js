'use client';

import { CATEGORY_TAXONOMY_CONFIG } from '@/lib/taxonomy/taxonomyConfig';
import TaxonomyAdminPage from '@/components/admin/taxonomy/TaxonomyAdminPage';

/**
 * Admin Categories — nested menu builder (department → type).
 */
export default function AdminCategoriesPage() {
  return <TaxonomyAdminPage config={CATEGORY_TAXONOMY_CONFIG} />;
}
