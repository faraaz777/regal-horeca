'use client';

import { Suspense } from 'react';
import SalesRequestsContent from './SalesRequestsContent';

export default function SalesRequestsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-500">Loading…</p>}>
      <SalesRequestsContent />
    </Suspense>
  );
}
