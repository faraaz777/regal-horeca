'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { adminJson } from '@/lib/client/adminFetch';
import { primeSalesSessionCache } from '@/lib/client/salesSessionCache';
import SalesCatalogProductCard from '@/components/sales/SalesCatalogProductCard';
import SalesCollectionThumbnailInput, {
  SalesCollectionThumb,
} from '@/components/sales/SalesCollectionThumbnail';

const fetcher = (url) => adminJson(url);

export default function SalesCollectionDetail({ collectionId }) {
  const { data, mutate, isLoading, error } = useSWR(
    `/api/sales/collections/${collectionId}`,
    fetcher
  );
  const { data: sessionData, mutate: mutateSession } = useSWR('/api/sales/session', fetcher, {
    onSuccess: (d) => primeSalesSessionCache(d),
  });

  const [selectedBucketId, setSelectedBucketId] = useState('');
  const [addingAll, setAddingAll] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [savingThumb, setSavingThumb] = useState(false);

  const draftBuckets = useMemo(
    () => (sessionData?.buckets || []).filter((b) => b.status === 'draft'),
    [sessionData?.buckets]
  );

  const activeBucketId = selectedBucketId || draftBuckets[0]?._id || '';
  const activeBucket = draftBuckets.find((b) => b._id === activeBucketId);

  const collection = data?.collection;
  const products = data?.products || [];

  const handleAddProduct = async (product) => {
    if (!activeBucket) {
      toast.error('Open the sales floor and add a customer bucket first');
      return;
    }

    try {
      await adminJson(`/api/sales/buckets/${activeBucket._id}/lines`, {
        method: 'POST',
        body: JSON.stringify({
          productId: product.id,
          quantity: product.suggestedQty || 1,
        }),
      });
      toast.success(`Added ${product.title}`);
      mutateSession();
    } catch (e) {
      toast.error(e.message || 'Failed to add product');
    }
  };

  const handleAddAll = async () => {
    if (!activeBucket) {
      toast.error('Select a draft customer bucket first');
      return;
    }
    if (products.length === 0) return;

    setAddingAll(true);
    try {
      const res = await adminJson(`/api/sales/collections/${collectionId}/add-to-bucket`, {
        method: 'POST',
        body: JSON.stringify({ bucketId: activeBucket._id }),
      });
      const skipped = res.skipped?.length || 0;
      toast.success(
        skipped > 0
          ? `Added ${res.added} products (${skipped} skipped)`
          : `Added ${res.added} products to bucket`
      );
      mutateSession();
    } catch (e) {
      toast.error(e.message || 'Failed to add all');
    } finally {
      setAddingAll(false);
    }
  };

  const handleRemove = async (productId, title) => {
    setRemovingId(productId);
    try {
      await adminJson(`/api/sales/collections/${collectionId}/items/${productId}`, {
        method: 'DELETE',
      });
      toast.success(`Removed ${title}`);
      mutate();
    } catch (e) {
      toast.error(e.message || 'Failed to remove');
    } finally {
      setRemovingId(null);
    }
  };

  const handleThumbnailChange = async (nextUrl) => {
    setSavingThumb(true);
    try {
      await adminJson(`/api/sales/collections/${collectionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ thumbnailUrl: nextUrl }),
      });
      toast.success(nextUrl ? 'Cover image updated' : 'Cover image removed');
      mutate();
    } catch (e) {
      toast.error(e.message || 'Failed to update cover image');
    } finally {
      setSavingThumb(false);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-gray-500">Loading collection…</p>;
  }

  if (error || !collection) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-600">{error?.message || 'Collection not found'}</p>
        <Link href="/admin/sales/collections" className="text-sm text-primary hover:underline">
          Back to sales collections
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex gap-4">
          <SalesCollectionThumb
            url={collection.thumbnailUrl}
            name={collection.name}
            size="lg"
          />
          <div className="min-w-0">
            <Link
              href="/admin/sales/collections"
              className="text-xs text-gray-500 hover:text-primary"
            >
              ← My sales collections
            </Link>
            <h1 className="text-xl font-semibold text-gray-900 mt-1">{collection.name}</h1>
            {collection.description && (
              <p className="text-sm text-gray-500 mt-1">{collection.description}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              {products.length} product{products.length === 1 ? '' : 's'}
            </p>
            <div className="mt-3">
              <SalesCollectionThumbnailInput
                value={collection.thumbnailUrl || ''}
                onChange={handleThumbnailChange}
                name={collection.name}
                disabled={savingThumb}
                compact
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          {draftBuckets.length > 0 ? (
            <label className="text-xs text-gray-600">
              <span className="block mb-1">Add to bucket</span>
              <select
                value={activeBucketId}
                onChange={(e) => setSelectedBucketId(e.target.value)}
                className="border border-gray-200 rounded-md px-2 py-1.5 text-sm min-w-[10rem]"
              >
                {draftBuckets.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.customerName || `Customer ${b.displayNumber}`}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">
              No draft buckets —{' '}
              <Link href="/admin/sales" className="underline">
                open sales floor
              </Link>
            </p>
          )}

          <button
            type="button"
            disabled={!activeBucket || products.length === 0 || addingAll}
            onClick={handleAddAll}
            className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-md disabled:opacity-40"
          >
            {addingAll ? 'Adding…' : 'Add all to bucket'}
          </button>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="bg-gray-50 border border-dashed border-gray-200 rounded-lg p-8 text-center">
          <p className="text-sm text-gray-600">This collection is empty.</p>
          <Link href="/admin/sales" className="text-sm text-primary hover:underline mt-2 inline-block">
            Browse catalog to save products
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {products.map((p) => (
            <div key={p.id} className="relative">
              <SalesCatalogProductCard
                product={p}
                canAdd={Boolean(activeBucket)}
                onAdd={() => handleAddProduct(p)}
              />
              {(p.collectionNote || p.suggestedQty > 1) && (
                <div className="mt-1 px-1 text-[11px] text-gray-500">
                  {p.suggestedQty > 1 && <span>Qty {p.suggestedQty}</span>}
                  {p.collectionNote && (
                    <span className={p.suggestedQty > 1 ? ' · ' : ''}>{p.collectionNote}</span>
                  )}
                </div>
              )}
              <button
                type="button"
                disabled={removingId === p.id}
                onClick={() => handleRemove(p.id, p.title)}
                className="absolute top-2 left-2 z-10 text-[10px] px-1.5 py-0.5 rounded bg-white/90 border border-gray-200 text-gray-500 hover:text-red-600 disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
