'use client';

/**
 * Label preview + print/PDF.
 *
 * Print uses a body-level sheet and hides every other node so AdminShell
 * and the product list do not appear on the sticker. jsPDF writes the same
 * millimetre page so Download PDF matches the printer stock.
 *
 * Sharpness notes:
 * - Print root is off-screen (not display:none) so fonts/SVG lay out before print.
 * - QR is a high-DPI PNG <img> (inline SVG collapsed in the mm face).
 * - PDF capture targets ~600 dpi; off-viewport -200vw captures were soft.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';
import toast from 'react-hot-toast';
import { XIcon } from '@/components/Icons';
import { SITE_CONFIG } from '@/lib/constants/seo';
import { qrPngDataUrl } from '@/lib/client/productLabelQr';
import {
  DEFAULT_LABEL_SIZE_ID,
  getLabelSize,
  LABEL_SIZES,
  labelQrValue,
} from '@/lib/shared/productLabel';
import ProductLabel from './ProductLabel';

/** Thermal / desktop label printers are usually 203–300 dpi; 600 keeps headroom. */
const PDF_CAPTURE_DPI = 600;

function mmToPx(mm, dpi = PDF_CAPTURE_DPI) {
  return Math.max(1, Math.round((Number(mm) / 25.4) * dpi));
}

function buildPrintCss(size) {
  return `
@media print {
  @page { size: ${size.widthMm}mm ${size.heightMm}mm; margin: 0; }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body > *:not(#product-label-print-root) { display: none !important; }
  #product-label-print-root {
    display: block !important;
    position: static !important;
    left: auto !important;
    top: auto !important;
    width: ${size.widthMm}mm !important;
    height: auto !important;
    overflow: visible !important;
    opacity: 1 !important;
    pointer-events: auto !important;
  }
  #product-label-print-root .product-label-print-page {
    width: ${size.widthMm}mm;
    height: ${size.heightMm}mm;
    overflow: hidden;
    page-break-after: always;
    break-after: page;
  }
  #product-label-print-root .product-label-print-page:last-child {
    page-break-after: auto;
    break-after: auto;
  }
  #product-label-print-root .product-label-face {
    border: none !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  #product-label-print-root .product-label-face img {
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }
}
`.trim();
}

