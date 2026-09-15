'use client';

import Image from 'next/image';
import { TrashIcon } from '@/components/Icons';
import FormCard from '@/components/product-form/ui/FormCard';
import { ColorPhotosPanel } from '@/components/product-form/sections/ProductColorFields';
import { useProductForm } from '@/components/product-form/ProductFormContext';

/** Compact dashed upload — matches Product-step density. */
function FileDrop({ id, hint, accept, multiple, disabled, onChange, children, dense }) {
  return (
    <div
      className={`rounded-md border border-dashed border-gray-300 bg-gray-50/50 text-center transition-colors hover:border-neutral-400 ${
        dense ? 'p-3' : 'p-4'
      }`}
    >
      <input
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={onChange}
        disabled={disabled}
        className="hidden"
      />
      <label
        htmlFor={id}
        className={`flex flex-col items-center ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
      >
        <span className="text-xs font-medium text-gray-600">Drop file or browse</span>
        {hint ? <span className="mt-0.5 text-[11px] text-gray-400">{hint}</span> : null}
      </label>
      {children}
    </div>
  );
}

function InlineAddTile({ id, accept, multiple, disabled, onChange, className = '' }) {
  return (
    <div
      className={`rounded-md border border-dashed border-gray-300 bg-gray-50/50 transition-colors hover:border-neutral-400 ${className}`}
    >
      <input
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={onChange}
        disabled={disabled}
        className="hidden"
      />
      <label
        htmlFor={id}
        className={`flex h-full w-full flex-col items-center justify-center px-2 text-center ${
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
        }`}
      >
        <span className="text-[11px] font-medium leading-tight text-gray-600">Drop file or browse</span>
      </label>
    </div>
  );
}

export default function ProductMediaSection() {
  const {
    formData,
    isUploading,
    handleImageUpload,
    handleRemoveGalleryImage,
    handleRemoveDetailPhoto,
    handleAttachmentUpload,
    setFormData,
  } = useProductForm();

  const detailCount = (formData.detailPhotos || []).filter(Boolean).length;
  const gallery = formData.gallery || [];

  return (
    <div className="space-y-4">
      <FormCard compact title="Hero image" description="Primary product image — required to publish.">
        {!formData.heroImage ? (
          <FileDrop
            id="heroImageInput"
            dense
            hint="JPEG or PNG · max 15 MB"
            accept="image/*"
            disabled={isUploading}
            onChange={(e) => handleImageUpload(e, 'heroImage')}
          />
        ) : (
          <div className="flex flex-wrap items-start gap-2.5">
            <div className="relative">
              <Image
                src={formData.heroImage}
                alt="Hero preview"
                width={112}
                height={112}
                unoptimized
                className="h-28 w-28 rounded-md border border-gray-200 object-cover"
              />
            </div>
            <InlineAddTile
              id="heroImageInput"
              accept="image/*"
              disabled={isUploading}
              onChange={(e) => handleImageUpload(e, 'heroImage')}
              className="h-28 min-w-[7rem]"
            />
          </div>
        )}
      </FormCard>

      <FormCard compact title="Gallery" description="Additional product photos.">
        {gallery.length === 0 ? (
          <FileDrop
            id="galleryInput"
            dense
            accept="image/*"
            multiple
            disabled={isUploading}
            onChange={(e) => handleImageUpload(e, 'gallery')}
          />
        ) : (
          <div className="flex flex-wrap items-start gap-2.5">
            {gallery.map((url, index) => (
              <div key={`${url}-${index}`} className="relative">
                <Image
                  src={url}
                  alt=""
                  width={80}
                  height={80}
                  unoptimized
                  className="h-20 w-20 rounded-md border border-gray-200 object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveGalleryImage(index)}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white"
                  aria-label="Remove gallery image"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <InlineAddTile
              id="galleryInput"
              accept="image/*"
              multiple
              disabled={isUploading}
              onChange={(e) => handleImageUpload(e, 'gallery')}
              className="h-20 min-w-[6.5rem]"
            />
          </div>
        )}
      </FormCard>

      <FormCard
        compact
        title="Colour photos"
        description="One gallery per colour from Selling. Shared by all sizes of that colour."
      >
        <ColorPhotosPanel />
      </FormCard>

      <FormCard
        compact
        title="Detail page photos"
        description="Exactly 0 or 3 — storefront layout expects a trio."
      >
        <p className="mb-2 text-[11px] tabular-nums text-gray-500">{detailCount}/3</p>
        {detailCount === 0 ? (
          <FileDrop
            id="detailPhotosInput"
            dense
            accept="image/*"
            multiple
            disabled={isUploading || detailCount >= 3}
            onChange={(e) => handleImageUpload(e, 'detailPhotos')}
          />
        ) : (
          <div className="flex flex-wrap items-start gap-2.5">
            {formData.detailPhotos.map((url, index) => (
              <div key={`${url}-${index}`} className="relative w-[4.5rem]">
                <div className="relative aspect-[9/16] overflow-hidden rounded-md border border-gray-200 bg-white">
                  <Image src={url} alt="" fill unoptimized className="object-cover" />
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveDetailPhoto(index)}
                  className="absolute -right-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white"
                  aria-label="Remove detail photo"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {detailCount < 3 ? (
              <InlineAddTile
                id="detailPhotosInput"
                accept="image/*"
                multiple
                disabled={isUploading}
                onChange={(e) => handleImageUpload(e, 'detailPhotos')}
                className="min-h-[7.5rem] min-w-[4.5rem]"
              />
            ) : null}
          </div>
        )}
      </FormCard>

      <FormCard compact title="Documents" description="Optional PDFs and blog link.">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div className="rounded-md border border-gray-200 bg-gray-50/80 px-2.5 py-2">
            <p className="mb-1.5 text-xs font-medium text-gray-700">Size chart</p>
            <input
              type="file"
              accept=".pdf,application/pdf"
              disabled={isUploading}
              onChange={(e) => handleAttachmentUpload('sizeChartUrl', e.target.files?.[0])}
              className="w-full text-xs"
            />
            {formData.sizeChartUrl ? (
              <a
                href={formData.sizeChartUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 inline-block text-[11px] text-primary underline"
              >
                View uploaded chart
              </a>
            ) : null}
          </div>
          <div className="rounded-md border border-gray-200 bg-gray-50/80 px-2.5 py-2">
            <p className="mb-1.5 text-xs font-medium text-gray-700">Brochure / catalogue</p>
            <input
              type="file"
              accept=".pdf,application/pdf"
              disabled={isUploading}
              onChange={(e) => handleAttachmentUpload('brochureUrl', e.target.files?.[0])}
              className="w-full text-xs"
            />
            {formData.brochureUrl ? (
              <a
                href={formData.brochureUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 inline-block text-[11px] text-primary underline"
              >
                View uploaded brochure
              </a>
            ) : null}
          </div>
        </div>
        <label className="mt-2.5 block">
          <span className="mb-1 block text-xs font-medium text-gray-600">Blog URL</span>
          <input
            name="blogUrl"
            value={formData.blogUrl || ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, blogUrl: e.target.value }))}
            placeholder="https://"
            className="w-full rounded-md border border-gray-200 px-2.5 py-2 text-sm outline-none focus:border-neutral-900"
          />
        </label>
      </FormCard>
    </div>
  );
}
