'use client';

/**
 * Toggle between classic table UI and Shopify-style menu builder.
 */
export default function TaxonomyUiToggle({ mode, onChange, hydrated }) {
  if (!hydrated) return null;

  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-xs sm:text-sm">
      <button
        type="button"
        onClick={() => onChange('menu-builder')}
        className={`px-2.5 sm:px-3 py-1.5 rounded-md font-medium transition-colors ${
          mode === 'menu-builder'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        Menu builder
      </button>
      <button
        type="button"
        onClick={() => onChange('classic')}
        className={`px-2.5 sm:px-3 py-1.5 rounded-md font-medium transition-colors ${
          mode === 'classic'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        Classic
      </button>
    </div>
  );
}
