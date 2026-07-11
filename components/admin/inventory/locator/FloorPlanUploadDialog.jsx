'use client';

import { useCallback, useRef, useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { FLOOR_PLAN_ALLOWED_MIME, FLOOR_PLAN_MAX_BYTES } from '@/lib/shared/floorLayoutConstants';

export default function FloorPlanUploadDialog({ open, onClose, onUpload, hasExisting }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [repositionMode, setRepositionMode] = useState('keep_proportional');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const reset = useCallback(() => {
    setFile(null);
    setPreview(null);
    setError('');
    setRepositionMode('keep_proportional');
  }, []);

  const handleClose = () => {
    reset();
    onClose?.();
  };

  const handleFile = (nextFile) => {
    setError('');
    if (!nextFile) return;
    if (!FLOOR_PLAN_ALLOWED_MIME.includes(nextFile.type)) {
      setError('Use PNG, JPG, JPEG, or WebP.');
      return;
    }
    if (nextFile.size > FLOOR_PLAN_MAX_BYTES) {
      setError('File exceeds 15MB limit.');
      return;
    }
    setFile(nextFile);
    setPreview(URL.createObjectURL(nextFile));
  };

  const handleConfirm = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      await onUpload(file, repositionMode);
      handleClose();
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Upload floor plan</h2>
          <button type="button" onClick={handleClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full border-2 border-dashed border-gray-200 rounded-lg py-8 text-center hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors"
          >
            <Upload className="mx-auto text-gray-400 mb-2" size={24} />
            <p className="text-xs font-semibold text-gray-700">Choose PNG, JPG, or WebP</p>
            <p className="text-[10px] text-gray-400 mt-1">Max 15MB</p>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />

          {preview && (
            <div className="rounded-lg border border-gray-200 overflow-hidden bg-slate-50">
              <img src={preview} alt="Preview" className="w-full max-h-48 object-contain" />
            </div>
          )}

          {hasExisting && (
            <fieldset className="text-xs space-y-1.5">
              <legend className="font-semibold text-gray-700">Replace existing image</legend>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="reposition"
                  checked={repositionMode === 'keep_proportional'}
                  onChange={() => setRepositionMode('keep_proportional')}
                />
                Keep zone and rack positions proportionally
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="reposition"
                  checked={repositionMode === 'reset'}
                  onChange={() => setRepositionMode('reset')}
                />
                Reset zones and rack positions
              </label>
            </fieldset>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50">
          <button type="button" onClick={handleClose} className="px-3 py-1.5 text-xs font-semibold text-gray-600">
            Cancel
          </button>
          <button
            type="button"
            disabled={!file || uploading}
            onClick={handleConfirm}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 text-white disabled:opacity-50"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : null}
            Upload
          </button>
        </div>
      </div>
    </div>
  );
}
