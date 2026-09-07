'use client';

import { BRAND_TAXONOMY_CONFIG } from '@/lib/taxonomy/taxonomyConfig';
import TaxonomyAdminPage from '@/components/admin/taxonomy/TaxonomyAdminPage';

/**
 * Admin Brands — nested menu builder (department → subcategory).
 */
export default function AdminBrandsPage() {
  return <TaxonomyAdminPage config={BRAND_TAXONOMY_CONFIG} />;
}
