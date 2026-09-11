'use client';

import { TrashIcon } from '@/components/Icons';
import FormCard from '@/components/product-form/ui/FormCard';
import { ColorSelectionPanel } from '@/components/product-form/sections/ProductColorFields';
import ProductVariantsTable from '@/components/product-form/sections/ProductVariantsTable';
import { UNIT_OPTIONS, VARIANT_AXES } from '@/components/product-form/constants';
import { formatIndianNumberInput } from '@/components/product-form/lib/formatters';
import { useProductForm } from '@/components/product-form/ProductFormContext';

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
    awaitingVariantChoice,
    handleStandalonePricingChange,
    getStandalonePricingErrors,
    variantFieldSelection,
    handleVariantFieldToggle,
    selectedVariantFieldCount,
    variantDraftValue,
    setVariantDraftValue,
    addVariantOptionValue,
    renderVariantOptionValueChips,
    fullFormColorNames,
    handleGenerateVariantRows,
    handleAddSingleVariantRow,
    variantRows,
    addPriceBySizeRow,
    removePriceBySizeRow,
    handlePriceBySizeChange,
  } = useProductForm();

  const pricingErrors = showStandaloneCommerceFields ? getStandalonePricingErrors() : {};

  return (
    <div className="space-y-5">
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
              className="mt-2 rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold"
            >
              Open parent editor
            </button>
          ) : null}
        </div>
      ) : (
        <FormCard
          title="How do you sell this product?"
          description="Shape is a different product, not a variant. Variants are only size, colour, weight, or unit count."
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => handleChooseProductVariantMode(false)}
              className={`rounded-xl border-2 p-4 text-left transition-colors ${
                hasVariantsChoice === false
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className="font-semibold text-gray-900">Single product</p>
              <p className="mt-1 text-sm text-gray-500">One SKU, one price, on this form.</p>
            </button>
            <button
              type="button"
              onClick={() => handleChooseProductVariantMode(true)}
              className={`rounded-xl border-2 p-4 text-left transition-colors ${
                hasVariantsChoice === true
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className="font-semibold text-gray-900">Product with variants</p>
              <p className="mt-1 text-sm text-gray-500">
                Each size/colour/weight/count is a child SKU.
              </p>
            </button>
          </div>
          {awaitingVariantChoice ? (
            <p className="text-xs text-gray-500">Choose one to unlock pricing. You can still save identity + hero from any step.</p>
          ) : null}
        </FormCard>
      )}

      {showStandaloneCommerceFields ? (
        <FormCard title="SKU, tax and pricing">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Unit</span>
              <input
                name="unit"
                value={formData.unit || ''}
                onChange={handleChange}
                placeholder="kg, pc, set"
                list="variantUnitOptions"
                className="w-full rounded-lg border border-gray-300 p-3 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">SKU</span>
              <input
                name="sku"
                value={formData.sku || ''}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 p-3 text-sm"
                placeholder="Enter SKU"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Barcode</span>
              <input
                name="barcode"
                value={formData.barcode || ''}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 p-3 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">HSN code</span>
              <input
                name="hsnCode"
                value={formData.hsnCode || ''}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 p-3 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">GST%</span>
              <input
                type="number"
                name="gstPercent"
                min="0"
                value={formData.gstPercent ?? ''}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 p-3 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">MRP</span>
              <input
                type="text"
                value={formatIndianNumberInput(formData.mrp ?? '')}
                onChange={(e) => handleStandalonePricingChange('mrp', e.target.value)}
                className="w-full rounded-lg border border-gray-300 p-3 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Selling price</span>
              <input
                type="text"
                value={formatIndianNumberInput(formData.sellingPrice ?? '')}
                onChange={(e) => handleStandalonePricingChange('sellingPrice', e.target.value)}
                className={`w-full rounded-lg border p-3 text-sm ${
                  pricingErrors.sellingPrice ? 'border-red-500 bg-red-50' : 'border-gray-300'
                }`}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Max discount %</span>
              <input
                type="number"
                min="0"
                max="99.99"
                value={formData.discountPercent ?? ''}
                onChange={(e) => handleStandalonePricingChange('discountPercent', e.target.value)}
                className={`w-full rounded-lg border p-3 text-sm ${
                  pricingErrors.discountPercent ? 'border-red-500 bg-red-50' : 'border-gray-300'
                }`}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Margin price</span>
              <input
                type="text"
                value={formatIndianNumberInput(formData.marginPrice ?? '')}
                onChange={(e) => handleStandalonePricingChange('marginPrice', e.target.value)}
                className={`w-full rounded-lg border p-3 text-sm ${
                  pricingErrors.marginPrice ? 'border-red-500 bg-red-50' : 'border-gray-300'
                }`}
              />
              <span className="mt-1 block text-[11px] text-gray-400">Owner-only. Sales uses max discount %, not this.</span>
            </label>
          </div>

          <div className="pt-2">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">Price by size</p>
              <button type="button" onClick={addPriceBySizeRow} className="text-xs font-semibold text-primary hover:underline">
                + Add row
              </button>
            </div>
            <p className="mb-2 text-xs text-gray-500">
              For a single SKU with multiple size prices. Hidden when size variants are on.
            </p>
            {(formData.priceBySize || []).length === 0 ? (
              <p className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500">
                Optional rows: price + size + unit.
              </p>
            ) : (
              (formData.priceBySize || []).map((row, index) => (
                <div key={index} className="mb-2 grid grid-cols-1 items-center gap-2 md:grid-cols-12">
                  <input
                    type="number"
                    min="0"
                    placeholder="Price"
                    value={row.price ?? ''}
                    onChange={(e) => handlePriceBySizeChange(index, 'price', e.target.value)}
                    className="rounded-md border p-2 md:col-span-4"
                  />
                  <input
                    placeholder="Size"
                    value={row.size ?? ''}
                    onChange={(e) => handlePriceBySizeChange(index, 'size', e.target.value)}
                    className="rounded-md border p-2 md:col-span-4"
                  />
                  <input
                    placeholder="Unit"
                    value={row.unit ?? ''}
                    onChange={(e) => handlePriceBySizeChange(index, 'unit', e.target.value)}
                    list="priceBySizeUnitOptions"
                    className="rounded-md border p-2 md:col-span-3"
                  />
                  <button type="button" onClick={() => removePriceBySizeRow(index)} className="text-red-500 md:col-span-1">
                    <TrashIcon />
                  </button>
                </div>
              ))
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
            title="Colours"
            description="Select colours once. The variant table Colour column only lists these."
          >
            <ColorSelectionPanel />
          </FormCard>

          <FormCard title="Variant attributes" description="Tick up to two axes, then generate rows or add a blank row.">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {VARIANT_AXES.map((axis) => (
                <label key={axis.key} className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={variantFieldSelection[axis.key]}
                    disabled={!variantFieldSelection[axis.key] && selectedVariantFieldCount >= 2}
                    onChange={() => handleVariantFieldToggle(axis.key)}
                    className="h-4 w-4 rounded text-primary"
                  />
                  {axis.label}
                </label>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {variantFieldSelection.size ? (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Size values</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Type one size and Add"
                      value={variantDraftValue.size}
                      onChange={(e) => setVariantDraftValue((prev) => ({ ...prev, size: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addVariantOptionValue('size');
                        }
                      }}
                      className="w-full rounded-md border border-gray-300 p-2"
                    />
                    <button type="button" onClick={() => addVariantOptionValue('size')} className="rounded-md bg-green-600 px-2 py-1.5 text-xs font-semibold text-white">
                      Add
                    </button>
                  </div>
                  {renderVariantOptionValueChips('size')}
                </div>
              ) : null}
              {variantFieldSelection.color ? (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Colour values</label>
                  {fullFormColorNames.length > 0 ? (
                    <ul className="mt-1 flex flex-wrap gap-1.5">
                      {fullFormColorNames.map((name) => (
                        <li key={name} className="rounded-full border border-gray-300 bg-white px-2 py-0.5 text-xs">
                          {name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-gray-500">Select colours above, then generate variants.</p>
                  )}
                </div>
              ) : null}
              {variantFieldSelection.weight ? (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Weight values</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={variantDraftValue.weight}
                      onChange={(e) => setVariantDraftValue((prev) => ({ ...prev, weight: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addVariantOptionValue('weight');
                        }
                      }}
                      className="w-full rounded-md border border-gray-300 p-2"
                    />
                    <button type="button" onClick={() => addVariantOptionValue('weight')} className="rounded-md bg-green-600 px-2 py-1.5 text-xs font-semibold text-white">
                      Add
                    </button>
                  </div>
                  {renderVariantOptionValueChips('weight')}
                </div>
              ) : null}
              {variantFieldSelection.unitCount ? (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Unit count values</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={variantDraftValue.unitCount}
                      onChange={(e) => setVariantDraftValue((prev) => ({ ...prev, unitCount: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addVariantOptionValue('unitCount');
                        }
                      }}
                      className="w-full rounded-md border border-gray-300 p-2"
                    />
                    <button type="button" onClick={() => addVariantOptionValue('unitCount')} className="rounded-md bg-green-600 px-2 py-1.5 text-xs font-semibold text-white">
                      Add
                    </button>
                  </div>
                  {renderVariantOptionValueChips('unitCount')}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={handleGenerateVariantRows} className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">
                Generate variants
              </button>
              <button type="button" onClick={handleAddSingleVariantRow} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                Add blank row
              </button>
              {variantRows.length > 0 ? (
                <span className="text-sm text-gray-600">
                  Total variants: <strong>{variantRows.length}</strong>
                </span>
              ) : null}
            </div>
          </FormCard>

          <ProductVariantsTable />
        </>
      ) : null}

      {!isChildProduct && hasVariantsChoice === false ? (
        <FormCard title="Display colours (optional)" description="Marketing swatches only — this product is still one SKU.">
          <ColorSelectionPanel />
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
