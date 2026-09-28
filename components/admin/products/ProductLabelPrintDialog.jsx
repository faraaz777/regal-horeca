'use client';

/**
 * Label preview + print/PDF.
 *
 * Print uses a body-level sheet and hides every other node so AdminShell
 * and the product list do not appear on the sticker. jsPDF writes the same
 * millimetre page so Download PDF matches the printer stock.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';
import toast from 'react-hot-toast';
import { XIcon } from '@/components/Icons';
import { SITE_CONFIG } from '@/lib/constants/seo';
import { qrSvgDataUrl } from '@/lib/client/productLabelQr';
import {
  DEFAULT_LABEL_SIZE_ID,
  getLabelSize,
  LABEL_SIZES,
  labelQrValue,
} from '@/lib/shared/productLabel';
import ProductLabel from './ProductLabel';

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
    width: ${size.widthMm}mm;
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
  #product-label-print-root .product-label-face { border: none !important; }
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
          next[item.id] = await qrSvgDataUrl(value);
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

      for (let i = 0; i < nodes.length; i += 1) {
        const dataUrl = await toPng(nodes[i], {
          cacheBust: true,
          pixelRatio: 6,
          backgroundColor: '#ffffff',
        });
        if (i > 0) pdf.addPage([size.widthMm, size.heightMm], orientation);
        pdf.addImage(dataUrl, 'PNG', 0, 0, size.widthMm, size.heightMm);
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
                Set the printer paper to {size.label} and turn off “fit to page”, or the sticker will shrink.
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

      <div id="product-label-print-root" className="hidden" aria-hidden="true">
        {selectedItems.map((item) => (
          <div key={`print-${item.id}`} className="product-label-print-page">
            <ProductLabel item={item} size={size} qrDataUrl={qrByKey[item.id]} />
          </div>
        ))}
      </div>

      <div ref={captureRef} className="pointer-events-none fixed -left-[200vw] top-0 print:hidden" aria-hidden="true">
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
