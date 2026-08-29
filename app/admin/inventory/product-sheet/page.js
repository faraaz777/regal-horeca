'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { ArrowLeft, Printer, FileSpreadsheet, Search, X } from 'lucide-react';
import { adminFetch, adminJson, AdminFetchError } from '@/lib/client/adminFetch';
import { useDebounce } from '@/hooks/useDebounce';
import { showToast } from '@/lib/utils/toast';
import ProductStockSheetTable from '@/components/admin/inventory/ProductStockSheetTable';

const searchFetcher = (url) => adminJson(url);

export default function ProductStockSheetPage() {
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query.trim(), 250);
  const [selected, setSelected] = useState([]);
  const [showImages, setShowImages] = useState(true);
  const [sheet, setSheet] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);

  const searchUrl = `/api/admin/inventory/product-sheet/search?q=${encodeURIComponent(debounced)}`;
  const { data, isLoading: searching } = useSWR(searchUrl, searchFetcher, {
    revalidateOnFocus: false,
  });
  const results = data?.results || [];
  const selectedIds = useMemo(() => new Set(selected.map((p) => p._id)), [selected]);

  const toggleProduct = (product) => {
    setSheet(null);
    setSelected((prev) => {
      if (prev.some((p) => p._id === product._id)) {
        return prev.filter((p) => p._id !== product._id);
      }
      if (prev.length >= 20) {
        showToast.error('Select at most 20 products at a time.');
        return prev;
      }
      return [...prev, product];
    });
  };

  const generateSheet = async () => {
    if (!selected.length) {
      showToast.error('Select at least one product.');
      return;
    }
    setGenerating(true);
    try {
      const data = await adminJson('/api/admin/inventory/product-sheet', {
        method: 'POST',
        body: JSON.stringify({ productIds: selected.map((p) => p._id) }),
      });
      setSheet(data);
    } catch (error) {
      showToast.error(error instanceof AdminFetchError ? error.message : 'Could not build sheet');
    } finally {
      setGenerating(false);
    }
  };

  const downloadExcel = async () => {
    if (!selected.length) {
      showToast.error('Select at least one product.');
      return;
    }
    setExporting(true);
    try {
      const response = await adminFetch('/api/admin/inventory/product-sheet/export', {
        method: 'POST',
        body: JSON.stringify({ productIds: selected.map((p) => p._id) }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Export failed');
      }
      const payload = await response.blob();
      const url = URL.createObjectURL(payload);
      const a = document.createElement('a');
      a.href = url;
      a.download = `product-stock-sheet-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      showToast.error(error.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          body { background: white !important; }
        }
      `}</style>

      <div className="print:hidden">
        <Link
          href="/admin/inventory"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-2"
        >
          <ArrowLeft size={14} /> Inventory
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Product stock sheet</h1>
            <p className="text-sm text-gray-500 mt-1">
              Select product families. Each size and colour prints as its own row with total qty still in inventory.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadExcel}
              disabled={exporting || !selected.length}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
            >
              <FileSpreadsheet size={16} />
              {exporting ? 'Exporting…' : 'Excel'}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!sheet?.groups?.length}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-40"
            >
              <Printer size={16} />
              Print / Save PDF
            </button>
          </div>
        </div>
      </div>

      <div className="print:hidden grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <label className="block text-sm font-medium text-gray-700">Find a product</label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, brand, or SKU…"
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg"
            />
          </div>
          <p className="text-xs text-gray-500">
            Parents and standalones only. Choosing a parent includes every variant.
          </p>
          <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg">
            {searching && <p className="px-3 py-4 text-sm text-gray-500">Searching…</p>}
            {!searching && results.length === 0 && (
              <p className="px-3 py-4 text-sm text-gray-500">No matching products.</p>
            )}
            {results.map((product) => {
              const checked = selectedIds.has(product._id);
              return (
                <label
                  key={product._id}
                  className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleProduct(product)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  {product.heroImage ? (
                    <img src={product.heroImage} alt="" className="h-9 w-9 rounded object-cover bg-gray-100" />
                  ) : (
                    <span className="h-9 w-9 rounded bg-gray-100" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-gray-900 truncate">{product.title}</span>
                    <span className="block text-xs text-gray-500 truncate">
                      {product.brand || 'No brand'}
                      {product.sku ? ` · ${product.sku}` : ''}
                      {product.productType === 'parent' ? ' · family' : ''}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-800">Selected ({selected.length}/20)</p>
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelected([]);
                  setSheet(null);
                }}
                className="text-xs text-gray-500 hover:text-gray-800"
              >
                Clear
              </button>
            )}
          </div>
          {selected.length === 0 ? (
            <p className="text-sm text-gray-500">Tick products on the left.</p>
          ) : (
            <ul className="space-y-2 max-h-48 overflow-y-auto">
              {selected.map((product) => (
                <li
                  key={product._id}
                  className="flex items-start justify-between gap-2 text-sm border border-gray-100 rounded-lg px-2.5 py-2"
                >
                  <span className="min-w-0">
                    <span className="block font-medium text-gray-900 truncate">{product.title}</span>
                    <span className="block text-xs text-gray-500">{product.brand || 'No brand'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleProduct(product)}
                    className="text-gray-400 hover:text-gray-700"
                    aria-label={`Remove ${product.title}`}
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={showImages}
              onChange={(e) => setShowImages(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Show images
          </label>

          <button
            type="button"
            onClick={generateSheet}
            disabled={generating || !selected.length}
            className="w-full py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-40"
          >
            {generating ? 'Building…' : 'Generate sheet'}
          </button>
        </div>
      </div>

      {sheet?.groups?.length ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 print:border-0 print:rounded-none print:p-0">
          <div className="print:hidden mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
            <p>
              {sheet.totals.families} product{sheet.totals.families === 1 ? '' : 's'} ·{' '}
              {sheet.totals.variants} variants · {sheet.totals.qty.toLocaleString()} units in inventory
            </p>
            {sheet.generatedAt && (
              <p className="text-xs text-gray-400">
                Live as of {new Date(sheet.generatedAt).toLocaleString('en-IN')}
              </p>
            )}
          </div>
          <ProductStockSheetTable groups={sheet.groups} showImages={showImages} />
        </div>
      ) : null}
    </div>
  );
}
