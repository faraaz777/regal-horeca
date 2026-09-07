'use client';

import TaxonomyMenuBuilder from './TaxonomyMenuBuilder';

/**
 * Shared admin page for Categories and Brands.
 *
 * Both routes use the same menu builder. Entity differences live in
 * CATEGORY_TAXONOMY_CONFIG / BRAND_TAXONOMY_CONFIG — not in page JSX.
 */
export default function TaxonomyAdminPage({ config }) {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-gray-800 sm:text-3xl">{config.title}</h1>
      <TaxonomyMenuBuilder config={config} />
    </div>
  );
}
