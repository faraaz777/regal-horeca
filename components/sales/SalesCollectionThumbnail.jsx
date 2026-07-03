'use client';

import { useId, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { uploadSalesCollectionThumbnail } from '@/lib/client/uploadImage';

const SIZE_CLASS = {
  sm: 'w-12 h-12 text-sm',
  md: 'w-16 h-16 text-base',
  lg: 'w-24 h-24 text-xl',
};

export function SalesCollectionThumb({ url, name, size = 'md' }) {
  const box = SIZE_CLASS[size] || SIZE_CLASS.md;

  if (url) {
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        decoding="async"
        className={`${box} rounded-md object-cover border border-gray-200 shrink-0 bg-gray-50`}
      />
    );
  }

  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';

  return (
    <div
      className={`${box} rounded-md border border-gray-200 shrink-0 bg-gray-100 flex items-center justify-center font-semibold text-gray-500`}
      aria-hidden
    >
      {initial}
    </div>
  );
}

export default function SalesCollectionThumbnailInput({
  value = '',
  onChange,
  name = '',
  disabled = false,
  compact = false,
}) {
  const inputId = useId();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const url = await uploadSalesCollectionThumbnail(file);
      onChange(url);
      toast.success('Thumbnail uploaded');
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className={`flex items-center gap-3 ${compact ? '' : 'py-1'}`}>
      <SalesCollectionThumb url={value} name={name} size={compact ? 'sm' : 'md'} />

      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleFile}
          disabled={disabled || uploading}
          className="sr-only"
          id={inputId}
        />
        <label
          htmlFor={inputId}
          className={`text-xs font-medium px-2.5 py-1.5 rounded-md border border-gray-200 cursor-pointer hover:bg-gray-50 ${
            disabled || uploading ? 'opacity-50 pointer-events-none' : ''
          }`}
        >
          {uploading ? 'Uploading…' : value ? 'Change image' : 'Add image'}
        </label>
        {value && !uploading && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange('')}
            className="text-xs text-gray-500 hover:text-red-600 disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
