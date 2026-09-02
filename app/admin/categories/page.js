'use client';

import {
  CATEGORY_TAXONOMY_CONFIG,
  BRAND_TAXONOMY_CONFIG,
} from '@/lib/taxonomy/taxonomyConfig';
import TaxonomyMenuBuilder from '@/components/admin/taxonomy/TaxonomyMenuBuilder';
import TaxonomyUiToggle from '@/components/admin/taxonomy/TaxonomyUiToggle';
import LegacyCategoriesView from '@/components/admin/taxonomy/legacy/LegacyCategoriesView';
import { useTaxonomyUiMode } from '@/components/admin/taxonomy/hooks/useTaxonomyUiMode';

/**
 * Admin Categories Page — classic table or menu builder (toggle persisted in localStorage).
 */
export default function AdminCategoriesPage() {
  const [mode, setMode, hydrated] = useTaxonomyUiMode();

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {mode === 'menu-builder' && hydrated && (
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">{CATEGORY_TAXONOMY_CONFIG.title}</h1>
        )}
        <div className={`${mode === 'classic' ? 'ml-auto' : ''}`}>
          <TaxonomyUiToggle mode={mode} onChange={setMode} hydrated={hydrated} />
        </div>
      </div>

      {!hydrated ? (
        <div className="rounded-lg border border-gray-200 bg-white px-6 py-12 text-center text-gray-500">
          Loading…
        </div>
      ) : mode === 'classic' ? (
        <LegacyCategoriesView />
      ) : (
        <TaxonomyMenuBuilder config={CATEGORY_TAXONOMY_CONFIG} />
      )}
    </div>
  );
}
