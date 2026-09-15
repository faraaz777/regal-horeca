'use client';

import RichTextEditor from '@/components/RichTextEditor';
import { PlusIcon, TrashIcon } from '@/components/Icons';
import FormCard from '@/components/product-form/ui/FormCard';
import CascadeSelect from '@/components/product-form/ui/CascadeSelect';
import FormAccordion from '@/components/product-form/ui/FormAccordion';
import { BRAND_LEVEL_ORDER, LOCKED_CHILD_FIELD_CLASS } from '@/components/product-form/constants';
import { getBrandAncestry } from '@/components/product-form/lib/taxonomyAncestry';
import { getTextLength } from '@/components/product-form/lib/formatters';
import { useProductForm } from '@/components/product-form/ProductFormContext';

/**
 * Resolve brandSelection ids to a readable path so operators can see
 * which leaf they linked even when the input shows the department name.
 */
function formatBrandTreePath(selection, brands) {
  if (!selection || !brands?.length) return '';
  return BRAND_LEVEL_ORDER.map((level) => {
    const id = selection[level];
    if (!id) return null;
    const node = brands.find((b) => {
      const nodeId = b._id || b.id;
      return nodeId?.toString() === id.toString();
    });
    return node?.name || null;
  })
    .filter(Boolean)
    .join(' → ');
}

