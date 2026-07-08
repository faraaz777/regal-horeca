'use client';

import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { Download, Loader2, Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { adminFetch, adminJson } from '@/lib/client/adminFetch';
import { canReadStockLedger } from '@/lib/shared/permissions';
import { LEDGER_FILTER_TYPES, LEDGER_FILTER_TYPE_LABELS } from '@/lib/shared/inventoryConstants';
import LocationSelector from '@/components/admin/inventory/LocationSelector';

const fetcher = (url) => adminJson(url);

const TYPE_BADGE_STYLES = {
  opening: 'bg-blue-100 text-blue-800',
  adjustment_add: 'bg-emerald-100 text-emerald-800',
  adjustment_minus: 'bg-red-100 text-red-800',
  transfer_out: 'bg-violet-100 text-violet-800',
  transfer_in: 'bg-violet-100 text-violet-800',
  condition_change: 'bg-amber-100 text-amber-800',
  reservation_hold: 'bg-orange-100 text-orange-800',
  sale_fulfill: 'bg-sky-100 text-sky-800',
  status: 'bg-amber-100 text-amber-800',
};

function formatTs(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function downloadExport(url) {
  const res = await adminFetch(url);
  if (!res.ok) {
    const text = await res.text();
    let msg = 'Export failed';
    try {
      msg = JSON.parse(text).error || msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] || 'stock-movements.csv';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function StockMovementsPage() {
  const searchParams = useSearchParams();
  const initialProductId = searchParams.get('productId') || '';

  const { data: meData } = useSWR('/api/auth/me', fetcher, { revalidateOnFocus: false });
  const role = meData?.user?.role;
  const canView = canReadStockLedger(role);

  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [drawerProductId, setDrawerProductId] = useState(initialProductId);
  const [exporting, setExporting] = useState(false);
  const [locationFilter, setLocationFilter] = useState({
    branchId: null,
    floorId: null,
    rackId: null,
    locationId: null,
  });

  const ledgerUrl = useMemo(() => {
    if (!canView) return null;
    const params = new URLSearchParams({ page: String(page), limit: '50' });
    if (typeFilter) params.set('type', typeFilter);
    if (search.trim()) params.set('search', search.trim());
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (drawerProductId) params.set('productId', drawerProductId);
    if (locationFilter.locationId) params.set('locationId', locationFilter.locationId);
    return `/api/admin/inventory/ledger?${params}`;
  }, [canView, page, typeFilter, search, dateFrom, dateTo, drawerProductId, locationFilter.locationId]);

  const { data, error, isLoading, isValidating } = useSWR(ledgerUrl, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  const items = data?.items || [];
  const pagination = data?.pagination || { page: 1, pages: 1, total: 0 };

  const buildExportUrl = useCallback(
    (format) => {
      const params = new URLSearchParams({ format });
      if (typeFilter) params.set('type', typeFilter);
      if (search.trim()) params.set('search', search.trim());
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (drawerProductId) params.set('productId', drawerProductId);
      if (locationFilter.locationId) params.set('locationId', locationFilter.locationId);
      return `/api/admin/inventory/ledger/export?${params}`;
    },
    [typeFilter, search, dateFrom, dateTo, drawerProductId, locationFilter.locationId]
  );

  const handleExport = async (format) => {
    setExporting(true);
    try {
      await downloadExport(buildExportUrl(format));
      toast.success(`Exported ${format.toUpperCase()}`);
    } catch (err) {
      toast.error(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  if (meData && !canView) {
    return (
      <div className="p-8 text-center text-gray-500">
        You do not have permission to view the stock movement ledger.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Stock movements</h1>
          <p className="text-sm text-gray-500 mt-1">
            Append-only ledger — every physical stock change
            {pagination.total ? ` · ${pagination.total} entries` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={exporting}
            onClick={() => handleExport('csv')}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            CSV
          </button>
          <button
            type="button"
            disabled={exporting}
            onClick={() => handleExport('xlsx')}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Excel
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setTypeFilter('');
              setPage(1);
            }}
            className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${
              !typeFilter
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            All
          </button>
          {LEDGER_FILTER_TYPES.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setTypeFilter(key);
                setPage(1);
              }}
              className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${
                typeFilter === key
                  ? 'border-emerald-600 text-emerald-700 bg-emerald-50'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {LEDGER_FILTER_TYPE_LABELS[key]}
            </button>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search remark or ref…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2.5 text-sm border border-gray-200 rounded-lg"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2.5 text-sm border border-gray-200 rounded-lg"
          />
        </div>

        <div className="border-t border-gray-100 pt-4">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Filter by location
          </p>
          <LocationSelector
            mode="filter"
            selectedBranchId={locationFilter.branchId}
            selectedFloorId={locationFilter.floorId}
            selectedRackId={locationFilter.rackId}
            onChange={(selection) => {
              setLocationFilter({
                branchId: selection.branchId,
                floorId: selection.floorId,
                rackId: selection.rackId,
                locationId: selection.locationId,
              });
              setPage(1);
            }}
          />
        </div>

        {drawerProductId && (
          <div className="flex items-center gap-2 text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
            <span>Filtered to product ledger</span>
            <button
              type="button"
              onClick={() => {
                setDrawerProductId('');
                setPage(1);
              }}
              className="ml-auto inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900"
            >
              <X size={14} />
              Clear
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {error && (
          <div className="p-4 text-sm text-red-600 bg-red-50 border-b border-red-100">
            {error.message || 'Failed to load ledger'}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 min-w-[200px]">Item</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Change</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Remark / Ref</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(isLoading || isValidating) && items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    <Loader2 className="inline animate-spin text-emerald-600" size={24} />
                    <p className="mt-2">Loading movements…</p>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    No movements found
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.pairId || row._id} className="hover:bg-gray-50/80">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => {
                          const pid = String(row.productId?._id || row.productId);
                          setDrawerProductId(pid);
                          setPage(1);
                        }}
                        className="text-left font-medium text-emerald-800 hover:underline"
                      >
                        {row.productTitle}
                      </button>
                      {row.productSku && (
                        <div className="text-xs text-gray-500 font-mono mt-0.5">{row.productSku}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                          TYPE_BADGE_STYLES[row.displayType] ||
                          TYPE_BADGE_STYLES[row.type] ||
                          'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {row.typeLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-900">
                      {row.changeDisplay}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{row.reasonLabel}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[180px]">
                      <div className="truncate" title={row.remark}>
                        {row.remark || '—'}
                      </div>
                      {row.ref && (
                        <div className="text-xs text-gray-400 font-mono mt-0.5">{row.ref}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs max-w-[160px]">
                      <span className="truncate block" title={row.locationDisplayPath}>
                        {row.locationDisplayPath || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {row.performedBy?.name || row.performedBy?.email || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                      {formatTs(row.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50 text-sm">
          <span className="text-gray-500">
            Page {pagination.page} of {pagination.pages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-white"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              disabled={pagination.page >= pagination.pages}
              onClick={() => setPage((p) => p + 1)}
              className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-white"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {drawerProductId && items[0] && (
        <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md bg-white border-l border-gray-200 shadow-xl flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Product ledger</h2>
              <p className="text-xs text-gray-500 mt-0.5">{items[0]?.productTitle}</p>
            </div>
            <button
              type="button"
              onClick={() => setDrawerProductId('')}
              className="p-1 rounded-md text-gray-400 hover:bg-gray-100"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {items.map((row) => (
              <div key={row.pairId || row._id} className="px-5 py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      TYPE_BADGE_STYLES[row.displayType] || 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {row.typeLabel}
                  </span>
                  <span className="text-xs text-gray-400">{formatTs(row.createdAt)}</span>
                </div>
                <p className="font-mono text-xs font-semibold mt-1">{row.changeDisplay}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {row.reasonLabel}
                  {row.remark ? ` · ${row.remark}` : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
