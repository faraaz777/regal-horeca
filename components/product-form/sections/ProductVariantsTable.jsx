'use client';

import Image from 'next/image';
import FormCard from '@/components/product-form/ui/FormCard';
import {
  getPredefinedColorSwatchClassName,
  resolveColorDisplay,
} from '@/components/product-form/lib/colors';
import { formatIndianNumberInput } from '@/components/product-form/lib/formatters';
import { useProductForm } from '@/components/product-form/ProductFormContext';

/**
 * Child SKU matrix. Row images are optional overrides — empty inherits
 * that colour's Media gallery, then the parent hero.
 */
export default function ProductVariantsTable() {
  const {
    formData,
    variantRows,
    variantFieldSelection,
    selectedVariantRowIndex,
    setSelectedVariantRowIndex,
    bulkVariantInputs,
    handleBulkVariantInputChange,
    handleApplyBulkInputs,
    handleSetDefaultVariantRow,
    handleVariantRowChange,
    handleVariantRowImageUpload,
    handleRemoveVariantRowImage,
    handleDeleteVariantRow,
    recentlyDeletedVariantRow,
    handleUndoDeleteVariantRow,
    isUploading,
    variantTableColorOptions,
    getVariantPricingErrors,
  } = useProductForm();

  if (!variantRows.length) {
    return (
      <FormCard title="Variant SKUs">
        <p className="text-sm text-gray-500">No rows yet. Generate from attributes or add a blank row.</p>
      </FormCard>
    );
  }

  return (
    <FormCard title="Variant SKUs" description="Apply-to-all fills empty or overwrites after confirm. Default row is the storefront default child.">
      {recentlyDeletedVariantRow ? (
        <div className="mb-3 flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
          <span>Unsaved row removed.</span>
          <button type="button" onClick={handleUndoDeleteVariantRow} className="font-semibold text-primary underline">
            Undo
          </button>
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-[1400px] w-full text-left text-xs">
          <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
            <tr>
              <th className="px-2 py-2">#</th>
              <th className="px-2 py-2">Def</th>
              <th className="px-2 py-2">Cat</th>
              <th className="px-2 py-2">Name</th>
              {variantFieldSelection.size ? <th className="px-2 py-2">Size</th> : null}
              <th className="px-2 py-2">Unit</th>
              {variantFieldSelection.color ? <th className="px-2 py-2">Colour</th> : null}
              {variantFieldSelection.unitCount ? <th className="px-2 py-2">Count</th> : null}
              {variantFieldSelection.weight ? <th className="px-2 py-2">Weight</th> : null}
              <th className="px-2 py-2">Images</th>
              <th className="px-2 py-2">SKU</th>
              <th className="px-2 py-2">Barcode</th>
              <th className="px-2 py-2">HSN</th>
              <th className="px-2 py-2">GST</th>
              <th className="px-2 py-2">MRP</th>
              <th className="px-2 py-2">Selling</th>
              <th className="px-2 py-2">Disc%</th>
              <th className="px-2 py-2">Margin</th>
              <th className="px-2 py-2" />
            </tr>
            <tr className="border-t border-gray-100 bg-white">
              <th />
              <th />
              <th className="px-2 py-1">
                <select
                  value={bulkVariantInputs.showInCatalog}
                  onChange={(e) => handleBulkVariantInputChange('showInCatalog', e.target.value)}
                  className="w-full rounded border p-1 text-[11px]"
                >
                  <option value="">Catalog</option>
                  <option value="yes">All on</option>
                  <option value="no">All off</option>
                </select>
              </th>
              <th className="px-2 py-1">
                <input value={bulkVariantInputs.name} onChange={(e) => handleBulkVariantInputChange('name', e.target.value)} placeholder="Name" className="w-full rounded border p-1" />
              </th>
              {variantFieldSelection.size ? <th /> : null}
              <th className="px-2 py-1">
                <input value={bulkVariantInputs.unit} onChange={(e) => handleBulkVariantInputChange('unit', e.target.value)} placeholder="Unit" className="w-full rounded border p-1" />
              </th>
              {variantFieldSelection.color ? <th /> : null}
              {variantFieldSelection.unitCount ? <th /> : null}
              {variantFieldSelection.weight ? <th /> : null}
              <th />
              <th className="px-2 py-1">
                <input value={bulkVariantInputs.sku} onChange={(e) => handleBulkVariantInputChange('sku', e.target.value)} placeholder="SKU" className="w-full rounded border p-1" />
              </th>
              <th className="px-2 py-1">
                <input value={bulkVariantInputs.barcode} onChange={(e) => handleBulkVariantInputChange('barcode', e.target.value)} placeholder="Barcode" className="w-full rounded border p-1" />
              </th>
              <th className="px-2 py-1">
                <input value={bulkVariantInputs.hsnCode} onChange={(e) => handleBulkVariantInputChange('hsnCode', e.target.value)} placeholder="HSN" className="w-full rounded border p-1" />
              </th>
              <th className="px-2 py-1">
                <input value={bulkVariantInputs.gstPercent} onChange={(e) => handleBulkVariantInputChange('gstPercent', e.target.value)} placeholder="GST" className="w-full rounded border p-1" />
              </th>
              <th className="px-2 py-1">
                <input value={formatIndianNumberInput(bulkVariantInputs.mrp)} onChange={(e) => handleBulkVariantInputChange('mrp', e.target.value)} placeholder="MRP" className="w-full rounded border p-1" />
              </th>
              <th className="px-2 py-1">
                <input value={formatIndianNumberInput(bulkVariantInputs.sellingPrice)} onChange={(e) => handleBulkVariantInputChange('sellingPrice', e.target.value)} placeholder="Selling" className="w-full rounded border p-1" />
              </th>
              <th className="px-2 py-1">
                <input value={bulkVariantInputs.discountPercent} onChange={(e) => handleBulkVariantInputChange('discountPercent', e.target.value)} placeholder="%" className="w-full rounded border p-1" />
              </th>
              <th className="px-2 py-1">
                <input value={formatIndianNumberInput(bulkVariantInputs.marginPrice)} onChange={(e) => handleBulkVariantInputChange('marginPrice', e.target.value)} placeholder="Margin" className="w-full rounded border p-1" />
              </th>
              <th className="px-2 py-1">
                <button type="button" onClick={handleApplyBulkInputs} className="rounded border border-primary/30 px-2 py-1 text-[11px] font-semibold text-primary">
                  Apply
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {variantRows.map((row, index) => {
              const display = row.color
                ? resolveColorDisplay(
                    row.colorDetails ||
                      (row.colorHex
                        ? { colorName: row.color, colorHex: row.colorHex, swatch: row.colorSwatch }
                        : row.color),
                    formData.colorVariants
                  )
                : null;
              const rowErrors = getVariantPricingErrors(row);
              return (
                <tr
                  key={row._rowId || index}
                  onClick={() => setSelectedVariantRowIndex(index)}
                  className={`border-b border-gray-100 ${
                    selectedVariantRowIndex === index ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="px-2 py-2 text-center font-medium">
                    {index + 1}
                    {row._childProductId ? (
                      <span className="mt-0.5 block text-[9px] font-semibold text-amber-800">Child</span>
                    ) : null}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <input
                      type="radio"
                      name="default-variant-row"
                      checked={Boolean(row.isDefault)}
                      onChange={() => handleSetDefaultVariantRow(index)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 text-primary"
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={row.showInCatalog === true}
                      onChange={(e) => handleVariantRowChange(index, 'showInCatalog', e.target.checked)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 rounded text-primary"
                    />
                  </td>
                  <td className="min-w-[220px] px-2 py-2">
                    <input
                      type="text"
                      value={row.name || ''}
                      onChange={(e) => handleVariantRowChange(index, 'name', e.target.value)}
                      className="w-full rounded-md border border-gray-300 p-2"
                    />
                  </td>
                  {variantFieldSelection.size ? (
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={row.size || ''}
                        onChange={(e) => handleVariantRowChange(index, 'size', e.target.value)}
                        className="w-full rounded-md border border-gray-300 p-2"
                      />
                    </td>
                  ) : null}
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={row.unit || ''}
                      onChange={(e) => handleVariantRowChange(index, 'unit', e.target.value)}
                      list="variantUnitOptions"
                      className="w-full rounded-md border border-gray-300 p-2"
                    />
                  </td>
                  {variantFieldSelection.color ? (
                    <td className="min-w-[140px] px-2 py-2">
                      <div className="relative">
                        {display ? (
                          <span
                            style={display.swatch ? undefined : { backgroundColor: display.colorHex }}
                            className={`absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border border-black/15 ${getPredefinedColorSwatchClassName(display)}`}
                          />
                        ) : null}
                        <select
                          value={row.color || ''}
                          onChange={(e) => handleVariantRowChange(index, 'color', e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className={`w-full rounded-md border border-gray-300 bg-white p-2 ${display ? 'pl-7' : ''}`}
                        >
                          <option value="">Select</option>
                          {variantTableColorOptions.map((opt) => (
                            <option key={opt.name} value={opt.name}>
                              {opt.name}
                              {!opt.isParentColor && (formData.colorVariants || []).length > 0
                                ? ' (existing)'
                                : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                  ) : null}
                  {variantFieldSelection.unitCount ? (
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={row.unitCount || ''}
                        onChange={(e) => handleVariantRowChange(index, 'unitCount', e.target.value)}
                        className="w-full rounded-md border border-gray-300 p-2"
                      />
                    </td>
                  ) : null}
                  {variantFieldSelection.weight ? (
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={row.weight || ''}
                        onChange={(e) => handleVariantRowChange(index, 'weight', e.target.value)}
                        className="w-full rounded-md border border-gray-300 p-2"
                      />
                    </td>
                  ) : null}
                  <td className="px-2 py-2">
                    <input
                      id={`variant-row-images-${row._rowId || index}`}
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleVariantRowImageUpload(e, index)}
                    />
                    <label
                      htmlFor={`variant-row-images-${row._rowId || index}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex cursor-pointer rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] font-semibold"
                      title="SKU-only override. Prefer Media → Colour photos for the shared colour gallery."
                    >
                      {isUploading ? '…' : 'Upload'}
                    </label>
                    {(row.images || []).length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(row.images || []).slice(0, 4).map((url, imageIndex) => (
                          <div key={`${url}-${imageIndex}`} className="relative h-8 w-8">
                            <Image src={url} alt="" width={32} height={32} unoptimized className="h-8 w-8 rounded border object-cover" />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveVariantRowImage(index, imageIndex);
                              }}
                              className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-red-600 text-[10px] leading-4 text-white"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-[10px] text-gray-500">
                        Override only — else colour photos / hero
                      </p>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <input type="text" value={row.sku || ''} onChange={(e) => handleVariantRowChange(index, 'sku', e.target.value)} className="w-full rounded-md border p-2" />
                  </td>
                  <td className="px-2 py-2">
                    <input type="text" value={row.barcode || ''} onChange={(e) => handleVariantRowChange(index, 'barcode', e.target.value)} className="w-full rounded-md border p-2" />
                  </td>
                  <td className="px-2 py-2">
                    <input type="text" value={row.hsnCode || ''} onChange={(e) => handleVariantRowChange(index, 'hsnCode', e.target.value)} className="w-full rounded-md border p-2" />
                  </td>
                  <td className="px-2 py-2">
                    <input type="number" value={row.gstPercent ?? ''} onChange={(e) => handleVariantRowChange(index, 'gstPercent', e.target.value)} className="w-full rounded-md border p-2" />
                  </td>
                  <td className="px-2 py-2">
                    <input type="text" value={formatIndianNumberInput(row.mrp ?? '')} onChange={(e) => handleVariantRowChange(index, 'mrp', e.target.value)} className="w-full rounded-md border p-2" />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={formatIndianNumberInput(row.sellingPrice ?? '')}
                      onChange={(e) => handleVariantRowChange(index, 'sellingPrice', e.target.value)}
                      className={`w-full rounded-md border p-2 ${rowErrors.sellingPrice ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      value={row.discountPercent ?? ''}
                      onChange={(e) => handleVariantRowChange(index, 'discountPercent', e.target.value)}
                      className={`w-full rounded-md border p-2 ${rowErrors.discountPercent ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={formatIndianNumberInput(row.marginPrice ?? '')}
                      onChange={(e) => handleVariantRowChange(index, 'marginPrice', e.target.value)}
                      className={`w-full rounded-md border p-2 ${rowErrors.marginPrice ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteVariantRow(index);
                      }}
                      className="rounded border border-red-300 p-2 text-red-600 hover:bg-red-50"
                      aria-label="Delete variant row"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </FormCard>
  );
}
