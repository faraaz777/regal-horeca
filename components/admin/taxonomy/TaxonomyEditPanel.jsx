'use client';

import { useEffect, useState } from 'react';
import { XIcon } from '@/components/Icons';
import { showToast } from '@/lib/utils/toast';
import { getTaxonomyPath, slugifyTaxonomyName } from '@/lib/taxonomy/taxonomyTreeUtils';
import TaxonomyLevelBadge from './TaxonomyLevelBadge';
import { uploadTaxonomyImage } from './uploadTaxonomyImage';

const inputClass =
  'mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm shadow-sm transition-colors focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-100';

/**
 * Slide-over edit panel for a taxonomy node.
 */
export default function TaxonomyEditPanel({ config, node, idMap, saving, onClose, onSave }) {
  const [form, setForm] = useState({ name: '', slug: '', tagline: '', image: '' });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const nodeId = node?._id ?? node?.id;
  const path = nodeId ? getTaxonomyPath(nodeId?.toString?.() ?? nodeId, idMap) : [];

  useEffect(() => {
    if (!node) return;
    setForm({
      name: node.name || '',
      slug: node.slug || '',
      tagline: node.tagline || '',
      image: node.image || '',
    });
    setError('');
  }, [node]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const url = await uploadTaxonomyImage(file, config.uploadFolder || 'categories');
      setForm((prev) => ({ ...prev, image: url }));
      showToast.success('Image uploaded');
    } catch (err) {
      setError(err.message);
      showToast.error(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || slugifyTaxonomyName(form.name),
      tagline: form.tagline,
      level: node.level,
      parent: node.parent?._id ?? node.parent ?? null,
    };
    if (config.supportsImage) payload.image = form.image;
    onSave(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" aria-label="Close" onClick={onClose} />

      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-2xl">
        <header className="border-b border-gray-100 px-5 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Edit {config.singularLabel}</p>
              <h2 className="mt-1 truncate text-lg font-semibold text-gray-900">{node.name}</h2>
              {path.length > 0 && (
                <p className="mt-2 text-xs leading-relaxed text-gray-500">
                  {path.map((segment, i) => (
                    <span key={`${segment}-${i}`}>
                      {i > 0 && <span className="mx-1 text-gray-300">›</span>}
                      <span className={i === path.length - 1 ? 'font-medium text-gray-700' : ''}>{segment}</span>
                    </span>
                  ))}
                </p>
              )}
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
              <XIcon className="h-5 w-5" />
            </button>
          </div>
          <TaxonomyLevelBadge level={node.level} className="mt-3 rounded-full px-2.5 py-1 text-[11px]" />
        </header>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}

            <section className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Name</label>
                <input name="name" value={form.name} onChange={handleChange} required className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Slug</label>
                <input
                  name="slug"
                  value={form.slug}
                  onChange={handleChange}
                  placeholder="auto-generated if blank"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Tagline</label>
                <input name="tagline" value={form.tagline} onChange={handleChange} className={inputClass} />
              </div>
            </section>

            {config.supportsImage && (
              <section className="space-y-3 rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                <p className="text-sm font-medium text-gray-700">Image</p>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleImageUpload}
                  disabled={uploading || saving}
                  className="block w-full text-sm text-gray-600"
                />
                <input
                  name="image"
                  type="url"
                  value={form.image}
                  onChange={handleChange}
                  placeholder="Or paste image URL"
                  className={inputClass}
                />
                {form.image && (
                  <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                    <img src={form.image} alt="" className="h-36 w-full object-contain" />
                  </div>
                )}
              </section>
            )}
          </div>

          <footer className="flex gap-3 border-t border-gray-100 bg-gray-50/80 px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 rounded-lg border border-gray-300 bg-white py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </footer>
        </form>
      </aside>
    </div>
  );
}
