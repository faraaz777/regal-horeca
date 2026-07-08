'use client';

import { Suspense } from 'react';
import SalesCollectionsList from '@/components/sales/SalesCollectionsList';

export default function SalesCollectionsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-500">Loading…</p>}>
      <SalesCollectionsList />
    </Suspense>
  );
}
