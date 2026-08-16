'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { adminJson } from '@/lib/client/adminFetch';
import { primeSalesSessionCache } from '@/lib/client/salesSessionCache';
import { ChevronLeftIcon, Grid2x2Icon, ListIcon, PlusIcon, SearchIcon } from '@/components/Icons';
import SalesCollectionCover from '@/components/sales/SalesCollectionCover';
import SalesCollectionAddProductsModal from '@/components/sales/SalesCollectionAddProductsModal';
import SalesCollectionPresentationSet from '@/components/sales/SalesCollectionPresentationSet';
import SalesCollectionProductRow from '@/components/sales/SalesCollectionProductRow';

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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cardView, setCardView] = useState(false);

  const draftBuckets = useMemo(
    () => (sessionData?.buckets || []).filter((b) => b.status === 'draft'),
    [sessionData?.buckets]
  );

  const activeBucketId = selectedBucketId || draftBuckets[0]?._id || '';
  const activeBucket = draftBuckets.find((b) => b._id === activeBucketId);

  const collection = data?.collection;
  const products = data?.products || [];

  const handleAddProduct = async (product, options = {}) => {
    if (!activeBucket) {
      toast.error('Open the sales floor and add a customer bucket first');
      return;
    }

    const quantity = Math.max(
      1,
      parseInt(options.quantity, 10) || product.suggestedQty || 1
    );

    try {
      await adminJson(`/api/sales/buckets/${activeBucket._id}/lines`, {
        method: 'POST',
        body: JSON.stringify({
          productId: product.id,
          quantity,
        }),
      });
      toast.success(`Added ${product.title}${quantity > 1 ? ` × ${quantity}` : ''}`);
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
          : `Added ${res.added} products to quote`
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
      toast.success(nextUrl ? 'Cover updated' : 'Cover removed');
      mutate();
    } catch (e) {
      toast.error(e.message || 'Failed to update cover');
    } finally {
      setSavingThumb(false);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-black/40">Loading collection…</p>;
  }

  if (error || !collection) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-600">{error?.message || 'Collection not found'}</p>
        <Link href="/admin/sales/collections" className="text-sm text-rich-black hover:underline">
          Back to collections
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <SalesCollectionCover
          url={collection.thumbnailUrl || ''}
          name={collection.name}
          onChange={handleThumbnailChange}
          disabled={savingThumb}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 min-w-0">
            <Link
              href="/admin/sales/collections"
              className="shrink-0 w-11 h-11 inline-flex items-center justify-center text-black/40 hover:text-rich-black"
              aria-label="Back to collections"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </Link>
            <h1 className="font-display text-[1.75rem] sm:text-[2rem] font-semibold text-rich-black truncate leading-tight tracking-tight">
              {collection.name}
            </h1>
          </div>
          <div className="pl-11 text-[10px] font-semibold uppercase tracking-[0.18em] text-black/35">
            {products.length} product{products.length === 1 ? '' : 's'}
          </div>
          {collection.description && (
            <p className="pl-11 text-sm text-black/40 mt-1 line-clamp-1">{collection.description}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 ml-auto">
          {draftBuckets.length > 0 ? (
            <select
              value={activeBucketId}
              onChange={(e) => setSelectedBucketId(e.target.value)}
              aria-label="Quote customer"
              className="border border-black/10 bg-warm-white px-3 py-2.5 text-sm min-w-[10rem] min-h-[44px] rounded-sm text-rich-black focus:outline-none focus:border-rich-black"
            >
              {draftBuckets.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.customerName || `Customer ${b.displayNumber}`}
                </option>
              ))}
            </select>
          ) : (
            <Link href="/admin/sales" className="text-xs text-black/50 underline min-h-[44px] inline-flex items-center">
              Open sales floor for a quote
            </Link>
          )}
          <button
            type="button"
            disabled={!activeBucket || products.length === 0 || addingAll}
            onClick={handleAddAll}
            className="min-h-[44px] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] bg-rich-black text-white disabled:opacity-35 rounded-sm hover:opacity-90 transition-opacity"
          >
            {addingAll ? 'Adding…' : 'Add all'}
          </button>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)] lg:gap-6 lg:items-start">
        <SalesCollectionPresentationSet
          collectionId={collectionId}
          presentationSet={collection.presentationSet}
          products={products}
          canAddToBucket={Boolean(activeBucket)}
          onAddToBucket={handleAddProduct}
          onUpdated={mutate}
        />

        <div className="mt-4 lg:mt-0 lg:max-h-[calc(100dvh-11rem)] lg:overflow-y-auto border-t lg:border-t-0 lg:border-l border-black/[0.06] lg:pl-5 pt-3 lg:pt-0">
          <div className="sticky top-0 z-10 flex items-center gap-2 mb-3 bg-white">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="min-h-[44px] flex-1 flex items-center gap-2.5 px-3 text-sm text-black/35 bg-warm-white border border-black/10 rounded-sm hover:border-black/25 hover:text-rich-black text-left transition-colors"
            >
              <SearchIcon className="w-4 h-4 shrink-0" />
              <span className="flex-1">Add products</span>
              <PlusIcon className="w-4 h-4 shrink-0 text-rich-black" />
            </button>
            <div className="shrink-0 flex items-center border border-black/10 rounded-sm p-0.5 bg-warm-white">
              <button
                type="button"
                onClick={() => setCardView(false)}
                aria-pressed={!cardView}
                aria-label="List view"
                className={`w-9 h-9 inline-flex items-center justify-center rounded-sm ${
                  cardView ? 'text-black/35' : 'bg-rich-black text-white'
                }`}
              >
                <ListIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCardView(true)}
                aria-pressed={cardView}
                aria-label="Card view"
                className={`w-9 h-9 inline-flex items-center justify-center rounded-sm ${
                  cardView ? 'bg-rich-black text-white' : 'text-black/35'
                }`}
              >
                <Grid2x2Icon className="w-4 h-4" />
              </button>
            </div>
          </div>
          {products.length === 0 ? (
            <p className="py-8 text-sm text-black/40">No products in this collection yet.</p>
          ) : (
            <div className={cardView ? 'grid grid-cols-2 gap-2' : ''}>
              {products.map((p) => (
                <SalesCollectionProductRow
                  key={p.id}
                  product={p}
                  layout={cardView ? 'card' : 'list'}
                  canAdd={Boolean(activeBucket)}
                  onAdd={handleAddProduct}
                  onRemove={handleRemove}
                  removing={removingId === p.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {pickerOpen && (
        <SalesCollectionAddProductsModal
          collectionId={collectionId}
          existingProductIds={products.map((p) => p.id)}
          onClose={() => setPickerOpen(false)}
          onAdded={() => mutate()}
        />
      )}
    </div>
  );
}