export default function ProductLabelPrintDialog({ items, allowPick = false, onClose }) {
  const captureRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const [sizeId, setSizeId] = useState(DEFAULT_LABEL_SIZE_ID);
  const [selectedIds, setSelectedIds] = useState(() => new Set((items || []).map((item) => item.id)));
  const [qrByKey, setQrByKey] = useState({});
  const [busy, setBusy] = useState(false);

  const size = getLabelSize(sizeId);
  const selectedItems = useMemo(() => {
    const list = Array.isArray(items) ? items : [];
    if (!allowPick) return list;
    return list.filter((item) => selectedIds.has(item.id));
  }, [allowPick, items, selectedIds]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    const baseUrl = SITE_CONFIG.baseUrl;

    (async () => {
      const next = {};
      for (const item of items || []) {
        const value = labelQrValue(item, baseUrl);
        if (!value) continue;
        try {
          next[item.id] = await qrPngDataUrl(value);
        } catch {
          next[item.id] = '';
        }
      }
      if (!cancelled) setQrByKey(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [items]);

  const toggleItem = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePrint = () => {
    if (selectedItems.length === 0) {
      toast.error('Select at least one variant to print.');
      return;
    }
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (selectedItems.length === 0) {
      toast.error('Select at least one variant to export.');
      return;
    }
    const nodes = captureRef.current?.querySelectorAll('[data-label-capture]');
    if (!nodes || nodes.length === 0) {
      toast.error('Label preview is not ready yet.');
      return;
    }

    setBusy(true);
    try {
      const orientation = size.widthMm >= size.heightMm ? 'l' : 'p';
      const pdf = new jsPDF({
        orientation,
        unit: 'mm',
        format: [size.widthMm, size.heightMm],
      });
      const canvasWidth = mmToPx(size.widthMm);
      const canvasHeight = mmToPx(size.heightMm);

      for (let i = 0; i < nodes.length; i += 1) {
        const dataUrl = await toPng(nodes[i], {
          cacheBust: true,
          // Explicit canvas size beats pixelRatio alone — avoids soft captures
          // when the node is visually tiny in CSS mm.
          canvasWidth,
          canvasHeight,
          pixelRatio: 1,
          backgroundColor: '#ffffff',
          style: {
            transform: 'none',
            width: `${size.widthMm}mm`,
            height: `${size.heightMm}mm`,
          },
        });
        if (i > 0) pdf.addPage([size.widthMm, size.heightMm], orientation);
        // NONE keeps the 600 dpi raster; FAST recompresses and softens QR modules.
        pdf.addImage(dataUrl, 'PNG', 0, 0, size.widthMm, size.heightMm, undefined, 'NONE');
      }

      const first = selectedItems[0];
      const slug = first?.sku || first?.slug || 'label';
      pdf.save(`regal-label-${slug}.pdf`);
      toast.success(
        selectedItems.length === 1 ? 'PDF downloaded' : `${selectedItems.length} labels saved as PDF`
      );
    } catch (error) {
      toast.error(error.message || 'Could not create the PDF.');
    } finally {
      setBusy(false);
    }
  };

  if (!mounted) return null;

  const previewItem = selectedItems[0] || items?.[0];

  return createPortal(
    <>
      <style>{buildPrintCss(size)}</style>

      <div
        className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 print:hidden"
        role="presentation"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-label-print-title"
          className="w-full max-w-lg rounded-xl bg-white shadow-xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h2 id="product-label-print-title" className="text-base font-semibold text-gray-900">
              Print product label
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              aria-label="Close"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4 px-4 py-4">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Size</p>
              <div className="flex gap-2">
                {Object.values(LABEL_SIZES).map((option) => {
                  const active = option.id === sizeId;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setSizeId(option.id)}
                      className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                        active
                          ? 'border-gray-900 bg-gray-900 text-white'
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {allowPick ? (
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    Variants
                  </p>
                  <div className="flex gap-2 text-xs">
                    <button
                      type="button"
                      className="text-gray-600 underline-offset-2 hover:underline"
                      onClick={() => setSelectedIds(new Set((items || []).map((item) => item.id)))}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      className="text-gray-600 underline-offset-2 hover:underline"
                      onClick={() => setSelectedIds(new Set())}
                    >
                      None
                    </button>
                  </div>
                </div>
                <ul className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-gray-200 p-2">
                  {(items || []).map((item) => (
                    <li key={item.id}>
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-800">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleItem(item.id)}
                          className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                        />
                        <span className="min-w-0 truncate">
                          {item.variantLine || item.title}
                          {item.sku ? <span className="text-gray-500"> · {item.sku}</span> : null}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Preview
                {selectedItems.length > 1 ? ` · ${selectedItems.length} labels` : ''}
              </p>
              <div className="flex justify-center rounded-lg bg-gray-100 p-4">
                {previewItem ? (
                  <ProductLabel
                    item={previewItem}
                    size={size}
                    qrDataUrl={qrByKey[previewItem.id]}
                  />
                ) : (
                  <p className="text-sm text-gray-500">Select a variant to preview.</p>
                )}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
                In the print dialog: set paper to {size.label}, scale to 100% / Actual size, and turn
                off “fit to page”. Scaling is the usual cause of a soft sticker.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-4 py-3">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={busy || selectedItems.length === 0}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              {busy ? 'Preparing…' : 'Download PDF'}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={busy || selectedItems.length === 0}
              className="rounded-lg bg-black px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              Print
            </button>
          </div>
        </div>
      </div>

      {/*
        Keep the print sheet in layout (opacity/position), not display:none.
        Some engines rasterize poorly from nodes that were never painted.
      */}
      <div
        id="product-label-print-root"
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          width: `${size.widthMm}mm`,
          opacity: 0,
          pointerEvents: 'none',
          zIndex: -1,
          overflow: 'hidden',
        }}
      >
        {selectedItems.map((item) => (
          <div key={`print-${item.id}`} className="product-label-print-page">
            <ProductLabel item={item} size={size} qrDataUrl={qrByKey[item.id]} />
          </div>
        ))}
      </div>

      {/*
        Capture sheet sits on-screen at full mm size under opacity 0.
        Far off-screen (-200vw) made html-to-image soft / undersized.
      */}
      <div
        ref={captureRef}
        className="pointer-events-none fixed left-0 top-0 z-[-1] print:hidden"
        aria-hidden="true"
        style={{ opacity: 0 }}
      >
        {selectedItems.map((item) => (
          <div key={`capture-${item.id}`} data-label-capture>
            <ProductLabel item={item} size={size} qrDataUrl={qrByKey[item.id]} />
          </div>
        ))}
      </div>
    </>,
    document.body
  );
}
