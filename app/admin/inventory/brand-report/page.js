'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { ArrowLeft, ChevronDown, FileSpreadsheet, FileText } from 'lucide-react';
import { adminFetch, adminJson } from '@/lib/client/adminFetch';
import { showToast } from '@/lib/utils/toast';
import BrandReportPdfPreview from '@/components/admin/inventory/BrandReportPdfPreview';
import BrandReportFilterBar from '@/components/admin/inventory/BrandReportFilterBar';
import {
  ARTICLE_MAINTAINED,
  ARTICLE_NON_MAINTAINED,
  ARTICLE_STATUS_LABELS,
  STOCK_DEAD,
  STOCK_LOW,
  STOCK_OK,
  STOCK_OVER,
  STOCK_STATUS_LABELS,
} from '@/lib/shared/maintainedArticle';

const fetcher = (url) => adminJson(url);

const EMPTY_FILTERS = {
  brand: '',
  categoryId: '',
  subCategoryId: '',
  articleStatus: '',
  stockStatus: '',
  color: '',
};

function hasReportScope(filters, query) {
  return Boolean(
    filters.brand
    || filters.categoryId
    || filters.subCategoryId
    || filters.articleStatus
    || filters.stockStatus
    || filters.color
    || query.trim().length >= 2
  );
}

function dash(value) {
  if (value === null || value === undefined || value === '') return '—';
  return value;
}

function money(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return '—';
  return `₹${amount.toLocaleString('en-IN')}`;
}

function percent(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return '—';
  return `${amount}%`;
}

const HEAD = 'sticky top-0 z-10 bg-[#f7f7f8] px-2.5 h-9 text-left text-[11px] font-medium text-gray-500 border-b border-gray-200 whitespace-nowrap';
const CELL = 'px-2.5 h-10 border-b border-gray-100 whitespace-nowrap align-middle';
const NUM = `${CELL} text-right tabular-nums text-gray-800`;

function ArticleBadge({ status }) {
  const maintained = status === ARTICLE_MAINTAINED;
  return (
    <span
      className={`inline-flex px-1.5 py-px rounded text-[10px] font-semibold ${
        maintained ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
      }`}
    >
      {ARTICLE_STATUS_LABELS[status] || 'Non-maintained'}
    </span>
  );
}

function StockBadge({ status }) {
  if (!status) return <span className="text-gray-400">—</span>;
  const tone = {
    [STOCK_LOW]: 'bg-rose-50 text-rose-800',
    [STOCK_OK]: 'bg-sky-50 text-sky-800',
    [STOCK_OVER]: 'bg-violet-50 text-violet-800',
    [STOCK_DEAD]: 'bg-gray-100 text-gray-600',
  }[status];
  return (
    <span className={`inline-flex px-1.5 py-px rounded text-[10px] font-semibold ${tone}`}>
      {STOCK_STATUS_LABELS[status]}
    </span>
  );
}

const REPORT_VIEWS = [
  ['parent_child', 'Grouped'],
  ['children_only', 'Flat'],
  ['selected', 'Ticked'],
];

