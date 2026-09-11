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
 * Per-colour galleries are uploaded on Media so SKU generation does not require
 * bouncing back to a second colour picker.
 */
export function ColorSelectionPanel() {
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
    handleSetDefaultColor,
  } = useProductForm();

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
      <p className="text-sm text-gray-600">
        Pick the colours this product is sold in. Variant SKUs will only use these colours. Photos
        for each colour are uploaded on the Media step.
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-2">
        {AVAILABLE_COLORS.map((color) => {
          const isSelected = formData.colorVariants?.some((v) => v.colorName === color.name);
          const isDefault = formData.colorVariants?.some(
            (v) => v.colorName === color.name && v.isDefault
          );
          return (
            <label
              key={color.name}
              className={`flex cursor-pointer items-start gap-2 rounded-lg border-2 p-2.5 min-w-0 ${
                isSelected ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="checkbox"
                checked={Boolean(isSelected)}
                onChange={() => handleColorChange(color)}
                className="mt-0.5 h-4 w-4 rounded text-primary"
              />
              <span
                style={color.swatch ? undefined : { backgroundColor: color.hex }}
                className={`h-6 w-6 shrink-0 rounded-full border-2 border-gray-300 ${getPredefinedColorSwatchClassName(color)}`}
              />
              <span className="min-w-0 flex-1 text-sm font-medium leading-snug">
                {color.name}
                {isDefault ? <span className="block text-[10px] text-amber-700">Default</span> : null}
              </span>
            </label>
          );
        })}
      </div>

      {getCustomColors().length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {getCustomColors().map((variant) => (
            <div
              key={variant.colorName}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3"
            >
              <button
                type="button"
                onClick={() => handleSetDefaultColor(variant.colorName)}
                className="flex min-w-0 items-center gap-2 text-left"
                title="Set as default colour"
              >
                <span
                  style={{ backgroundColor: variant.colorHex }}
                  className="h-8 w-8 shrink-0 rounded-full border border-gray-300"
                />
                <span className="truncate text-sm font-medium">{variant.colorName}</span>
              </button>
              <button
                type="button"
                onClick={() => handleRemoveCustomColor(variant.colorName)}
                className="p-1.5 text-red-500 hover:bg-red-50 rounded-md"
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
        className="inline-flex items-center gap-2 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary hover:border-primary/50"
      >
        <PlusIcon className="h-4 w-4" /> Add custom colour
      </button>

      {formData.colorVariants?.length > 1 ? (
        <p className="text-xs text-gray-500">
          Star a default on Media, or click a custom colour name to set default. The first selected
          colour is default until you change it.
        </p>
      ) : null}

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
    handleSetDefaultColor,
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
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Upload once per colour here (Media step). These photos are shared by every size of that
        colour. Photos uploaded on a variant row are SKU-only overrides and do not appear in this
        panel.
      </p>
      {variants.map((variant) => (
        <div
          key={variant.colorName}
          className={`rounded-lg border-2 p-4 ${
            variant.isDefault ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-gray-50'
          }`}
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                style={{ backgroundColor: variant.colorHex }}
                className="h-6 w-6 rounded-full border border-gray-300"
              />
              <span className="font-medium text-gray-900">{variant.colorName}</span>
              {variant.isDefault ? (
                <span className="text-[11px] font-semibold text-amber-800">Default</span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSetDefaultColor(variant.colorName)}
                  className="text-[11px] font-semibold text-primary underline"
                >
                  Set default
                </button>
              )}
            </div>
            <label className="cursor-pointer rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-gray-50">
              {isUploading ? 'Uploading…' : 'Upload photos'}
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
          <div className="flex flex-wrap gap-2">
            {(variant.images || []).map((url, imageIndex) => (
              <div key={`${url}-${imageIndex}`} className="relative h-16 w-16">
                <Image
                  src={url}
                  alt=""
                  width={64}
                  height={64}
                  unoptimized
                  className="h-16 w-16 rounded-md border border-gray-200 object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveColorImage(variant.colorName, imageIndex)}
                  className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-red-600 text-[10px] leading-5 text-white"
                  aria-label="Remove colour photo"
                >
                  ×
                </button>
              </div>
            ))}
            {(variant.images || []).length === 0 ? (
              <p className="text-xs text-gray-500">Falls back to hero image on the storefront.</p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
