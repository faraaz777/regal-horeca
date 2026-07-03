'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import SalesCollectionDetail from '@/components/sales/SalesCollectionDetail';

function CollectionDetailPageInner() {
  const params = useParams();
  const collectionId = params?.id;

  if (!collectionId) {
    return <p className="text-sm text-gray-500">Invalid collection</p>;
  }

  return <SalesCollectionDetail collectionId={collectionId} />;
}

export default function SalesCollectionDetailPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-500">Loading…</p>}>
      <CollectionDetailPageInner />
    </Suspense>
  );
}
