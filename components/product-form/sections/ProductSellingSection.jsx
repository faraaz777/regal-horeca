'use client';

import { TrashIcon } from '@/components/Icons';
import FormCard from '@/components/product-form/ui/FormCard';
import { ColorSelectionPanel } from '@/components/product-form/sections/ProductColorFields';
import ProductVariantsTable from '@/components/product-form/sections/ProductVariantsTable';
import { UNIT_OPTIONS, VARIANT_AXES } from '@/components/product-form/constants';
import { formatIndianNumberInput } from '@/components/product-form/lib/formatters';
import {
  getPredefinedColorSwatchClassName,
  resolveColorDisplay,
} from '@/components/product-form/lib/colors';
import { parseOptionValues } from '@/lib/shared/variantMatrix';
import { useProductForm } from '@/components/product-form/ProductFormContext';

/** Match Product-step chip language: thin border, black when selected. */
const fieldClass =
  'w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900/10';
const fieldErrorClass =
  'w-full rounded-md border border-red-400 bg-red-50 px-2.5 py-2 text-sm text-gray-900 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/15';
const labelClass = 'mb-1 block text-xs font-medium text-gray-600';

/**
 * Compact inline tag field — no title row; field name lives in placeholder / aria-label.
 */
function VariantChipInput({ label, field, placeholder, draft, setDraft, values, onAdd, onRemove }) {
  return (
    <div
      className="flex min-h-[34px] w-full cursor-text flex-wrap items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 transition-colors focus-within:border-neutral-900 focus-within:ring-1 focus-within:ring-neutral-900/10"
      onClick={(e) => {
        const input = e.currentTarget.querySelector('input');
        input?.focus();
      }}
      role="group"
      aria-label={label}
    >
      {values.map((value) => (
        <span
          key={`${field}-${value}`}
          className="inline-flex max-w-full items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[11px] font-medium text-gray-800"
        >
          <span className="truncate">{value}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(value);
            }}
            className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
            aria-label={`Remove ${value}`}
            title={`Remove ${value}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        id={`variant-chip-${field}`}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onAdd();
            return;
          }
          if (e.key === 'Backspace' && !draft && values.length > 0) {
            e.preventDefault();
            onRemove(values[values.length - 1]);
          }
        }}
        placeholder={values.length ? 'Add another…' : placeholder}
        className="min-w-[6rem] flex-1 border-0 bg-transparent px-1 py-0.5 text-[12px] text-gray-900 outline-none placeholder:text-gray-400"
      />
    </div>
  );
}

export default function ProductSellingSection() {
  const {
    formData,
    handleChange,
    isChildProduct,
    product,
    onOpenParent,
    hasVariantsChoice,
    handleChooseProductVariantMode,
    variantWorkflowEnabled,
    showStandaloneCommerceFields,
    handleStandalonePricingChange,
    getStandalonePricingErrors,
    variantFieldSelection,
    handleVariantFieldToggle,
    selectedVariantFieldCount,
    variantDraftValue,
    setVariantDraftValue,
    addVariantOptionValue,
    removeVariantOptionValue,
    variantBuilderInputs,
    handleColorChange,
    handleGenerateVariantRows,
    handleAddSingleVariantRow,
    handleClearVariantBuilder,
    variantRows,
    addPriceBySizeRow,
    removePriceBySizeRow,
    handlePriceBySizeChange,
  } = useProductForm();

  const pricingErrors = showStandaloneCommerceFields ? getStandalonePricingErrors() : {};

  return (
    <div className="space-y-4">
      {isChildProduct ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p>
            This is a <strong>variant (child) SKU</strong>. Commerce fields are edited on the parent
            Variants table only. Use Product / Media / Content for shared catalog copy.
          </p>
          {product?.parentProductId && typeof onOpenParent === 'function' ? (
            <button
              type="button"
              onClick={() => onOpenParent(String(product.parentProductId))}
              className="mt-2 rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-950 transition-colors hover:bg-amber-100"
            >
              Open parent editor
            </button>
          ) : null}
        </div>
      ) : (
        <FormCard
          compact
          title="How do you sell this product?"
          description="Shape is never a variant — it means a new product. Variants only come from size, colour, weight, or unit count, and each combination is its own child SKU."
          headerAction={
            <div role="radiogroup" aria-label="Sell mode" className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                role="radio"
                aria-checked={hasVariantsChoice === false}
                onClick={() => handleChooseProductVariantMode(false)}
                className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                  hasVariantsChoice === false
                    ? 'border-neutral-900 bg-neutral-900 text-white'
                    : 'border-gray-200 bg-white text-gray-800 hover:border-gray-400'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                    hasVariantsChoice === false ? 'border-white' : 'border-gray-300'
                  }`}
                  aria-hidden="true"
                >
                  {hasVariantsChoice === false ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  ) : null}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold leading-tight">Single product</span>
                  <span
                    className={`mt-0.5 block text-[10px] leading-snug ${
                      hasVariantsChoice === false ? 'text-white/70' : 'text-gray-500'
                    }`}
                  >
                    One SKU, one price
                  </span>
                </span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={hasVariantsChoice === true}
                onClick={() => handleChooseProductVariantMode(true)}
                className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                  hasVariantsChoice === true
                    ? 'border-neutral-900 bg-neutral-900 text-white'
                    : 'border-gray-200 bg-white text-gray-800 hover:border-gray-400'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                    hasVariantsChoice === true ? 'border-white' : 'border-gray-300'
                  }`}
                  aria-hidden="true"
                >
                  {hasVariantsChoice === true ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  ) : null}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold leading-tight">With variants</span>
                  <span
                    className={`mt-0.5 block text-[10px] leading-snug ${
                      hasVariantsChoice === true ? 'text-white/70' : 'text-gray-500'
                    }`}
                  >
                    Child SKUs per axis
                  </span>
                </span>
              </button>
            </div>
          }
        >
          {hasVariantsChoice == null ? (
            <p className="text-[11px] text-gray-500">
              Choose one to unlock pricing. Identity + hero can still be saved anytime.
            </p>
          ) : null}
        </FormCard>
      )}

      {showStandaloneCommerceFields ? (
        <FormCard compact title="SKU, tax and pricing">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Unit</span>
              <input
                name="unit"
                value={formData.unit || ''}
                onChange={handleChange}
                placeholder="kg, pc, set"
                list="variantUnitOptions"
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className={labelClass}>SKU</span>
              <input
                name="sku"
                value={formData.sku || ''}
                onChange={handleChange}
                className={fieldClass}
                placeholder="Enter SKU"
              />
            </label>
            <label className="block">
              <span className={labelClass}>Barcode</span>
              <input
                name="barcode"
                value={formData.barcode || ''}
                onChange={handleChange}
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className={labelClass}>HSN code</span>
              <input
                name="hsnCode"
                value={formData.hsnCode || ''}
                onChange={handleChange}
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className={labelClass}>GST%</span>
              <input
                type="number"
                name="gstPercent"
                min="0"
                value={formData.gstPercent ?? ''}
                onChange={handleChange}
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className={labelClass}>MRP</span>
              <input
                type="text"
                value={formatIndianNumberInput(formData.mrp ?? '')}
                onChange={(e) => handleStandalonePricingChange('mrp', e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Selling price</span>
              <input
                type="text"
                value={formatIndianNumberInput(formData.sellingPrice ?? '')}
                onChange={(e) => handleStandalonePricingChange('sellingPrice', e.target.value)}
                className={pricingErrors.sellingPrice ? fieldErrorClass : fieldClass}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Max discount %</span>
              <input
                type="number"
                min="0"
                max="99.99"
                value={formData.discountPercent ?? ''}
                onChange={(e) => handleStandalonePricingChange('discountPercent', e.target.value)}
                className={pricingErrors.discountPercent ? fieldErrorClass : fieldClass}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className={labelClass}>Margin price</span>
              <input
                type="text"
                value={formatIndianNumberInput(formData.marginPrice ?? '')}
                onChange={(e) => handleStandalonePricingChange('marginPrice', e.target.value)}
                className={pricingErrors.marginPrice ? fieldErrorClass : fieldClass}
              />
              <span className="mt-1 block text-[11px] text-gray-400">
                Owner-only. Sales uses max discount %, not this.
              </span>
            </label>
          </div>

          <div className="border-t border-gray-100 pt-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-gray-900">Price by size</p>
                <p className="text-xs text-gray-500">
                  Optional for a single SKU with multiple size prices. Hidden when size variants are on.
                </p>
              </div>
              <button
                type="button"
                onClick={addPriceBySizeRow}
                className="shrink-0 text-xs font-semibold text-gray-800 underline-offset-2 hover:underline"
              >
                + Add row
              </button>
            </div>
            {(formData.priceBySize || []).length === 0 ? (
              <p className="rounded-md border border-dashed border-gray-200 bg-gray-50 px-3 py-2.5 text-xs text-gray-500">
                No rows yet — add price + size + unit when needed.
              </p>
            ) : (
              <div className="space-y-2">
                {(formData.priceBySize || []).map((row, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"
                  >
                    <input
                      type="number"
                      min="0"
                      placeholder="Price"
                      value={row.price ?? ''}
                      onChange={(e) => handlePriceBySizeChange(index, 'price', e.target.value)}
                      className={fieldClass}
                    />
                    <input
                      placeholder="Size"
                      value={row.size ?? ''}
                      onChange={(e) => handlePriceBySizeChange(index, 'size', e.target.value)}
                      className={fieldClass}
                    />
                    <input
                      placeholder="Unit"
                      value={row.unit ?? ''}
                      onChange={(e) => handlePriceBySizeChange(index, 'unit', e.target.value)}
                      list="priceBySizeUnitOptions"
                      className={fieldClass}
                    />
                    <button
                      type="button"
                      onClick={() => removePriceBySizeRow(index)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 text-red-500 transition-colors hover:border-red-200 hover:bg-red-50"
                      title="Remove row"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <datalist id="priceBySizeUnitOptions">
              {UNIT_OPTIONS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </div>
        </FormCard>
      ) : null}

      {variantWorkflowEnabled ? (
        <>
          <FormCard
            compact
            title="Colours"
            description="Sold-in colours for the variant matrix. Commercial default is the Def SKU, not a colour."
          >
            <ColorSelectionPanel mode="variant" />
          </FormCard>

          <FormCard compact>
            <header className="-mt-0.5 mb-1 flex items-baseline justify-between gap-3">
              <h3 className="shrink-0 text-[15px] font-semibold tracking-tight text-gray-900">
                Variant attributes
              </h3>
              <p className="text-right text-[12px] leading-relaxed text-gray-500">
                Pick 1–2 axes, add values, then generate (m or m×n rows).
              </p>
            </header>

            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400">
                Axes
              </p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {VARIANT_AXES.map((axis) => {
                  const selected = Boolean(variantFieldSelection[axis.key]);
                  const locked = !selected && selectedVariantFieldCount >= 2;
                  return (
                    <button
                      key={axis.key}
                      type="button"
                      disabled={locked}
                      aria-pressed={selected}
                      onClick={() => handleVariantFieldToggle(axis.key)}
                      className={`rounded-md border px-2.5 py-2 text-left text-xs font-medium tracking-tight transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        selected
                          ? 'border-neutral-900 bg-neutral-900 text-white'
                          : 'border-gray-200 bg-white text-gray-800 hover:border-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      {axis.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedVariantFieldCount > 0 ? (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {variantFieldSelection.size ? (
                    <VariantChipInput
                      label="Size"
                      field="size"
                      placeholder="Size…"
                      draft={variantDraftValue.size}
                      setDraft={(value) =>
                        setVariantDraftValue((prev) => ({ ...prev, size: value }))
                      }
                      values={parseOptionValues(variantBuilderInputs.size)}
                      onAdd={() => addVariantOptionValue('size')}
                      onRemove={(value) => removeVariantOptionValue('size', value)}
                    />
                  ) : null}

                  {variantFieldSelection.color ? (
                    (formData.colorVariants || []).length > 0 ? (
                      <div
                        className="flex min-h-[34px] w-full flex-wrap items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1"
                        role="group"
                        aria-label="Colour"
                      >
                        {(formData.colorVariants || []).map((variant) => {
                          const display = resolveColorDisplay(variant, formData.colorVariants);
                          const hex = display?.colorHex || variant.colorHex || '#9CA3AF';
                          const isSpecial =
                            display?.swatch === 'transparent' || display?.swatch === 'multicolour';
                          return (
                            <span
                              key={variant.colorName}
                              className="inline-flex max-w-full items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-800"
                            >
                              <span
                                className={`h-2.5 w-2.5 shrink-0 rounded-full border border-gray-300 ${getPredefinedColorSwatchClassName(display || variant)}`}
                                style={isSpecial ? undefined : { backgroundColor: hex }}
                                aria-hidden
                              />
                              <span className="truncate">{variant.colorName}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleColorChange({
                                    name: variant.colorName,
                                    hex: variant.colorHex || hex,
                                    swatch: variant.swatch || display?.swatch,
                                  })
                                }
                                className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                                aria-label={`Remove ${variant.colorName}`}
                                title={`Remove ${variant.colorName}`}
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
                        <span className="px-0.5 text-[11px] text-gray-400">Add in Colours above…</span>
                      </div>
                    ) : (
                      <p className="flex min-h-[34px] items-center rounded-md border border-dashed border-gray-200 px-2 text-[12px] text-gray-400">
                        Select colours above first.
                      </p>
                    )
                  ) : null}

                  {variantFieldSelection.weight ? (
                    <VariantChipInput
                      label="Weight"
                      field="weight"
                      placeholder="Weight…"
                      draft={variantDraftValue.weight}
                      setDraft={(value) =>
                        setVariantDraftValue((prev) => ({ ...prev, weight: value }))
                      }
                      values={parseOptionValues(variantBuilderInputs.weight)}
                      onAdd={() => addVariantOptionValue('weight')}
                      onRemove={(value) => removeVariantOptionValue('weight', value)}
                    />
                  ) : null}

                  {variantFieldSelection.unitCount ? (
                    <VariantChipInput
                      label="Unit count"
                      field="unitCount"
                      placeholder="Unit count…"
                      draft={variantDraftValue.unitCount}
                      setDraft={(value) =>
                        setVariantDraftValue((prev) => ({ ...prev, unitCount: value }))
                      }
                      values={parseOptionValues(variantBuilderInputs.unitCount)}
                      onAdd={() => addVariantOptionValue('unitCount')}
                      onRemove={(value) => removeVariantOptionValue('unitCount', value)}
                    />
                  ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
              <button
                type="button"
                onClick={handleGenerateVariantRows}
                title="Build m or m×n rows from the axes and values above"
                className="rounded-md bg-emerald-600 px-3.5 py-2 text-sm font-semibold tracking-tight text-white transition-colors hover:bg-emerald-700"
              >
                Generate variants
              </button>
              <button
                type="button"
                onClick={handleAddSingleVariantRow}
                title="Insert one empty SKU row (shows Size & Colour columns if no axis is selected yet)"
                className="rounded-md border border-gray-300 bg-gray-50 px-3.5 py-2 text-sm font-semibold tracking-tight text-gray-700 transition-colors hover:border-gray-400 hover:bg-white"
              >
                Add blank row
              </button>
              <button
                type="button"
                onClick={handleClearVariantBuilder}
                title="Clear axes, values, and all variant rows to start over"
                aria-label="Clear variant attributes and start over"
                className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2 py-1 text-[11px] font-medium tracking-tight text-red-700 transition-colors hover:border-red-300 hover:bg-red-50"
              >
                <TrashIcon className="h-3 w-3" />
                Clear
              </button>
              <span
                className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] text-gray-500"
                title="Rows currently in the Variant SKUs table"
              >
                Rows
                <span className="font-semibold tabular-nums text-gray-900">
                  {variantRows.length}
                </span>
              </span>
            </div>
          </FormCard>

          <ProductVariantsTable />
        </>
      ) : null}

      {!isChildProduct && hasVariantsChoice === false ? (
        <FormCard
          compact
          title="Display colours (optional)"
          description="Presentation only — one SKU. No Def / colour-default to manage."
        >
          <ColorSelectionPanel mode="standalone" />
        </FormCard>
      ) : null}

      {isChildProduct ? (
        <p className="text-sm text-gray-500">SKU and price live on the parent.</p>
      ) : null}

      <datalist id="variantUnitOptions">
        {UNIT_OPTIONS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
    </div>
  );
}
