'use client';

import Image from 'next/image';
import { TrashIcon } from '@/components/Icons';
import FormCard from '@/components/product-form/ui/FormCard';
import { ColorPhotosPanel } from '@/components/product-form/sections/ProductColorFields';
import { useProductForm } from '@/components/product-form/ProductFormContext';

function FileDrop({ id, label, hint, accept, multiple, disabled, onChange, children }) {
  return (
    <div>
      {label ? <label className="mb-2 block text-sm font-medium text-gray-700">{label}</label> : null}
      <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50/50 p-6 text-center hover:border-primary/40">
        <input
          id={id}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={onChange}
          disabled={disabled}
          className="hidden"
        />
        <label htmlFor={id} className={`flex flex-col items-center ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
          <span className="text-sm font-medium text-gray-600">Drop file or browse</span>
          {hint ? <span className="mt-1 text-xs text-gray-500">{hint}</span> : null}
        </label>
        {children}
      </div>
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

  return (
    <div className="space-y-5">
      <FormCard title="Hero image" description="Primary product image — required to publish.">
        <FileDrop
          id="heroImageInput"
          hint="JPEG or PNG · max 15 MB, auto-compressed above 1.5 MB"
          accept="image/*"
          disabled={isUploading}
          onChange={(e) => handleImageUpload(e, 'heroImage')}
        >
          {formData.heroImage ? (
            <div className="mt-4 inline-block">
              <Image
                src={formData.heroImage}
                alt="Hero preview"
                width={160}
                height={160}
                unoptimized
                className="h-36 w-36 rounded-lg border object-cover"
              />
            </div>
          ) : null}
        </FileDrop>
      </FormCard>

      <FormCard title="Gallery" description="Additional product photos.">
        <FileDrop
          id="galleryInput"
          accept="image/*"
          multiple
          disabled={isUploading}
          onChange={(e) => handleImageUpload(e, 'gallery')}
        />
        {formData.gallery?.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-3">
            {formData.gallery.map((url, index) => (
              <div key={`${url}-${index}`} className="relative">
                <Image src={url} alt="" width={96} height={96} unoptimized className="h-24 w-24 rounded-lg border object-cover" />
                <button
                  type="button"
                  onClick={() => handleRemoveGalleryImage(index)}
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </FormCard>

      <FormCard title="Colour photos" description="One gallery per colour selected on Selling. Shared by all sizes of that colour.">
        <ColorPhotosPanel />
      </FormCard>

      <FormCard
        title="Detail page photos"
        description="Exactly 0 or 3 — 1 or 2 is rejected because the storefront layout expects a trio."
      >
        <p className="text-xs text-gray-500">{detailCount}/3</p>
        <FileDrop
          id="detailPhotosInput"
          accept="image/*"
          multiple
          disabled={isUploading || detailCount >= 3}
          onChange={(e) => handleImageUpload(e, 'detailPhotos')}
        />
        {detailCount > 0 ? (
          <div className="mt-3 grid grid-cols-3 gap-3">
            {formData.detailPhotos.map((url, index) => (
              <div key={`${url}-${index}`} className="relative">
                <div className="relative aspect-[9/16] overflow-hidden rounded-lg border bg-white">
                  <Image src={url} alt="" fill unoptimized className="object-cover" />
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveDetailPhoto(index)}
                  className="absolute -right-2 -top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </FormCard>

      <FormCard title="Documents" description="Optional PDFs.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="mb-2 text-sm font-medium">Size chart</p>
            <input
              type="file"
              accept=".pdf,application/pdf"
              disabled={isUploading}
              onChange={(e) => handleAttachmentUpload('sizeChartUrl', e.target.files?.[0])}
              className="w-full text-sm"
            />
            {formData.sizeChartUrl ? (
              <a href={formData.sizeChartUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-primary underline">
                View uploaded chart
              </a>
            ) : null}
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="mb-2 text-sm font-medium">Brochure / catalogue</p>
            <input
              type="file"
              accept=".pdf,application/pdf"
              disabled={isUploading}
              onChange={(e) => handleAttachmentUpload('brochureUrl', e.target.files?.[0])}
              className="w-full text-sm"
            />
            {formData.brochureUrl ? (
              <a href={formData.brochureUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-primary underline">
                View uploaded brochure
              </a>
            ) : null}
          </div>
        </div>
        <label className="mt-3 block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Blog URL</span>
          <input
            name="blogUrl"
            value={formData.blogUrl || ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, blogUrl: e.target.value }))}
            placeholder="https://"
            className="w-full rounded-lg border border-gray-300 p-2.5 text-sm"
          />
        </label>
      </FormCard>
    </div>
  );
}
