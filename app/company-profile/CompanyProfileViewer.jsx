import Link from 'next/link';
import { Download, ExternalLink, FileText } from 'lucide-react';

/**
 * Company profile PDF viewer.
 *
 * Mobile browsers (especially iOS Safari) do not reliably render PDFs in iframes,
 * so phones get action buttons that open the native PDF viewer instead.
 */
export default function CompanyProfileViewer({ pdfSrc, downloadSrc, title }) {
  return (
    <>
      {/* Mobile: native PDF open / download — avoids blank iframe on iOS & Android */}
      <main className="flex min-h-[100dvh] flex-col items-center justify-center px-6 py-12 text-center md:hidden">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
          <FileText size={32} className="text-accent" aria-hidden />
        </div>
        <h1 className="text-2xl font-semibold text-black">Company Profile</h1>
        <p className="mt-3 max-w-sm text-sm text-black/60">
          {title || 'REGAL® HoReCa business brochure'}
        </p>

        <div className="mt-10 flex w-full max-w-xs flex-col gap-3">
          <a
            href={pdfSrc}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-accent px-6 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-red-600"
          >
            <ExternalLink size={16} aria-hidden />
            View Company Profile
          </a>
          <a
            href={downloadSrc}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-black/10 bg-white px-6 text-xs font-bold uppercase tracking-wider text-black transition-colors hover:border-accent hover:text-accent"
          >
            <Download size={16} aria-hidden />
            Download PDF
          </a>
          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center rounded-md px-6 text-sm font-semibold text-black/60 transition-colors hover:text-accent"
          >
            Back to Home
          </Link>
        </div>
      </main>

      {/* Desktop: inline iframe preview */}
      <main className="hidden h-[100dvh] w-full md:block">
        <iframe
          src={pdfSrc}
          className="h-full w-full border-0"
          title={title || 'Company Profile'}
        />
      </main>
    </>
  );
}
