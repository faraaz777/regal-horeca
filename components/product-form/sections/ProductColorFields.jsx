'use client';

import { PlusIcon, TrashIcon } from '@/components/Icons';
import ColorPicker from '@/components/ColorPicker';
import Image from 'next/image';
import {
  AVAILABLE_COLORS,
  getPredefinedColorSwatchClassName,
} from '@/components/product-form/lib/colors';
import { useProductForm } from '@/components/product-form/ProductFormContext';

/**
 * Colour chips live on Selling (one source of truth).
 * Colour is an attribute of SKUs — not a commercial default.
 * Per-colour galleries are uploaded on Media.
 */
export function ColorSelectionPanel({ mode = 'variant' } = {}) {
  const {
    formData,
    isChildProduct,
    childAssignedColorDisplay,
    childAssignedColorName,
    childAssignedColorIsPredefined,
    product,
    onOpenParent,
    handleColorChange,
    getCustomColors,
    handleRemoveCustomColor,
    handleOpenColorPicker,
    showColorPicker,
    setShowColorPicker,
    customColorHex,
    setCustomColorHex,
    customColorName,
    setCustomColorName,
    handleAddCustomColor,
    error,
    setError,
  } = useProductForm();

  const isStandalone = mode === 'standalone';

  if (isChildProduct) {
    return (
      <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p>
          This variant&apos;s sellable colour is set on the parent Variants table. Marketing swatches
          are edited on the parent only.
        </p>
        {childAssignedColorDisplay ? (
          <div className="flex items-center gap-3">
            <span
              style={
                childAssignedColorDisplay.swatch
                  ? undefined
                  : { backgroundColor: childAssignedColorDisplay.colorHex }
              }
              className={`h-8 w-8 rounded-full border border-gray-300 ${getPredefinedColorSwatchClassName(childAssignedColorDisplay)}`}
            />
            <span className="font-semibold">{childAssignedColorDisplay.colorName}</span>
          </div>
        ) : (
          <p>No colour assigned yet.</p>
        )}
        {typeof onOpenParent === 'function' && product?.parentProductId ? (
          <button
            type="button"
            onClick={() => onOpenParent(String(product.parentProductId))}
            className="text-xs font-semibold text-primary underline"
          >
            Open parent editor
          </button>
        ) : null}
        {childAssignedColorName && !childAssignedColorIsPredefined && childAssignedColorDisplay ? (
          <p className="text-xs text-gray-600">Custom colour on this SKU.</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        {isStandalone
          ? 'Optional presentation swatches only — this product is still one SKU. The product page opens on the first colour.'
          : 'Pick the colours this product is sold in. Variant SKUs only use these. Commercial default is the Def SKU row, not a colour.'}
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-1.5">
        {AVAILABLE_COLORS.map((color) => {
          const isSelected = formData.colorVariants?.some((v) => v.colorName === color.name);
          return (
            <button
              key={color.name}
              type="button"
              aria-pressed={Boolean(isSelected)}
              onClick={() => handleColorChange(color)}
              className={`flex min-w-0 items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors ${
                isSelected
                  ? 'border-neutral-400/70 bg-neutral-50 shadow-[inset_0_0_0_1px_rgba(23,23,23,0.06)]'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <span
                style={color.swatch ? undefined : { backgroundColor: color.hex }}
                className={`relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${getPredefinedColorSwatchClassName(color)} ${
                  isSelected
                    ? 'border-gray-400 ring-2 ring-neutral-900/25 ring-offset-1'
                    : 'border-gray-300'
                }`}
                aria-hidden
              >
                {isSelected ? (
                  <svg
                    viewBox="0 0 12 12"
                    className={`h-2.5 w-2.5 drop-shadow-sm ${
                      color.name === 'White' ||
                      color.name === 'Transparent' ||
                      color.name === 'Beige' ||
                      color.name === 'Yellow' ||
                      color.name === 'Silver'
                        ? 'text-neutral-800'
                        : 'text-white'
                    }`}
                    fill="none"
                  >
                    <path
                      d="M2.5 6.2 4.8 8.5 9.5 3.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : null}
              </span>
              <span
                className={`min-w-0 flex-1 truncate text-xs leading-none ${
                  isSelected ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'
                }`}
              >
                {color.name}
              </span>
            </button>
          );
        })}
      </div>

      {getCustomColors().length > 0 ? (
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {getCustomColors().map((variant) => (
            <div
              key={variant.colorName}
              className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-2.5 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  style={{ backgroundColor: variant.colorHex }}
                  className="h-5 w-5 shrink-0 rounded-full border border-gray-300"
                />
                <span className="truncate text-xs font-medium text-gray-900">{variant.colorName}</span>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveCustomColor(variant.colorName)}
                className="rounded-md p-1.5 text-red-500 transition-colors hover:bg-red-50"
                aria-label={`Remove ${variant.colorName}`}
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleOpenColorPicker}
        className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 transition-colors hover:border-neutral-900 hover:bg-gray-50"
      >
        <PlusIcon className="h-3.5 w-3.5" /> Add custom colour
      </button>

      {showColorPicker ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowColorPicker(false);
              setCustomColorName('');
              setCustomColorHex('#000000');
              setError('');
            }
          }}
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Add custom colour</h3>
              <button
                type="button"
                onClick={() => {
                  setShowColorPicker(false);
                  setCustomColorName('');
                  setCustomColorHex('#000000');
                  setError('');
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            {error ? (
              <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}
            <ColorPicker
              key={`picker-${showColorPicker}`}
              initialColor={customColorHex}
              initialName={customColorName}
              onColorChange={(hex) => {
                setCustomColorHex(hex);
                setError('');
              }}
              onNameChange={(name) => {
                setCustomColorName(name);
                setError('');
              }}
            />
            <div className="mt-6 flex justify-end gap-3 border-t pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowColorPicker(false);
                  setCustomColorName('');
                  setCustomColorHex('#000000');
                  setError('');
                }}
                className="rounded-md bg-gray-200 px-4 py-2 font-semibold text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddCustomColor}
                className="rounded-md bg-primary px-4 py-2 font-semibold text-white"
              >
                Add colour
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ColorPhotosPanel() {
  const {
    formData,
    isChildProduct,
    isUploading,
    handleColorImageUpload,
    handleRemoveColorImage,
  } = useProductForm();

  if (isChildProduct) {
    return (
      <p className="text-sm text-gray-500">
        Per-colour galleries are stored on the parent product. Child SKUs inherit them unless this
        row has its own images.
      </p>
    );
  }

  const variants = formData.colorVariants || [];
  if (variants.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No colours selected yet. Pick colours on the Selling step, then come back here to upload
        photos for each colour.
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      <p className="text-[11px] leading-snug text-gray-500">
        Shared by every size of that colour. Variant-row photos are SKU-only overrides.
      </p>
      {variants.map((variant) => (
        <div
          key={variant.colorName}
          className="rounded-md border border-gray-200 bg-gray-50/80 px-2.5 py-2"
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                style={{ backgroundColor: variant.colorHex }}
                className="h-5 w-5 rounded-full border border-gray-300"
              />
              <span className="text-xs font-medium text-gray-900">{variant.colorName}</span>
            </div>
            <label className="cursor-pointer rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-800 hover:border-neutral-900 hover:bg-neutral-900 hover:text-white">
              {isUploading ? 'Uploading…' : 'Upload'}
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                disabled={isUploading}
                onChange={(e) => handleColorImageUpload(e, variant.colorName)}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(variant.images || []).map((url, imageIndex) => (
              <div key={`${url}-${imageIndex}`} className="relative h-14 w-14">
                <Image
                  src={url}
                  alt=""
                  width={56}
                  height={56}
                  unoptimized
                  className="h-14 w-14 rounded-md border border-gray-200 object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveColorImage(variant.colorName, imageIndex)}
                  className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-red-600 text-[9px] leading-4 text-white"
                  aria-label="Remove colour photo"
                >
                  ×
                </button>
              </div>
            ))}
            {(variant.images || []).length === 0 ? (
              <p className="text-[11px] text-gray-400">Falls back to hero on storefront.</p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