export default function BrandReportPage() {
  const [draft, setDraft] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [search, setSearch] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [hierarchy, setHierarchy] = useState('parent_child');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(() => new Set());
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState('');

  const { data: facets } = useSWR('/api/admin/inventory/brand-report?facets=1', fetcher, {
    revalidateOnFocus: false,
  });

  const canQuery = submitted && hasReportScope(appliedFilters, appliedQuery);
  const reportUrl = useMemo(() => {
    if (!canQuery) return null;
    const params = new URLSearchParams({ page: String(page) });
    if (appliedFilters.brand) params.set('brand', appliedFilters.brand);
    if (appliedFilters.categoryId) params.set('categoryId', appliedFilters.categoryId);
    if (appliedFilters.subCategoryId) params.set('subCategoryId', appliedFilters.subCategoryId);
    if (appliedFilters.articleStatus) params.set('articleStatus', appliedFilters.articleStatus);
    if (appliedFilters.stockStatus) params.set('stockStatus', appliedFilters.stockStatus);
    if (appliedFilters.color) params.set('color', appliedFilters.color);
    if (appliedQuery) params.set('q', appliedQuery);
    return `/api/admin/inventory/brand-report?${params}`;
  }, [canQuery, page, appliedFilters, appliedQuery]);

  const { data, error, isLoading } = useSWR(reportUrl, fetcher, { revalidateOnFocus: false, keepPreviousData: true });

  useEffect(() => {
    setSelected(new Set());
    setPreview(null);
  }, [appliedFilters, appliedQuery]);

  const patchDraft = (patch) => setDraft((prev) => ({ ...prev, ...patch }));

  const applyFilters = () => {
    if (!hasReportScope(draft, appliedQuery)) {
      showToast.error('Choose a filter, or search with at least two characters.');
      return;
    }
    setAppliedFilters({ ...draft });
    setSubmitted(true);
    setPage(1);
  };

  const runSearch = () => {
    const query = search.trim();
    if (!hasReportScope(appliedFilters, query)) {
      showToast.error(
        query.length === 1
          ? 'Type at least two characters, or apply a filter first.'
          : 'Type at least two characters, or apply a filter.'
      );
      return;
    }
    setSearch(query);
    setAppliedQuery(query);
    setSubmitted(true);
    setPage(1);
  };

  const groups = data?.groups || [];
  const visibleRows = groups.flatMap((group) => group.rows);
  const visibleIds = visibleRows.map((row) => row.id);
  const allVisibleTicked = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  const toggleRow = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroup = (rows) => {
    const ids = rows.map((row) => row.id);
    const allOn = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (allOn ? next.delete(id) : next.add(id)));
      return next;
    });
  };

  const payload = () => ({
    ...appliedFilters,
    q: appliedQuery,
    rowIds: [...selected],
  });

  const exportRows = async (format) => {
    if (!canQuery) {
      showToast.error('Apply a filter or search before exporting.');
      return null;
    }
    setBusy(format);
    try {
      const response = await adminFetch('/api/admin/inventory/brand-report/export', {
        method: 'POST',
        body: JSON.stringify({ ...payload(), format }),
      });
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok) {
        const body = contentType.includes('json') ? await response.json() : null;
        throw new Error(body?.error || 'Export failed');
      }
      if (format === 'json') {
        const body = await response.json();
        if (body.needsFilter) {
          showToast.error('Choose a filter, or search with at least two characters.');
          return null;
        }
        if (!body.rows?.length) {
          showToast.error('No articles match these filters.');
          return null;
        }
        if (body.exportCapped || body.scanCapped) {
          showToast.error(`Export is limited to ${body.exportCap} articles. Narrow the filters for the rest.`);
        }
        return body;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `brand-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      if (response.headers.get('x-export-capped') === '1') {
        showToast.error('Excel includes the first 500 matching articles.');
      }
      return null;
    } catch (err) {
      showToast.error(err.message || 'Export failed');
      return null;
    } finally {
      setBusy('');
    }
  };

  const openPreview = async () => {
    const picked = selected.size > 0;
    const body = await exportRows('json');
    if (!body?.rows?.length) return;
    setPreview({
      rows: body.rows,
      generatedAt: body.generatedAt,
      brandName: appliedFilters.brand,
      selectionLabel: picked ? `${body.rows.length} selected` : `${body.rows.length} articles`,
    });
  };

  const showGroups = hierarchy === 'parent_child';
  let serial = 0;
  const rowsForTable = hierarchy === 'selected'
    ? visibleRows.filter((row) => selected.has(row.id))
    : visibleRows;

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <Link href="/admin/inventory" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
            <ArrowLeft size={14} /> Inventory
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Brand report</h1>
          <p className="text-sm text-gray-500">Maintained means minimum and maximum are both above 0.</p>
        </div>
        {data?.generatedAt ? (
          <p className="text-xs text-gray-400">Generated {new Date(data.generatedAt).toLocaleString('en-IN')}</p>
        ) : null}
      </div>

      <BrandReportFilterBar
        search={search}
        onSearchChange={setSearch}
        onSearch={runSearch}
        draft={draft}
        appliedFilters={appliedFilters}
        onChange={patchDraft}
        onApply={applyFilters}
        brands={facets?.brands || []}
        categories={facets?.categories || []}
      />

      <div className="mt-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
          <div className="inline-flex h-8 rounded-full bg-gray-100 p-0.5" role="group" aria-label="Display">
            {REPORT_VIEWS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setHierarchy(value)}
                className={`rounded-full px-2.5 text-xs font-medium ${
                  hierarchy === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={allVisibleTicked}
              onChange={() => {
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (allVisibleTicked) visibleIds.forEach((id) => next.delete(id));
                  else visibleIds.forEach((id) => next.add(id));
                  return next;
                });
              }}
            />
            Tick all visible
          </label>
          <span>{selected.size ? `${selected.size} ticked` : 'Nothing selected = filtered rows, up to 500'}</span>
          <span className="text-gray-400">
            {data?.totals ? `${data.totals.variants} articles in ${data.totals.families} groups` : ''}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!!busy}
            onClick={openPreview}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold border border-gray-200 rounded-lg bg-white"
          >
            <FileText size={14} /> {busy === 'json' ? 'Preparing…' : 'PDF preview'}
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => exportRows('xlsx')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-lg"
          >
            <FileSpreadsheet size={14} /> {busy === 'xlsx' ? 'Exporting…' : 'Excel'}
          </button>
        </div>
      </div>

      {data?.scanCapped ? (
        <p className="mt-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          This filter matches more than 2,500 articles. The table and export use the first matches. Narrow the brand or category for the rest.
        </p>
      ) : null}

      <div className="mt-3 max-h-[calc(100vh-15rem)] overflow-auto bg-white border border-gray-200 rounded-xl">
        {!canQuery ? (
          <p className="p-8 text-sm text-gray-500">Choose a filter and press Apply, or search for a product.</p>
        ) : isLoading && !data ? (
          <p className="p-8 text-sm text-gray-500">Loading report…</p>
        ) : error ? (
          <p className="p-8 text-sm text-red-700">The report could not be loaded. Try the filters again.</p>
        ) : rowsForTable.length === 0 ? (
          <p className="p-8 text-sm text-gray-500">
            {hierarchy === 'selected' ? 'Tick rows to use Selected only.' : 'No articles match these filters.'}
          </p>
        ) : (
          <table className="w-max min-w-full border-separate border-spacing-0 text-[12.5px]">
            <thead>
              <tr>
                <th className={`${HEAD} w-10`} />
                <th className={`${HEAD} w-10`}>#</th>
                <th className={`${HEAD} min-w-[240px]`}>Product</th>
                {['Size', 'Unit', 'Color', 'SKU', 'Barcode', 'HSN'].map((label) => (
                  <th key={label} className={HEAD}>{label}</th>
                ))}
                {['GST', 'MRP', 'SP', 'Disc', 'Qty', 'Min', 'Max', 'Reorder'].map((label) => (
                  <th key={label} className={`${HEAD} text-right`}>{label}</th>
                ))}
                <th className={HEAD}>Location</th>
                <th className={HEAD}>Article</th>
                <th className={HEAD}>Stock</th>
              </tr>
            </thead>
            <tbody>
              {showGroups
                ? groups.map((group) => {
                    const start = serial;
                    serial += group.rows.length;
                    return (
                      <GroupBlock
                        key={group.familyId}
                        group={group}
                        startIndex={start}
                        selected={selected}
                        onToggleGroup={() => toggleGroup(group.rows)}
                        onToggleRow={toggleRow}
                      />
                    );
                  })
                : rowsForTable.map((row, index) => (
                    <ArticleRow
                      key={row.id}
                      row={row}
                      index={index + 1}
                      checked={selected.has(row.id)}
                      onToggle={() => toggleRow(row.id)}
                    />
                  ))}
            </tbody>
          </table>
        )}
      </div>

      {data?.pagination?.pages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage((n) => Math.max(1, n - 1))} className="px-3 py-1.5 border rounded-lg disabled:opacity-40">Previous</button>
          <span>Page {data.pagination.page} of {data.pagination.pages}</span>
          <button type="button" disabled={page >= data.pagination.pages} onClick={() => setPage((n) => n + 1)} className="px-3 py-1.5 border rounded-lg disabled:opacity-40">Next</button>
        </div>
      )}

      {preview ? (
        <BrandReportPdfPreview
          rows={preview.rows}
          generatedAt={preview.generatedAt}
          brandName={preview.brandName}
          selectionLabel={preview.selectionLabel}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </div>
  );
}

