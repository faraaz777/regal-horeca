'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { adminJson } from '@/lib/client/adminFetch';
import { PlusIcon, TrashIcon } from '@/components/Icons';
import SalesCollectionThumbnailInput, {
  SalesCollectionThumb,
} from '@/components/sales/SalesCollectionThumbnail';

const fetcher = (url) => adminJson(url);

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function SalesCollectionsList() {
  const { data, mutate, isLoading } = useSWR('/api/sales/collections', fetcher);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const collections = data?.collections || [];

  const resetForm = () => {
    setName('');
    setDescription('');
    setThumbnailUrl('');
    setCreating(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setSubmitting(true);
    try {
      await adminJson('/api/sales/collections', {
        method: 'POST',
        body: JSON.stringify({
          name: trimmed,
          description: description.trim(),
          thumbnailUrl,
        }),
      });
      toast.success('Sales collection created');
      resetForm();
      mutate();
    } catch (err) {
      toast.error(err.message || 'Failed to create collection');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, collectionName) => {
    if (!window.confirm(`Delete "${collectionName}"? This cannot be undone.`)) return;

    setDeletingId(id);
    try {
      await adminJson(`/api/sales/collections/${id}`, { method: 'DELETE' });
      toast.success('Collection deleted');
      mutate();
    } catch (err) {
      toast.error(err.message || 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">My sales collections</h1>
          <p className="text-sm text-gray-500 mt-1">
            Curated product lists for quoting. Save from the catalog, then add to a customer bucket.
          </p>
        </div>
        <Link href="/admin/sales" className="inline-flex items-center min-h-[44px] text-sm text-primary hover:underline shrink-0">
          Back to sales floor
        </Link>
      </div>

      {!creating ? (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-lg hover:opacity-90"
        >
          <PlusIcon className="w-4 h-4" />
          New sales collection
        </button>
      ) : (
        <form
          onSubmit={handleCreate}
          className="bg-white border border-gray-200 rounded-lg p-4 space-y-3"
        >
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-md px-3 py-3 text-base sm:text-sm"
              placeholder="e.g. Hotel starter kit"
              maxLength={120}
              autoFocus
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm resize-none"
              rows={2}
              maxLength={500}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Cover image (optional)
            </label>
            <SalesCollectionThumbnailInput
              value={thumbnailUrl}
              onChange={setThumbnailUrl}
              name={name}
              disabled={submitting}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-3 min-h-[44px] text-sm font-medium bg-primary text-white rounded-md disabled:opacity-50"
            >
              {submitting ? 'Creating…' : 'Create'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-5 py-3 min-h-[44px] text-sm text-gray-600"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading collections…</p>
      ) : collections.length === 0 ? (
        <div className="bg-gray-50 border border-dashed border-gray-200 rounded-lg p-8 text-center">
          <p className="text-sm text-gray-600">No sales collections yet.</p>
          <p className="text-xs text-gray-500 mt-1">
            Create one above, or save products from the sales catalog using the bookmark icon.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {collections.map((c) => (
            <li
              key={c._id}
              className="bg-white border border-gray-200 rounded-lg px-4 py-4 flex items-center gap-3"
            >
              <Link
                href={`/admin/sales/collections/${c._id}`}
                className="flex-1 min-w-0 flex items-center gap-3 group"
              >
                <SalesCollectionThumb url={c.thumbnailUrl} name={c.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {c.pinned && (
                      <span className="text-[10px] uppercase tracking-wide text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded shrink-0">
                        Pinned
                      </span>
                    )}
                    <span className="font-medium text-gray-900 group-hover:text-primary truncate">
                      {c.name}
                    </span>
                  </div>
                  {c.description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{c.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {c.itemCount} product{c.itemCount === 1 ? '' : 's'} · Updated{' '}
                    {formatDate(c.updatedAt)}
                  </p>
                </div>
              </Link>
              <button
                type="button"
                disabled={deletingId === c._id}
                onClick={() => handleDelete(c._id, c.name)}
                className="p-3 text-gray-400 hover:text-red-600 disabled:opacity-50 shrink-0 min-h-[44px] min-w-[44px]"
                title="Delete collection"
                aria-label={`Delete ${c.name}`}
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
