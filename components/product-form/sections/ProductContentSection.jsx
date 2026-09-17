'use client';

import Image from 'next/image';
import RichTextEditor from '@/components/RichTextEditor';
import { PlusIcon, TrashIcon, MagicIcon, SearchIcon, StarIcon } from '@/components/Icons';
import FormAccordion from '@/components/product-form/ui/FormAccordion';
import FormCard from '@/components/product-form/ui/FormCard';
import { getTextLength } from '@/components/product-form/lib/formatters';
import { useProductForm } from '@/components/product-form/ProductFormContext';

export default function ProductContentSection() {
  const ctx = useProductForm();
  const {
    formData,
    setFormData,
    handleChange,
    handleAIGenerate,
    aiLoading,
    aiCooldown,
    specifications,
    handleSpecChange,
    addSpec,
    removeSpec,
    handleSpecDragStart,
    handleSpecDragOver,
    handleSpecDragLeave,
    handleSpecDrop,
    handleSpecDragEnd,
    dragOverIndex,
    specJsonMode,
    specJsonInput,
    specJsonError,
    handleSwitchToJsonMode,
    handleSwitchToFormMode,
    handleSpecJsonChange,
    handleApplySpecJson,
    handleFilterChange,
    handleFilterBlur,
    addFilter,
    removeFilter,
    addFaq,
    removeFaq,
    handleFaqChange,
    addTestimonial,
    removeTestimonial,
    handleTestimonialChange,
    handleTestimonialLogoUpload,
    isUploading,
    relatedProductsSearchQuery,
    setRelatedProductsSearchQuery,
    debouncedSearchQuery,
    filteredRelatedCandidates,
    searchedProducts,
    allProducts,
    handleRelatedProductChange,
    handleFrequentlyOrderedProductChange,
    handleAutoSuggestRelated,
    handleAutoGenerateTags,
    showTagsPreview,
    setShowTagsPreview,
    generatedTagsPreview,
  } = ctx;

  const specs = formData.specifications || specifications || [];

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        These fields are optional. The product can be saved once title and hero image are set.
      </div>

      {/* Specs + filters stay open at the top — side by side on wider screens. */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-start">
        <FormCard compact title="Specifications" description="PDP table: label / value / unit.">
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={specJsonMode ? handleSwitchToFormMode : handleSwitchToJsonMode}
              className="text-xs font-semibold text-primary underline"
            >
              {specJsonMode ? 'Form editor' : 'JSON editor'}
            </button>
          </div>
          {specJsonMode ? (
            <div>
              <textarea
                value={specJsonInput}
                onChange={(e) => handleSpecJsonChange(e.target.value)}
                rows={8}
                className="w-full rounded-md border border-gray-300 p-2 font-mono text-xs"
                spellCheck={false}
              />
              {specJsonError ? <p className="mt-1 text-xs text-red-600">{specJsonError}</p> : null}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleApplySpecJson}
                  disabled={Boolean(specJsonError)}
                  title="Validate, apply, and return to the form editor"
                  className="rounded-md bg-neutral-900 px-2.5 py-1 text-[11px] font-semibold tracking-tight text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                >
                  Apply JSON
                </button>
              </div>
            </div>
          ) : (
            <>
              {specs.length === 0 ? (
                <p className="mb-2 text-xs text-gray-400">No specs yet — add rows below.</p>
              ) : null}
              {specs.map((spec, index) => (
                <div
                  key={index}
                  draggable
                  onDragStart={() => handleSpecDragStart(index)}
                  onDragOver={(e) => handleSpecDragOver(e, index)}
                  onDragLeave={handleSpecDragLeave}
                  onDrop={(e) => handleSpecDrop(e, index)}
                  onDragEnd={handleSpecDragEnd}
                  className={`mb-2 grid grid-cols-1 items-center gap-2 sm:grid-cols-12 ${
                    dragOverIndex === index ? 'rounded-md ring-2 ring-primary/40' : ''
                  }`}
                >
                  <input
                    placeholder="Label"
                    value={spec.label || ''}
                    onChange={(e) => handleSpecChange(index, e)}
                    name="label"
                    className="rounded-md border border-gray-200 p-2 text-sm outline-none focus:border-neutral-900 sm:col-span-4"
                  />
                  <input
                    placeholder="Value"
                    value={spec.value || ''}
                    onChange={(e) => handleSpecChange(index, e)}
                    name="value"
                    className="rounded-md border border-gray-200 p-2 text-sm outline-none focus:border-neutral-900 sm:col-span-4"
                  />
                  <input
                    placeholder="Unit"
                    name="unit"
                    value={spec.unit || ''}
                    onChange={(e) => handleSpecChange(index, e)}
                    className="rounded-md border border-gray-200 p-2 text-sm outline-none focus:border-neutral-900 sm:col-span-3"
                  />
                  <button
                    type="button"
                    onClick={() => removeSpec(index)}
                    className="text-red-500 sm:col-span-1"
                    aria-label="Remove specification"
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addSpec}
                className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-primary"
              >
                <PlusIcon className="h-4 w-4" /> Add specification
              </button>
            </>
          )}
        </FormCard>

        <FormCard compact title="Catalog filters" description="Sidebar filters. Not the same as tags.">
          {(formData.filters || []).map((filter, index) => (
            <div key={index} className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)_auto] sm:items-center">
              <input
                name="key"
                value={filter.key || ''}
                onChange={(e) => handleFilterChange(index, e)}
                placeholder="Filter name (e.g. Material)"
                className="rounded-md border border-gray-200 p-2 text-sm outline-none focus:border-neutral-900"
              />
              <input
                name="values"
                value={Array.isArray(filter.values) ? filter.values.join(', ') : filter.values || ''}
                onChange={(e) => handleFilterChange(index, e)}
                onBlur={() => handleFilterBlur(index)}
                placeholder="Comma-separated values"
                className="rounded-md border border-gray-200 p-2 text-sm outline-none focus:border-neutral-900"
              />
              <button
                type="button"
                onClick={() => removeFilter(index)}
                className="justify-self-start text-red-500 sm:justify-self-center"
                aria-label="Remove filter"
              >
                <TrashIcon />
              </button>
            </div>
          ))}
          <button type="button" onClick={addFilter} className="text-sm font-semibold text-primary">
            + Add filter
          </button>
        </FormCard>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={relatedProductsSearchQuery}
              onChange={(e) => setRelatedProductsSearchQuery(e.target.value)}
              placeholder="Search products by name, SKU, tags, or brand…"
              className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-3 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={handleAutoSuggestRelated}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700"
          >
            <MagicIcon className="h-4 w-4" /> Auto-suggest related
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-start">
          <FormCard
            compact
            title="Related products"
            description="Pick from search results. Typing searches the full catalog."
          >
            <RelatedPicker
              filteredRelatedCandidates={filteredRelatedCandidates}
              relatedProductsSearchQuery={relatedProductsSearchQuery}
              debouncedSearchQuery={debouncedSearchQuery}
              searchedProducts={searchedProducts}
              allProducts={allProducts}
              selectedIds={formData.relatedProductIds}
              onToggle={handleRelatedProductChange}
              showMatch
            />
          </FormCard>

          <FormCard
            compact
            title="Frequently ordered together"
            description="Uses the same catalog search above."
          >
            <RelatedPicker
              filteredRelatedCandidates={filteredRelatedCandidates}
              relatedProductsSearchQuery={relatedProductsSearchQuery}
              debouncedSearchQuery={debouncedSearchQuery}
              searchedProducts={searchedProducts}
              allProducts={allProducts}
              selectedIds={formData.frequentlyOrderedTogetherProductIds}
              onToggle={handleFrequentlyOrderedProductChange}
            />
          </FormCard>
        </div>
      </div>

      <FormAccordion title="Long description" description="Full product story on the detail page.">
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={() => handleAIGenerate('description')}
            disabled={aiLoading.description || aiCooldown.description || !formData.title || formData.title.trim().length < 3}
            className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
          >
            {aiLoading.description ? 'Generating…' : getTextLength(formData.description) > 20 ? 'Improve' : 'Generate'}
          </button>
        </div>
        <RichTextEditor
          value={formData.description}
          onChange={(html) => setFormData((prev) => ({ ...prev, description: html }))}
          placeholder="Enter long description"
          minHeight="200px"
        />
      </FormAccordion>

      <FormAccordion title="Usage & care">
        <RichTextEditor
          value={formData.usageAndCare}
          onChange={(html) => setFormData((prev) => ({ ...prev, usageAndCare: html }))}
          placeholder="Cleaning, maintenance, handling"
          minHeight="160px"
        />
      </FormAccordion>

      <FormAccordion title="Why buy / manufacturer">
        <div className="space-y-4">
          <RichTextEditor
            value={formData.whyBuyFrom}
            onChange={(html) => setFormData((prev) => ({ ...prev, whyBuyFrom: html }))}
            placeholder="Why buy from this line"
            minHeight="140px"
          />
          <RichTextEditor
            value={formData.manufacturer || ''}
            onChange={(html) => setFormData((prev) => ({ ...prev, manufacturer: html }))}
            placeholder="Manufacturer details"
            minHeight="120px"
          />
        </div>
      </FormAccordion>

      <FormAccordion title="FAQs">
        {(formData.faqs || []).map((faq, index) => (
          <div key={index} className="mb-3 rounded-lg border border-gray-200 p-3">
            <div className="flex gap-3">
              <div className="flex-1 space-y-2">
                <input
                  value={faq.question || ''}
                  onChange={(e) => handleFaqChange(index, 'question', e.target.value)}
                  placeholder="Question"
                  className="w-full rounded-md border p-2 text-sm"
                />
                <textarea
                  value={faq.answer || ''}
                  onChange={(e) => handleFaqChange(index, 'answer', e.target.value)}
                  placeholder="Answer"
                  rows={3}
                  className="w-full rounded-md border p-2 text-sm"
                />
              </div>
              <button type="button" onClick={() => removeFaq(index)} className="text-red-500">
                <TrashIcon />
              </button>
            </div>
          </div>
        ))}
        <button type="button" onClick={addFaq} className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
          <PlusIcon className="h-4 w-4" /> Add FAQ
        </button>
      </FormAccordion>

      <FormAccordion title="Testimonials">
        {(formData.testimonials || []).map((item, index) => (
          <div key={index} className="mb-3 grid grid-cols-1 gap-2 rounded-lg border p-3 md:grid-cols-2">
            <textarea
              placeholder="Quote"
              value={item.quote || ''}
              onChange={(e) => handleTestimonialChange(index, 'quote', e.target.value)}
              className="rounded-md border p-2 text-sm md:col-span-2"
              rows={2}
            />
            <input
              placeholder="Author"
              value={item.authorName || ''}
              onChange={(e) => handleTestimonialChange(index, 'authorName', e.target.value)}
              className="rounded-md border p-2 text-sm"
            />
            <input
              placeholder="Role"
              value={item.authorRole || ''}
              onChange={(e) => handleTestimonialChange(index, 'authorRole', e.target.value)}
              className="rounded-md border p-2 text-sm"
            />
            <input
              placeholder="Company"
              value={item.companyName || ''}
              onChange={(e) => handleTestimonialChange(index, 'companyName', e.target.value)}
              className="rounded-md border p-2 text-sm"
            />
            <input
              type="file"
              accept="image/*"
              disabled={isUploading}
              onChange={(e) => handleTestimonialLogoUpload(index, e.target.files?.[0])}
              className="text-sm"
            />
            <button type="button" onClick={() => removeTestimonial(index)} className="text-sm text-red-500">
              Remove
            </button>
          </div>
        ))}
        <button type="button" onClick={addTestimonial} className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
          <PlusIcon className="h-4 w-4" /> Add testimonial
        </button>
      </FormAccordion>

      <FormCard
        compact
        title="Tags"
        description="Search/SEO. Not catalog sidebar filters."
        headerAction={
          <button
            type="button"
            onClick={handleAutoGenerateTags}
            className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700"
          >
            <MagicIcon className="h-4 w-4" /> Auto-generate tags
          </button>
        }
      >
        <input
          name="tagsInput"
          value={formData.tagsInput}
          onChange={(e) => {
            handleChange(e);
            if (showTagsPreview) setShowTagsPreview(false);
          }}
          placeholder="hotel kitchen, heavy duty"
          className="w-full rounded-md border border-gray-200 p-2.5 text-sm outline-none focus:border-neutral-900"
        />
        {showTagsPreview && generatedTagsPreview.length > 0 ? (
          <div className="mt-3 rounded-md border border-indigo-200 bg-indigo-50 p-3">
            <div className="flex flex-wrap gap-1.5">
              {generatedTagsPreview.map((tag) => (
                <span key={tag} className="rounded border border-indigo-300 bg-indigo-100 px-2 py-0.5 text-xs">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </FormCard>
    </div>
  );
}

function RelatedPicker({
  filteredRelatedCandidates,
  relatedProductsSearchQuery,
  debouncedSearchQuery,
  searchedProducts,
  allProducts,
  selectedIds,
  onToggle,
  showMatch = false,
}) {
  const isSearching = debouncedSearchQuery.trim().length > 0;
  return (
    <div className="max-h-60 overflow-y-auto rounded-md border border-gray-300 bg-gray-50">
      {debouncedSearchQuery.trim() && relatedProductsSearchQuery !== debouncedSearchQuery ? (
        <p className="p-4 text-center text-sm text-gray-500">Searching…</p>
      ) : filteredRelatedCandidates.length > 0 ? (
        filteredRelatedCandidates.map((otherProduct) => {
          const productId = otherProduct._id || otherProduct.id;
          const isSelected = selectedIds?.some((id) => id?.toString() === productId?.toString());
          const isHighMatch = showMatch && !isSearching && otherProduct.relevanceScore >= 5;
          return (
            <label
              key={productId}
              className={`flex cursor-pointer items-center justify-between p-2 hover:bg-white ${isSelected ? 'bg-blue-50' : ''}`}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <input type="checkbox" checked={Boolean(isSelected)} onChange={() => onToggle(productId)} className="h-4 w-4 rounded text-primary" />
                {otherProduct.heroImage ? (
                  <Image src={otherProduct.heroImage} alt="" width={32} height={32} className="h-8 w-8 rounded border object-cover" />
                ) : (
                  <span className="h-8 w-8 rounded bg-gray-200" />
                )}
                <span className="truncate text-sm">{otherProduct.title}</span>
              </div>
              {isHighMatch ? <StarIcon filled className="h-4 w-4 text-amber-500" /> : null}
            </label>
          );
        })
      ) : (
        <p className="p-4 text-center text-sm italic text-gray-500">
          {relatedProductsSearchQuery
            ? `No products matching “${relatedProductsSearchQuery}”.`
            : (allProducts || []).length <= 1
              ? 'Type to search the catalog, or save other products first.'
              : 'No products match the current filters.'}
        </p>
      )}
      {filteredRelatedCandidates.length > 0 && debouncedSearchQuery.trim() ? (
        <p className="border-t border-blue-200 bg-blue-50 px-4 py-2 text-xs text-blue-700">
          {searchedProducts.length > 0
            ? `Found ${filteredRelatedCandidates.length} matching “${debouncedSearchQuery}”`
            : `Showing ${filteredRelatedCandidates.length}`}
        </p>
      ) : null}
    </div>
  );
}
