'use client';

import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { showToast } from '@/lib/utils/toast';
import {
  ARTICLE_STATUS_LABELS,
  STOCK_STATUS_LABELS,
} from '@/lib/shared/maintainedArticle';
import { resolveBrandReportColumns } from '@/lib/shared/brandReportColumns';

const ROWS_PER_PAGE = 8;

function pdfCell(row, columnId) {
  switch (columnId) {
    case 'gstPercent':
    case 'maxDiscountPercent':
      return percent(row[columnId]);
    case 'mrp':
    case 'sellingPrice':
      return rupee(row[columnId]);
    case 'totalQuantity':
      return Number(row.totalQuantity || 0).toLocaleString('en-IN');
    case 'articleStatus':
      return ARTICLE_STATUS_LABELS[row.articleStatus] || '—';
    case 'stockStatus':
      return STOCK_STATUS_LABELS[row.stockStatus] || '—';
    default:
      return text(row[columnId]);
  }
}

/**
 * The PDF is a capture of this sheet, so the file matches the preview.
 * Eight rows keep the landscape page readable once it is scaled onto A4.
 */
function chunkRows(rows) {
  const pages = [];
  for (let index = 0; index < rows.length; index += ROWS_PER_PAGE) {
    pages.push(rows.slice(index, index + ROWS_PER_PAGE));
  }
  return pages;
}

function brandHeading(rows, brandName) {
  const chosen = String(brandName || '').trim();
  if (chosen) return chosen.toUpperCase();
  const found = [...new Set(rows.map((row) => String(row.brand || '').trim()).filter(Boolean))];
  if (found.length === 1) return found[0].toUpperCase();
  return 'ALL BRANDS';
}

function rupee(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return '—';
  return `₹${amount.toLocaleString('en-IN')}`;
}

function percent(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return '—';
  const rounded = Math.round(amount * 100) / 100;
  return `${rounded}%`;
}

function text(value) {
  if (value === null || value === undefined || value === '') return '—';
  return value;
}

