'use client';

import { useState, useRef, useEffect } from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { adminJson } from '@/lib/client/adminFetch';
import { PlusIcon } from '@/components/Icons';

const fetcher = (url) => adminJson(url);

function BookmarkIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
      />
    </svg>
  );
}

export default function SalesSaveToCollectionMenu({
  productId,
  productTitle,
  className = '',
  variant = 'icon',
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [savingId, setSavingId] = useState(null);
  const wrapperRef = useRef(null);

  const { data, mutate, isLoading } = useSWR(
    open ? '/api/sales/collections' : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const collections = data?.collections || [];

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        setCreating(false);
        setNewName('');
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const saveToCollection = async (collectionId, collectionName) => {
    setSavingId(collectionId);
    try {
      await adminJson(`/api/sales/collections/${collectionId}/items`, {
        method: 'POST',
        body: JSON.stringify({ productId }),
      });
      toast.success(`Saved to ${collectionName}`);
      setOpen(false);
    } catch (e) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSavingId(null);
    }
  };

  const handleCreateAndSave = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;

    setSavingId('new');
    try {
      const res = await adminJson('/api/sales/collections', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      await adminJson(`/api/sales/collections/${res.collection._id}/items`, {
        method: 'POST',
        body: JSON.stringify({ productId }),
      });
      toast.success(`Created "${name}" and saved product`);
      setNewName('');
      setCreating(false);
      setOpen(false);
      mutate();
    } catch (err) {
      toast.error(err.message || 'Failed to create collection');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          variant === 'text'
            ? 'px-3 py-2 text-sm font-medium border border-gray-200 rounded-md text-gray-700 hover:bg-gray-50'
            : 'p-1 rounded-full bg-white/90 border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-white shadow-sm'
        }
        title="Save to collection"
        aria-label={`Save ${productTitle || 'product'} to collection`}
      >
        {variant === 'text' ? 'Save to collection' : <BookmarkIcon />}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 z-20 w-56 bg-white border border-gray-200 rounded-lg shadow-lg py-1 text-sm">
          <p className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-100">
            Save to collection
          </p>

          {isLoading ? (
            <p className="px-3 py-3 text-gray-500 text-xs">Loading…</p>
          ) : (
            <>
              {collections.length === 0 && !creating && (
                <p className="px-3 py-2 text-xs text-gray-500">No collections yet</p>
              )}

              {collections.map((c) => (
                <button
                  key={c._id}
                  type="button"
                  disabled={savingId === c._id}
                  onClick={() => saveToCollection(c._id, c.name)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 disabled:opacity-50 truncate"
                >
                  {c.name}
                  {c.itemCount > 0 && (
                    <span className="text-gray-400 ml-1">({c.itemCount})</span>
                  )}
                </button>
              ))}

              {creating ? (
                <form onSubmit={handleCreateAndSave} className="px-3 py-2 border-t border-gray-100 space-y-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Collection name"
                    className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs"
                    autoFocus
                    maxLength={120}
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={!newName.trim() || savingId === 'new'}
                      className="flex-1 py-1 text-xs font-medium bg-primary text-white rounded disabled:opacity-50"
                    >
                      Create & save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCreating(false);
                        setNewName('');
                      }}
                      className="px-2 py-1 text-xs text-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="w-full text-left px-3 py-2 text-primary hover:bg-gray-50 border-t border-gray-100 flex items-center gap-1.5"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                  New collection
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
