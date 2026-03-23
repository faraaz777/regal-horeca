'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Download } from 'lucide-react';

export default function AttachmentPage() {
  const searchParams = useSearchParams();
  const src = searchParams.get('src') || '';
  const label = searchParams.get('label') || 'Attachment';
  const proxySrc = src ? `/api/attachment/proxy?src=${encodeURIComponent(src)}` : '';
  const proxyDownloadSrc = src ? `/api/attachment/proxy?download=1&src=${encodeURIComponent(src)}` : '';

  const isPdf = useMemo(() => {
    const lower = src.toLowerCase();
    return lower.includes('.pdf') || lower.includes('application/pdf');
  }, [src]);

  const isImage = useMemo(() => {
    const lower = src.toLowerCase();
    return ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].some((ext) => lower.includes(ext));
  }, [src]);

  return (
    <div className="min-h-screen bg-white">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <Link
            href="/catalog"
            className="inline-flex items-center gap-2 text-sm font-semibold text-black/70 hover:text-accent transition-colors"
          >
            <ArrowLeft size={16} />
            Back
          </Link>
          <div className="text-lg font-semibold text-rich-black">{label}</div>
          {src ? (
            <a
              href={proxyDownloadSrc}
              download
              className="inline-flex items-center gap-2 px-4 h-10 rounded-lg border border-black/10 bg-white text-sm font-semibold text-rich-black hover:border-accent hover:text-accent transition-colors"
            >
              <Download size={16} />
              Download
            </a>
          ) : <div />}
        </div>

        {!src ? (
          <div className="rounded-xl border border-black/10 p-8 text-center text-black/50">
            Attachment not found.
          </div>
        ) : isPdf ? (
          <div className="rounded-xl border border-black/10 overflow-hidden h-[80vh]">
            <iframe
              src={proxySrc}
              title={label}
              className="w-full h-full"
            />
          </div>
        ) : isImage ? (
          <div className="rounded-xl border border-black/10 overflow-hidden bg-black/5 min-h-[60vh] flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={proxySrc} alt={label} className="max-w-full max-h-[80vh] object-contain" />
          </div>
        ) : (
          <div className="rounded-xl border border-black/10 p-8 text-center">
            <p className="text-black/60 mb-4">Preview not available for this file type.</p>
            <a
              href={proxySrc}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 h-10 rounded-lg border border-black/10 bg-white text-sm font-semibold text-rich-black hover:border-accent hover:text-accent transition-colors"
            >
              Open File
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