function AiCopyButton({ value, title, onClick, loading, cooldown }) {
  const disabled = loading || cooldown || !title || title.trim().length < 3;
  const improve = getTextLength(value) > 20;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
        disabled
          ? 'cursor-not-allowed border-gray-200 bg-white text-gray-400'
          : 'border-gray-200 bg-white text-gray-800 hover:border-neutral-900 hover:bg-neutral-900 hover:text-white'
      }`}
      title={
        !title || title.trim().length < 3
          ? 'Enter product title first'
          : improve
            ? 'Improve existing copy'
            : 'Generate copy'
      }
    >
      {loading ? 'Generating…' : improve ? 'Improve' : 'Generate'}
    </button>
  );
}

export default function ProductIdentitySection() {
  const {
    formData,
    handleChange,
    setFormData,
    isChildProduct,
    handleAIGenerate,
    aiLoading,
    aiCooldown,
    brandInputRef,
    handleBrandInputChange,
    setBrandInputFocused,
    getBrandSuggestions,
    setBrandSuggestions,
    setShowBrandSuggestions,
    showBrandSuggestions,
    brandSuggestions,
    brandSuggestionsRef,
    handleBrandSuggestionSelect,
    categories,
    brands,
    businessTypes,
    categorySelection,
    handleCategoryChange,
    additionalCategorySelections,
    handleAdditionalCategoryChange,
    addAdditionalCategory,
    removeAdditionalCategory,
    brandSelection,
    additionalBrandSelections,
    handleAdditionalBrandCategoryChange,
    addAdditionalBrandCategory,
    removeAdditionalBrandCategory,
    handleBusinessTypeChange,
  } = useProductForm();

  const linkedBrandPath = (() => {
    if (!formData.brandCategoryId) return '';
    const hasSelection =
      brandSelection?.department || brandSelection?.category || brandSelection?.subcategory;
    const selection = hasSelection
      ? brandSelection
      : getBrandAncestry(formData.brandCategoryId, brands || []);
    return formatBrandTreePath(selection, brands || []);
  })();

  return (
    <div className="space-y-4">
      <FormCard
        compact
        title="Product identity"
        description="Names and taxonomy used across catalog, search, and child SKUs."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Product name *</label>
            <input
              name="title"
              value={formData.title}
              onChange={handleChange}
              disabled={isChildProduct}
              className={`w-full rounded-lg border border-gray-300 p-2.5 text-sm shadow-sm focus:border-primary focus:ring-2 focus:ring-primary ${LOCKED_CHILD_FIELD_CLASS}`}
              placeholder={isChildProduct ? 'Edit name on the parent Variants table' : 'e.g. Milano Pressure Cooker'}
              required={!isChildProduct}
            />
          </div>

          <div className="relative" ref={brandInputRef}>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Brand</label>
            <input
              name="brand"
              value={formData.brand}
              onChange={handleBrandInputChange}
              onFocus={() => {
                setBrandInputFocused(true);
                if (formData.brand && formData.brand.trim().length >= 2) {
                  const suggestions = getBrandSuggestions(formData.brand);
                  setBrandSuggestions(suggestions);
                  setShowBrandSuggestions(suggestions.length > 0);
                }
              }}
              className="w-full rounded-lg border border-gray-300 p-2.5 text-sm shadow-sm focus:border-primary focus:ring-2 focus:ring-primary"
              placeholder="Search or type a brand"
              autoComplete="off"
            />
            {showBrandSuggestions && brandSuggestions.length > 0 ? (
              <div
                ref={brandSuggestionsRef}
                className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-300 bg-white shadow-lg"
              >
                {brandSuggestions.map((brand) => {
                  const parentName =
                    brand.parent?.name ||
                    brands.find((node) => {
                      const id = node._id || node.id;
                      const parentId = brand.parent?._id || brand.parent;
                      return parentId && id?.toString() === parentId.toString();
                    })?.name;
                  return (
                    <button
                      key={brand._id || brand.id}
                      type="button"
                      onClick={() => handleBrandSuggestionSelect(brand)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-gray-100"
                    >
                      <span className="min-w-0">
                        <span className="block font-medium text-gray-900">{brand.name}</span>
                        {parentName ? (
                          <span className="block truncate text-[11px] text-gray-500">
                            under {parentName}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 rounded bg-gray-100 px-2 py-0.5 text-xs capitalize text-gray-500">
                        {brand.level}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
            {formData.brand && formData.brandCategoryId ? (
              <p className="mt-1 text-xs text-emerald-600">
                {linkedBrandPath || 'Linked to the brand tree'}
              </p>
            ) : formData.brand && !formData.brandCategoryId ? (
              <p className="mt-1 text-xs text-amber-600">
                Pick a suggestion to link this brand in the catalog tree
              </p>
            ) : null}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium text-gray-700">Category</p>
          <p className="mb-2 text-xs text-gray-500">
            Department → category → subcategory → type. Each choice unlocks the next.
          </p>
          <CascadeSelect
            nodes={categories}
            selection={categorySelection}
            onChange={handleCategoryChange}
          />
        </div>

        <label className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            name="featured"
            id="featured"
            checked={!!formData.featured}
            onChange={handleChange}
            className="h-4 w-4 rounded text-primary focus:ring-primary"
          />
          <span className="text-sm font-medium text-gray-800">Featured product</span>
          <span className="text-xs text-gray-500">Homepage / header showcase</span>
        </label>
      </FormCard>

      <FormAccordion title="Additional categories" description="Also appear under other catalog paths.">
        <div className="space-y-4">
          {additionalCategorySelections.map((selection, index) => (
            <div key={index} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">Placement {index + 1}</span>
                <button type="button" onClick={() => removeAdditionalCategory(index)} className="text-red-500">
                  <TrashIcon />
                </button>
              </div>
              <CascadeSelect
                nodes={categories}
                selection={selection}
                onChange={(level, id) => handleAdditionalCategoryChange(index, level, id)}
                presentation="plain"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={addAdditionalCategory}
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
          >
            <PlusIcon className="h-4 w-4" /> Add additional category
          </button>
        </div>
      </FormAccordion>

      <FormAccordion title="Additional brand placements" description="Optional extra brand-tree nodes. Primary brand is the field above.">
        <div className="space-y-3">
          {additionalBrandSelections.map((selection, index) => (
            <div key={index} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="mb-2 flex justify-end">
                <button type="button" onClick={() => removeAdditionalBrandCategory(index)} className="text-red-500">
                  <TrashIcon />
                </button>
              </div>
              <CascadeSelect
                nodes={brands}
                selection={selection}
                onChange={(level, id) => handleAdditionalBrandCategoryChange(index, level, id)}
                levels={BRAND_LEVEL_ORDER}
                presentation="plain"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={addAdditionalBrandCategory}
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
          >
            <PlusIcon className="h-4 w-4" /> Add additional brand category
          </button>
        </div>
      </FormAccordion>

      {/*
        Desktop: share one horizontal band so neither block forces a full-width scroll.
        Mobile: stack — business types first, then short description.
      */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
        <FormCard
          compact
          className="h-full"
          title="Business types"
          description="Whom we serve — storefront “whom we serve” pages."
        >
          <div className="grid grid-cols-2 gap-1.5">
            {(businessTypes || []).map((bt) => {
              const isSelected = formData.businessTypeSlugs?.includes(bt.slug);
              return (
                <button
                  key={bt._id || bt.id}
                  type="button"
                  onClick={() => handleBusinessTypeChange(bt.slug)}
                  aria-pressed={Boolean(isSelected)}
                  className={`flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1.5 text-left transition-colors ${
                    isSelected
                      ? 'border-neutral-900 bg-neutral-900 text-white'
                      : 'border-gray-200 text-gray-800 hover:border-gray-400 hover:bg-gray-50'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      isSelected ? 'bg-white' : 'bg-gray-300'
                    }`}
                    aria-hidden
                  />
                  <span className="truncate text-xs font-medium" title={bt.name}>
                    {bt.name}
                  </span>
                </button>
              );
            })}
          </div>
        </FormCard>

        <FormCard
          compact
          className="flex h-full flex-col"
          title="Short description"
          description="Summary for cards and search. Optional on first save."
          headerAction={
            <AiCopyButton
              value={formData.summary}
              title={formData.title}
              onClick={() => handleAIGenerate('summary')}
              loading={aiLoading.summary}
              cooldown={aiCooldown.summary}
            />
          }
        >
          <div className="min-h-0 flex-1">
            <RichTextEditor
              value={formData.summary}
              onChange={(html) => setFormData((prev) => ({ ...prev, summary: html }))}
              placeholder="Briefly describe what this product does"
              minHeight="160px"
            />
          </div>
        </FormCard>
      </div>
    </div>
  );
}
