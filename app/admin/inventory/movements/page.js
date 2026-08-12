'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import {
  Download,
  Loader2,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Users,
  MapPinned,
  ScrollText,
} from 'lucide-react';
import { adminFetch, adminJson } from '@/lib/client/adminFetch';
import { canReadStockLedger } from '@/lib/shared/permissions';
import { LEDGER_FILTER_TYPES, LEDGER_FILTER_TYPE_LABELS } from '@/lib/shared/inventoryConstants';
import LocationSelector from '@/components/admin/inventory/LocationSelector';
import ProductImageThumb from '@/components/admin/inventory/ProductImageThumb';
import { resolveCascadeLocation } from '@/lib/client/locationCascadeApi';

const fetcher = (url) => adminJson(url);

const TABS = [
  { id: 'movements', label: 'Movements', icon: ScrollText },
  { id: 'position', label: 'Stock Position', icon: MapPinned },
  { id: 'operators', label: 'Operators', icon: Users },
  { id: 'insights', label: 'Insights', icon: BarChart3 },
];

const TYPE_BADGE_STYLES = {
  opening: 'bg-blue-100 text-blue-800',
  adjustment_add: 'bg-emerald-100 text-emerald-800',
  adjustment_minus: 'bg-red-100 text-red-800',
  transfer_out: 'bg-violet-100 text-violet-800',
  transfer_in: 'bg-violet-100 text-violet-800',
  sale_fulfill: 'bg-sky-100 text-sky-800',
  sold: 'bg-sky-100 text-sky-800',
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
  const initialLocationId = searchParams.get('locationId') || '';

  const { data: meData } = useSWR('/api/auth/me', fetcher, { revalidateOnFocus: false });
  const role = meData?.user?.role;
  const canView = canReadStockLedger(role);

  const [activeTab, setActiveTab] = useState('movements');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [referenceFilter, setReferenceFilter] = useState('');
  const [productFilterId, setProductFilterId] = useState(initialProductId);
  const [operatorFilterId, setOperatorFilterId] = useState('');
  const [exporting, setExporting] = useState(false);
  const [pages, setPages] = useState({
    movements: 1,
    position: 1,
    operators: 1,
    insights: 1,
    references: 1,
  });
  const [locationFilter, setLocationFilter] = useState({
    branchId: null,
    floorId: null,
    rackId: null,
    locationId: initialLocationId || null,
  });

  useEffect(() => {
    if (!initialLocationId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await resolveCascadeLocation(initialLocationId);
        const selection = data.selection || data;
        if (cancelled) return;
        setLocationFilter({
          branchId: selection.branchId,
          floorId: selection.floorId,
          rackId: selection.rackId,
          locationId: selection.locationId,
        });
      } catch {
        /* ignore invalid deep link */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialLocationId]);

  const setTabPage = (tabId, value) => {
    setPages((prev) => ({ ...prev, [tabId]: value }));
  };

  const resetAllPages = () => {
    setPages({
      movements: 1,
      position: 1,
      operators: 1,
      insights: 1,
      references: 1,
    });
  };

  const sharedParams = useMemo(() => {
    const params = new URLSearchParams();
    if (typeFilter) params.set('type', typeFilter);
    if (search.trim()) params.set('search', search.trim());
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (productFilterId) params.set('productId', productFilterId);
    if (locationFilter.locationId) params.set('locationId', locationFilter.locationId);
    if (operatorFilterId) params.set('userId', operatorFilterId);
    if (referenceFilter.trim()) params.set('refExact', referenceFilter.trim());
    return params;
  }, [
    typeFilter,
    search,
    dateFrom,
    dateTo,
    productFilterId,
    locationFilter.locationId,
    operatorFilterId,
    referenceFilter,
  ]);

  const movementUrl = useMemo(() => {
    if (!canView || activeTab !== 'movements') return null;
    const params = new URLSearchParams(sharedParams);
    params.set('page', String(pages.movements));
    params.set('limit', '50');
    return `/api/admin/inventory/ledger?${params}`;
  }, [canView, activeTab, sharedParams, pages.movements]);

  const positionUrl = useMemo(() => {
    if (!canView || activeTab !== 'position') return null;
    const params = new URLSearchParams();
    params.set('page', String(pages.position));
    params.set('limit', '20');
    if (locationFilter.locationId) params.set('locationId', locationFilter.locationId);
    if (productFilterId) params.set('productId', productFilterId);
    if (search.trim()) params.set('search', search.trim());
    return `/api/admin/inventory/activity/position?${params}`;
  }, [canView, activeTab, pages.position, locationFilter.locationId, productFilterId, search]);

  const operatorsUrl = useMemo(() => {
    if (!canView || activeTab !== 'operators') return null;
    const params = new URLSearchParams(sharedParams);
    params.set('page', String(pages.operators));
    params.set('limit', '20');
    return `/api/admin/inventory/activity/operators?${params}`;
  }, [canView, activeTab, sharedParams, pages.operators]);

  const insightsUrl = useMemo(() => {
    if (!canView || activeTab !== 'insights') return null;
    const params = new URLSearchParams(sharedParams);
    return `/api/admin/inventory/activity/insights?${params}`;
  }, [canView, activeTab, sharedParams]);

  const referencesUrl = useMemo(() => {
    if (!canView || activeTab !== 'references') return null;
    const params = new URLSearchParams();
    params.set('page', String(pages.references));
    params.set('limit', '20');
    if (typeFilter) params.set('type', typeFilter);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (productFilterId) params.set('productId', productFilterId);
    if (locationFilter.locationId) params.set('locationId', locationFilter.locationId);
    if (search.trim()) params.set('refSearch', search.trim());
    return `/api/admin/inventory/activity/references?${params}`;
  }, [
    canView,
    activeTab,
    pages.references,
    typeFilter,
    dateFrom,
    dateTo,
    productFilterId,
    locationFilter.locationId,
    search,
  ]);

  const movementRes = useSWR(movementUrl, fetcher, { revalidateOnFocus: false, keepPreviousData: true });
  const positionRes = useSWR(positionUrl, fetcher, { revalidateOnFocus: false, keepPreviousData: true });
  const operatorsRes = useSWR(operatorsUrl, fetcher, { revalidateOnFocus: false, keepPreviousData: true });
  const insightsRes = useSWR(insightsUrl, fetcher, { revalidateOnFocus: false });
  const referencesRes = useSWR(referencesUrl, fetcher, { revalidateOnFocus: false, keepPreviousData: true });

  const movementItems = movementRes.data?.items || [];
  const movementPagination = movementRes.data?.pagination || { page: 1, pages: 1, total: 0 };
  const positionItems = positionRes.data?.items || [];
  const positionPagination = positionRes.data?.pagination || { page: 1, pages: 1, total: 0 };
  const operatorsItems = operatorsRes.data?.items || [];
  const operatorsPagination = operatorsRes.data?.pagination || { page: 1, pages: 1, total: 0 };
  const referenceItems = referencesRes.data?.items || [];
  const referencePagination = referencesRes.data?.pagination || { page: 1, pages: 1, total: 0 };
  const insights = insightsRes.data;

  const buildExportUrl = useCallback(
    (format) => {
      const params = new URLSearchParams(sharedParams);
      params.set('format', format);
      return `/api/admin/inventory/ledger/export?${params}`;
    },
    [sharedParams]
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
    return <div className="p-8 text-center text-gray-500">You do not have permission to view stock activity.</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Stock Activity</h1>
          <p className="text-sm text-gray-500 mt-1">
            Ledger = what happened · Stock = what exists · Operators = who moved it
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
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full border ${
                  activeTab === tab.id
                    ? 'border-emerald-600 text-emerald-700 bg-emerald-50'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setActiveTab('references')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full border ${
              activeTab === 'references'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Ref View
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setTypeFilter('');
              resetAllPages();
            }}
            className={`px-3 py-1.5 text-sm font-medium rounded-full border ${
              !typeFilter ? 'border-emerald-600 text-emerald-700 bg-emerald-50' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            All types
          </button>
          {LEDGER_FILTER_TYPES.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setTypeFilter(key);
                resetAllPages();
              }}
              className={`px-3 py-1.5 text-sm font-medium rounded-full border ${
                typeFilter === key
                  ? 'border-emerald-600 text-emerald-700 bg-emerald-50'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {LEDGER_FILTER_TYPE_LABELS[key]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder={activeTab === 'references' ? 'Search reference…' : 'Search remark or ref…'}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                resetAllPages();
              }}
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              resetAllPages();
            }}
            className="px-3 py-2.5 text-sm border border-gray-200 rounded-lg"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              resetAllPages();
            }}
            className="px-3 py-2.5 text-sm border border-gray-200 rounded-lg"
          />
        </div>

        <div className="border-t border-gray-100 pt-4">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Filter by location</p>
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
              resetAllPages();
            }}
          />
        </div>

        {(productFilterId || operatorFilterId || referenceFilter) && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
            {productFilterId && <span>Product filter active</span>}
            {operatorFilterId && <span>Operator filter active</span>}
            {referenceFilter && <span>Ref: {referenceFilter}</span>}
            <button
              type="button"
              onClick={() => {
                setProductFilterId('');
                setOperatorFilterId('');
                setReferenceFilter('');
                resetAllPages();
              }}
              className="ml-auto inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900"
            >
              <X size={14} />
              Clear tagged filters
            </button>
          </div>
        )}
      </div>

      {activeTab === 'movements' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {movementRes.error && (
            <div className="p-4 text-sm text-red-600 bg-red-50 border-b border-red-100">
              {movementRes.error.message || 'Failed to load movements'}
            </div>
          )}
          <div className="p-4 border-b border-gray-100">
            <p className="text-sm text-gray-600">Append-only ledger · {movementPagination.total || 0} entries</p>
          </div>
          <div className="divide-y divide-gray-100">
            {(movementRes.isLoading || movementRes.isValidating) && movementItems.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Loader2 className="inline animate-spin text-emerald-600" size={24} />
                <p className="mt-2">Loading movements…</p>
              </div>
            ) : movementItems.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No movements found</div>
            ) : (
              movementItems.map((row) => (
                <div key={row.pairId || row._id} className="px-4 py-3">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <ProductImageThumb
                        src={row.productHeroImage}
                        alt={row.productTitle || 'Product'}
                        size={56}
                      />
                      <div className="space-y-1 min-w-0">
                      <p className="text-xs text-gray-500">{formatTs(row.createdAt)}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                            TYPE_BADGE_STYLES[row.displayType] ||
                            TYPE_BADGE_STYLES[row.type] ||
                            'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {row.typeLabel}
                        </span>
                        <span className="font-mono text-sm font-semibold text-gray-900">{row.changeDisplay}</span>
                        {row.ref ? (
                          <button
                            type="button"
                            onClick={() => {
                              setReferenceFilter(row.ref);
                              setActiveTab('references');
                              setTabPage('references', 1);
                            }}
                            className="text-xs font-mono text-emerald-700 hover:underline"
                          >
                            Ref: {row.ref}
                          </button>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const pid = String(row.productId?._id || row.productId);
                          setProductFilterId(pid);
                          setTabPage('movements', 1);
                        }}
                        className="text-left font-medium text-emerald-800 hover:underline"
                      >
                        {row.productTitle}
                      </button>
                      {row.productSku ? <p className="text-xs text-gray-500 font-mono">{row.productSku}</p> : null}
                      <p className="text-xs text-gray-600">{row.locationDisplayPath || '—'}</p>
                      <p className="text-xs text-gray-600">
                        {row.performedBy?.name || row.performedBy?.email || '—'}
                        {row.reasonLabel ? ` · ${row.reasonLabel}` : ''}
                      </p>
                      {row.remark ? <p className="text-xs text-gray-500">{row.remark}</p> : null}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50 text-sm">
            <span className="text-gray-500">
              Page {movementPagination.page} of {movementPagination.pages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={movementPagination.page <= 1}
                onClick={() => setTabPage('movements', Math.max(1, pages.movements - 1))}
                className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-white"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                disabled={movementPagination.page >= movementPagination.pages}
                onClick={() => setTabPage('movements', pages.movements + 1)}
                className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-white"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'position' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          {(positionRes.isLoading || positionRes.isValidating) && positionItems.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Loader2 className="inline animate-spin text-emerald-600" size={24} />
              <p className="mt-2">Loading stock position…</p>
            </div>
          ) : positionItems.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No stock position rows found</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {positionItems.map((row) => (
                <div key={row.productId} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <ProductImageThumb
                        src={row.heroImage}
                        alt={row.title || 'Product'}
                        size={56}
                      />
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => {
                            setProductFilterId(row.productId);
                            setActiveTab('movements');
                            setTabPage('movements', 1);
                          }}
                          className="font-semibold text-gray-900 hover:text-emerald-700 text-left"
                        >
                          {row.title}
                        </button>
                        {row.sku ? <p className="text-xs text-gray-500 font-mono">{row.sku}</p> : null}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-emerald-700">{Number(row.totalQty || 0).toLocaleString()} pcs</p>
                      <p className="text-[11px] text-gray-500">{formatTs(row.lastLedgerAt)}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {row.locations.map((loc) => (
                      <div key={`${row.productId}-${loc.locationId}`} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                        <p className="text-xs text-gray-700">{loc.locationDisplayPath}</p>
                        <p className="text-xs font-semibold text-gray-900 mt-0.5">{Number(loc.qty || 0).toLocaleString()} pcs</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50 text-sm">
            <span className="text-gray-500">
              Page {positionPagination.page} of {positionPagination.pages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={positionPagination.page <= 1}
                onClick={() => setTabPage('position', Math.max(1, pages.position - 1))}
                className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-white"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                disabled={positionPagination.page >= positionPagination.pages}
                onClick={() => setTabPage('position', pages.position + 1)}
                className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-white"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'references' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {(referencesRes.isLoading || referencesRes.isValidating) && referenceItems.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Loader2 className="inline animate-spin text-emerald-600" size={24} />
              <p className="mt-2">Loading references…</p>
            </div>
          ) : referenceItems.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No reference rollups found</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {referenceItems.map((row) => (
                <div key={row.ref} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        setReferenceFilter(row.ref);
                        setActiveTab('movements');
                        setTabPage('movements', 1);
                      }}
                      className="font-mono text-sm font-semibold text-emerald-800 hover:underline"
                    >
                      {row.ref}
                    </button>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {row.movementCount} movements · Last: {formatTs(row.lastAt)}
                    </p>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <span className="text-emerald-700 font-semibold">+{Number(row.addedQty || 0).toLocaleString()}</span>
                    <span className="text-rose-700 font-semibold">-{Number(row.removedQty || 0).toLocaleString()}</span>
                    <span className="text-gray-700 font-semibold">
                      Net {Number(row.netQty || 0) > 0 ? '+' : ''}
                      {Number(row.netQty || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50 text-sm">
            <span className="text-gray-500">
              Page {referencePagination.page} of {referencePagination.pages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={referencePagination.page <= 1}
                onClick={() => setTabPage('references', Math.max(1, pages.references - 1))}
                className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-white"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                disabled={referencePagination.page >= referencePagination.pages}
                onClick={() => setTabPage('references', pages.references + 1)}
                className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-white"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'operators' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {(operatorsRes.isLoading || operatorsRes.isValidating) && operatorsItems.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Loader2 className="inline animate-spin text-emerald-600" size={24} />
              <p className="mt-2">Loading operators…</p>
            </div>
          ) : operatorsItems.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No operators found</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {operatorsItems.map((row) => (
                <div key={row.userId || row.email} className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!row.userId) return;
                        setOperatorFilterId(row.userId);
                        setActiveTab('movements');
                        setTabPage('movements', 1);
                      }}
                      className="font-semibold text-gray-900 hover:text-emerald-700"
                    >
                      {row.name}
                    </button>
                    <p className="text-xs text-gray-500">{row.email || '—'}</p>
                    <p className="text-[11px] text-gray-500">Last movement: {formatTs(row.lastMovementAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{row.movementCount} movements</p>
                    <p className="text-xs text-emerald-700">+{Number(row.plusQty || 0).toLocaleString()} pcs</p>
                    <p className="text-xs text-rose-700">-{Number(row.minusQty || 0).toLocaleString()} pcs</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50 text-sm">
            <span className="text-gray-500">
              Page {operatorsPagination.page} of {operatorsPagination.pages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={operatorsPagination.page <= 1}
                onClick={() => setTabPage('operators', Math.max(1, pages.operators - 1))}
                className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-white"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                disabled={operatorsPagination.page >= operatorsPagination.pages}
                onClick={() => setTabPage('operators', pages.operators + 1)}
                className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-white"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'insights' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {!insights && insightsRes.isLoading ? (
            <div className="md:col-span-2 xl:col-span-4 p-8 bg-white border border-gray-200 rounded-xl text-center text-gray-500">
              <Loader2 className="inline animate-spin text-emerald-600" size={24} />
              <p className="mt-2">Loading insights…</p>
            </div>
          ) : (
            <>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-500">Stock added</p>
                <p className="text-2xl font-bold text-emerald-700 mt-1">+{Number(insights?.addedQty || 0).toLocaleString()}</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-500">Stock removed</p>
                <p className="text-2xl font-bold text-rose-700 mt-1">-{Number(insights?.removedQty || 0).toLocaleString()}</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-500">Transfers</p>
                <p className="text-2xl font-bold text-violet-700 mt-1">{Number(insights?.transferCount || 0).toLocaleString()}</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-500">Movements</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{Number(insights?.movementCount || 0).toLocaleString()}</p>
              </div>

              <div className="md:col-span-2 bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-500">Most moved item</p>
                {insights?.topItem ? (
                  <div className="mt-2">
                    <p className="font-semibold text-gray-900">{insights.topItem.title}</p>
                    <p className="text-xs text-gray-500 font-mono">{insights.topItem.sku || '—'}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {Number(insights.topItem.movedQtyAbs || 0).toLocaleString()} pcs · {insights.topItem.movementCount} movements
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 mt-2">No item data</p>
                )}
              </div>

              <div className="md:col-span-2 bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-500">Top active racks</p>
                <div className="mt-2 space-y-2">
                  {(insights?.topRacks || []).length === 0 ? (
                    <p className="text-sm text-gray-400">No rack activity</p>
                  ) : (
                    (insights?.topRacks || []).map((rack) => (
                      <div key={rack.locationId} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{rack.locationDisplayPath}</span>
                        <span className="font-semibold text-gray-900">{rack.movementCount}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
