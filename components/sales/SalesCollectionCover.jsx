'use client';

import { useEffect, useId, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { uploadSalesCollectionThumbnail } from '@/lib/client/uploadImage';
import { EditIcon } from '@/components/Icons';

/**
 * Playlist-style cover: one square, pencil on the photo.
 * Change / remove live in that menu so the header does not show a second thumbnail.
 */
export default function SalesCollectionCover({
  url = '',
  name = '',
  onChange,
  disabled = false,
}) {
  const inputId = useId();
  const inputRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setOpen(false);
    try {
      const next = await uploadSalesCollectionThumbnail(file);
      onChange(next);
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';

  return (
    <div ref={menuRef} className="relative shrink-0">
      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-sm overflow-hidden bg-warm-white border border-black/[0.06]">
        {url ? (
          <img src={url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center font-display text-3xl text-black/25">
            {initial}
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="sr-only"
        disabled={disabled || uploading}
        onChange={handleFile}
      />

      <button
        type="button"
        disabled={disabled || uploading}
        onClick={() => setOpen((v) => !v)}
        className="absolute bottom-1 right-1 w-11 h-11 inline-flex items-center justify-center rounded-full bg-white text-rich-black shadow-sm border border-black/[0.06] disabled:opacity-40"
        aria-label="Edit cover photo"
        aria-expanded={open}
      >
        <EditIcon className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 w-40 bg-white border border-black/[0.08] shadow-lg py-1 rounded-sm">
          <label
            htmlFor={inputId}
            className="block px-3 py-2.5 text-sm text-rich-black hover:bg-warm-white cursor-pointer"
          >
            {uploading ? 'Uploading…' : url ? 'Change photo' : 'Add photo'}
          </label>
          {url && (
            <button
              type="button"
              className="w-full text-left px-3 py-2.5 text-sm text-accent hover:bg-warm-white"
              onClick={() => {
                setOpen(false);
                onChange('');
              }}
            >
              Remove photo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