function liveDate(generatedAt) {
  const date = generatedAt ? new Date(generatedAt) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toLocaleDateString('en-GB');
  return date.toLocaleDateString('en-GB');
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function proxyImageUrl(url) {
  return `/api/admin/inventory/brand-report/image?url=${encodeURIComponent(url)}`;
}

/**
 * R2 photos are not CORS-enabled. Fetch through the same-origin proxy,
 * then swap each img to a data URL so html-to-image can embed them.
 */
async function inlineSheetImages(root, cache) {
  const images = [...root.querySelectorAll('img')];
  await Promise.all(images.map(async (img) => {
    const url = img.getAttribute('src') || '';
    if (!url || url.startsWith('data:')) return;
    if (!cache.has(url)) {
      try {
        const response = await fetch(proxyImageUrl(url), { credentials: 'include' });
        if (!response.ok) throw new Error('image');
        cache.set(url, await blobToDataUrl(await response.blob()));
      } catch {
        cache.set(url, '');
      }
    }
    const dataUrl = cache.get(url);
    if (dataUrl) {
      img.removeAttribute('crossorigin');
      img.src = dataUrl;
      await new Promise((resolve) => {
        if (img.complete) {
          resolve();
          return;
        }
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });
      return;
    }
    const spot = document.createElement('span');
    spot.style.cssText = 'display:inline-block;width:28px;height:28px;border-radius:9999px;background:#f3f4f6;';
    img.replaceWith(spot);
  }));
}

async function captureSheet(node, cache, pixelRatio) {
  const { toPng } = await import('html-to-image');
  const clone = node.cloneNode(true);
  clone.style.position = 'fixed';
  clone.style.left = '0';
  clone.style.top = '0';
  clone.style.zIndex = '-1';
  clone.style.width = `${node.offsetWidth}px`;
  document.body.appendChild(clone);
  try {
    await inlineSheetImages(clone, cache);
    return await toPng(clone, {
      pixelRatio,
      backgroundColor: '#ffffff',
      cacheBust: false,
      width: clone.offsetWidth,
      height: clone.scrollHeight,
    });
  } finally {
    clone.remove();
  }
}

export default function BrandReportPdfPreview({ rows, generatedAt, brandName, selectionLabel, columns, onClose }) {
  const sheetRefs = useRef([]);
  const [exporting, setExporting] = useState('');
  const [mountedPages, setMountedPages] = useState(1);
  const pages = chunkRows(rows);
  const heading = brandHeading(rows, brandName);
  const stamp = liveDate(generatedAt);
  const activeColumns = resolveBrandReportColumns(columns);
  const pagesReady = mountedPages >= pages.length;

  useEffect(() => {
    if (mountedPages >= pages.length) return undefined;
    const frame = requestAnimationFrame(() => {
      setMountedPages((count) => Math.min(pages.length, count + 3));
    });
    return () => cancelAnimationFrame(frame);
  }, [mountedPages, pages.length]);

  const exportPdf = async () => {
    const nodes = sheetRefs.current.slice(0, pages.length).filter(Boolean);
    if (!pagesReady || nodes.length !== pages.length) {
      showToast.error('The preview is still preparing.');
      return;
    }
    setExporting(`Page 1 of ${nodes.length}`);
    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const cache = new Map();
      const pixelRatio = nodes.length > 8 ? 1 : 2;
      for (let index = 0; index < nodes.length; index += 1) {
        setExporting(`Page ${index + 1} of ${nodes.length}`);
        const dataUrl = await captureSheet(nodes[index], cache, pixelRatio);
        const ratio = (nodes[index].offsetWidth || 1) / Math.max(nodes[index].offsetHeight || 1, 1);
        let drawW = pageW;
        let drawH = pageW / ratio;
        if (drawH > pageH) {
          drawH = pageH;
          drawW = pageH * ratio;
        }
        if (index > 0) pdf.addPage();
        pdf.addImage(dataUrl, 'PNG', (pageW - drawW) / 2, 0, drawW, drawH);
      }
      pdf.save(`complete-brand-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      showToast.error(error.message || 'Could not create the PDF.');
    } finally {
      setExporting('');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="brand-report-pdf-title"
      onClick={onClose}
    >
      <div
        className="bg-[#f4f5f7] rounded-2xl shadow-2xl w-full max-w-[1180px] max-h-[92vh] flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-red-600">Export preview</p>
            <h2 id="brand-report-pdf-title" className="text-lg font-bold text-gray-900">Complete brand report PDF</h2>
            <p className="text-sm text-gray-500">This is how the landscape report will be arranged.</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg"
            >
              Close
            </button>
            <button
              type="button"
              disabled={!!exporting || !pagesReady}
              onClick={exportPdf}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg disabled:opacity-60"
            >
              <Download size={15} /> {exporting || (pagesReady ? 'Export PDF' : 'Preparing preview…')}
            </button>
          </div>
        </div>

        <div className="overflow-auto px-4 pb-5 md:px-6 space-y-5">
          {pages.slice(0, mountedPages).map((pageRows, pageIndex) => (
            <div key={pageRows[0]?.id || pageIndex} className="overflow-x-auto">
              <article
                ref={(node) => {
                  sheetRefs.current[pageIndex] = node;
                }}
                className="bg-white border border-gray-200 rounded-xl px-5 py-4 min-w-[1080px]"
              >
                <header className="flex items-start justify-between gap-6">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">Inventory report</p>
                    <h3 className="mt-1 text-2xl font-bold uppercase tracking-tight text-red-600">Brand {heading}</h3>
                    <p className="text-sm font-semibold text-gray-900">Complete brand report</p>
                  </div>
                  <div className="text-right text-xs text-gray-500 leading-5">
                    <p>Live as of {stamp}</p>
                    <p>{selectionLabel}</p>
                  </div>
                </header>
                <table className="mt-4 w-full border-collapse text-[11px] text-gray-900">
                  <thead>
                    <tr className="bg-gray-50 text-left text-[9px] font-semibold uppercase tracking-wide text-gray-500">
                      {['S.No', 'Image', 'Name', ...activeColumns.map((column) => column.excelHeader)].map((label) => (
                        <th key={label} className="border border-gray-200 px-1.5 py-2 align-bottom whitespace-normal leading-tight">{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row, index) => (
                      <tr key={row.id}>
                        <td className="border border-gray-200 px-1.5 py-1.5 text-gray-500">{pageIndex * ROWS_PER_PAGE + index + 1}</td>
                        <td className="border border-gray-200 px-1.5 py-1.5">
                          {row.imageUrl ? (
                            <img src={row.imageUrl} alt="" className="h-7 w-7 rounded-full object-cover bg-gray-100" />
                          ) : (
                            <span className="inline-block h-7 w-7 rounded-full bg-gray-100" />
                          )}
                        </td>
                        <td className="border border-gray-200 px-1.5 py-1.5 font-medium">{text(row.name)}</td>
                        {activeColumns.map((column) => (
                          <td
                            key={column.id}
                            className={`border border-gray-200 px-1.5 py-1.5 ${column.id === 'totalQuantity' ? 'font-semibold' : ''} ${column.id === 'sku' || column.id === 'barcode' ? 'font-mono break-all' : ''} ${column.id === 'location' ? 'max-w-[140px] break-words' : ''} ${column.id === 'size' || column.id === 'mrp' || column.id === 'sellingPrice' ? 'whitespace-nowrap' : ''}`}
                          >
                            {pdfCell(row, column.id)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {pages.length > 1 ? (
                  <p className="mt-2 text-right text-[10px] text-gray-400">Page {pageIndex + 1} of {pages.length}</p>
                ) : null}
              </article>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
