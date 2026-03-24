import { Suspense } from 'react';
import AttachmentViewClient from './AttachmentViewClient';

function AttachmentFallback() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center text-black/50 text-sm">
      Loading attachment…
    </div>
  );
}

export default function AttachmentPage() {
  return (
    <Suspense fallback={<AttachmentFallback />}>
      <AttachmentViewClient />
    </Suspense>
  );
}
