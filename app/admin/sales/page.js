'use client';

import { Suspense } from 'react';
import SalesWorkspace from '@/components/sales/SalesWorkspace';

export default function SalesFloorPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-500">Loading sales floor…</p>}>
      <SalesWorkspace />
    </Suspense>
  );
}