function GroupBlock({ group, startIndex, selected, onToggleGroup, onToggleRow }) {
  const ids = group.rows.map((row) => row.id);
  const allOn = ids.every((id) => selected.has(id));
  return (
    <>
      <tr className="bg-[#f7f7f8]">
        <td className={`${CELL} bg-[#f7f7f8]`}>
          <input type="checkbox" checked={allOn} onChange={onToggleGroup} aria-label={`Select ${group.familyTitle}`} className="h-3.5 w-3.5 accent-gray-900" />
        </td>
        <td className={`${CELL} bg-[#f7f7f8]`} />
        <td colSpan={18} className={`${CELL} bg-[#f7f7f8]`}>
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-gray-900">
            <ChevronDown size={14} className="text-gray-400" />
            <span className="truncate max-w-[420px]" title={group.familyTitle}>{group.familyTitle}</span>
            <span className="font-normal text-gray-400">{group.variantCount} {group.variantCount === 1 ? 'variant' : 'variants'}</span>
          </span>
        </td>
      </tr>
      {group.rows.map((row, index) => (
        <ArticleRow key={row.id} row={row} index={startIndex + index + 1} checked={selected.has(row.id)} onToggle={() => onToggleRow(row.id)} />
      ))}
    </>
  );
}

function ArticleRow({ row, index, checked, onToggle }) {
  return (
    <tr className="hover:bg-gray-50/80">
      <td className={CELL}>
        <input type="checkbox" checked={checked} onChange={onToggle} aria-label={`Select ${row.name}`} className="h-3.5 w-3.5 accent-gray-900" />
      </td>
      <td className={`${CELL} text-gray-400 tabular-nums`}>{index}</td>
      <td className={CELL}>
        <span className="flex items-center gap-2 min-w-[220px] max-w-[280px]">
          {row.imageUrl ? (
            <img src={row.imageUrl} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover bg-gray-100" />
          ) : (
            <span className="inline-block h-7 w-7 shrink-0 rounded-full bg-gray-100" />
          )}
          <span className="truncate font-medium text-gray-900" title={row.name}>{row.name}</span>
        </span>
      </td>
      <td className={`${CELL} text-gray-600`}>{dash(row.size)}</td>
      <td className={`${CELL} text-gray-600`}>{dash(row.unit)}</td>
      <td className={`${CELL} text-gray-600`}>{dash(row.color)}</td>
      <td className={`${CELL} font-mono text-[11px] text-gray-600`}>{dash(row.sku)}</td>
      <td className={`${CELL} font-mono text-[11px] text-gray-500`}>{dash(row.barcode)}</td>
      <td className={`${CELL} text-gray-600`}>{dash(row.hsnCode)}</td>
      <td className={NUM}>{percent(row.gstPercent)}</td>
      <td className={NUM}>{money(row.mrp)}</td>
      <td className={NUM}>{money(row.sellingPrice)}</td>
      <td className={NUM}>{percent(row.maxDiscountPercent)}</td>
      <td className={`${NUM} font-semibold text-gray-900`}>{Number(row.totalQuantity || 0).toLocaleString('en-IN')}</td>
      <td className={NUM}>{dash(row.minQuantity)}</td>
      <td className={NUM}>{dash(row.maxQuantity)}</td>
      <td className={NUM}>{dash(row.reorderQty)}</td>
      <td className={`${CELL} max-w-[160px] truncate text-gray-500`} title={row.location}>{dash(row.location)}</td>
      <td className={CELL}><ArticleBadge status={row.articleStatus} /></td>
      <td className={CELL}><StockBadge status={row.stockStatus} /></td>
    </tr>
  );
}
