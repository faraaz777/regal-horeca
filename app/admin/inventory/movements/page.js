'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import {
  Download,
  Loader2,
  Search,
  X,
  ChevronDown,
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
import { addIsoDays } from '@/lib/shared/ledgerCalendar';

const InsightsDashboard = dynamic(() => import('@/components/admin/inventory/insights/InsightsDashboard'), {
  ssr: false,
  loading: () => <div className="p-8 text-center text-sm text-[#64748B]">Loading insights…</div>,
});

const fetcher = (url) => adminJson(url);

const DATE_PRESETS = [
  { id: '1', label: 'Today', days: 1 },
  { id: '7', label: '7 days', days: 7 },
  { id: '30', label: '30 days', days: 30 },
  { id: '90', label: '90 days', days: 90 },
];

function kolkataToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function matchingDatePreset(dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return '';
  const end = kolkataToday();
  const match = DATE_PRESETS.find((preset) => {
    const start = preset.days <= 1 ? end : addIsoDays(end, -(preset.days - 1));
    return dateFrom === start && dateTo === end;
  });
  return match ? match.id : 'custom';
}

function FilterSelect({ label, value, onChange, children }) {
  return (
    <label className="relative block min-w-0">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <span className="relative block">
        <select
          aria-label={label}
          value={value}
          onChange={onChange}
          className="h-11 w-full appearance-none rounded-full border border-slate-200 bg-white pl-4 pr-9 text-sm text-slate-800 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
      </span>
    </label>
  );
}

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialProductId = searchParams.get('productId') || '';
  const initialLocationId = searchParams.get('locationId') || '';

  const { data: meData } = useSWR('/api/auth/me', fetcher, { revalidateOnFocus: false });
  const role = meData?.user?.role;
  const canView = canReadStockLedger(role);

  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'movements');
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || '');
  const [brandFilter, setBrandFilter] = useState(searchParams.get('brand') || '');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [appliedSearch, setAppliedSearch] = useState(searchParams.get('search') || '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') || '');
  const [referenceFilter, setReferenceFilter] = useState('');
  const [refsFilter, setRefsFilter] = useState(searchParams.get('refs') || '');
  const [insightUnit, setInsightUnit] = useState(searchParams.get('unit') || '');
  const [calendarMonth, setCalendarMonth] = useState(searchParams.get('calendarMonth') || '');
  const [agingFilter, setAgingFilter] = useState(searchParams.get('aging') || '');
  const [productFilterId, setProductFilterId] = useState(initialProductId);
  const [operatorFilterId, setOperatorFilterId] = useState('');
  /** Whose sale it was, as opposed to who keyed the movement in. */
  const [soldForFilterId, setSoldForFilterId] = useState('');
  const [exporting, setExporting] = useState(false);
  const [pages, setPages] = useState({
    movements: 1,
    position: 1,
    operators: 1,
    insights: 1,
    references: 1,
  });
  const [locationFilter, setLocationFilter] = useState({
    branchId: searchParams.get('branchId'),
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

  useEffect(() => {
    const handle = setTimeout(() => {
      setAppliedSearch(search.replace(/[\r\n]+/g, ' ').trim());
    }, 300);
    return () => clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (activeTab !== 'movements') params.set('tab', activeTab);
    if (appliedSearch) params.set('search', appliedSearch);
    if (typeFilter) params.set('type', typeFilter);
    if (brandFilter) params.set('brand', brandFilter);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (productFilterId) params.set('productId', productFilterId);
    if (locationFilter.branchId) params.set('branchId', locationFilter.branchId);
    if (locationFilter.locationId) params.set('locationId', locationFilter.locationId);
    if (refsFilter) params.set('refs', refsFilter);
    if (insightUnit) params.set('unit', insightUnit);
    if (calendarMonth) params.set('calendarMonth', calendarMonth);
    if (agingFilter) params.set('aging', agingFilter);
    const next = params.toString();
    if (next === searchParams.toString()) return;
    router.replace(next ? `/admin/inventory/movements?${next}` : '/admin/inventory/movements', { scroll: false });
  }, [
    activeTab,
    appliedSearch,
    typeFilter,
    brandFilter,
    dateFrom,
    dateTo,
    productFilterId,
    locationFilter.branchId,
    locationFilter.locationId,
    refsFilter,
    insightUnit,
    calendarMonth,
    agingFilter,
    router,
    searchParams,
  ]);

  const applyDates = (nextFrom, nextTo) => {
    if (nextFrom && nextTo && nextFrom > nextTo) {
      setDateFrom(nextTo);
      setDateTo(nextFrom);
    } else {
      setDateFrom(nextFrom);
      setDateTo(nextTo);
    }
    resetAllPages();
  };

  const applyDatePreset = (dayCount) => {
    const end = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const start = dayCount <= 1 ? end : addIsoDays(end, -(dayCount - 1));
    applyDates(start, end);
  };

  const drillToLedger = (next) => {
    if (Object.prototype.hasOwnProperty.call(next, 'type')) setTypeFilter(next.type || '');
    if (next.dateFrom) setDateFrom(next.dateFrom);
    if (next.dateTo) setDateTo(next.dateTo);
    if (next.productId) {
      setProductFilterId(next.productId);
      setSearch('');
      setAppliedSearch('');
    }
    if (next.branchId) {
      setLocationFilter({ branchId: next.branchId, floorId: null, rackId: null, locationId: null });
    }
    if (Object.prototype.hasOwnProperty.call(next, 'refs')) setRefsFilter(next.refs || '');
    if (next.userId) setOperatorFilterId(next.userId);
    setActiveTab('movements');
    resetAllPages();
  };

  const sharedParams = useMemo(() => {
    const params = new URLSearchParams();
    if (typeFilter) params.set('type', typeFilter);
    if (brandFilter) params.set('brand', brandFilter);
    if (appliedSearch) params.set('search', appliedSearch);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (productFilterId) params.set('productId', productFilterId);
    if (locationFilter.locationId) params.set('locationId', locationFilter.locationId);
    if (locationFilter.branchId) params.set('branchId', locationFilter.branchId);
    if (refsFilter) params.set('refs', refsFilter);
    if (operatorFilterId) params.set('userId', operatorFilterId);
    if (soldForFilterId) params.set('soldForUserId', soldForFilterId);
    if (referenceFilter.trim()) params.set('refExact', referenceFilter.trim());
    return params;
  }, [
    typeFilter,
    brandFilter,
    appliedSearch,
    dateFrom,
    dateTo,
    productFilterId,
    locationFilter.locationId,
    locationFilter.branchId,
    refsFilter,
    operatorFilterId,
    soldForFilterId,
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
    if (appliedSearch) params.set('search', appliedSearch);
    if (brandFilter) params.set('brand', brandFilter);
    return `/api/admin/inventory/activity/position?${params}`;
  }, [canView, activeTab, pages.position, locationFilter.locationId, productFilterId, appliedSearch, brandFilter]);

  const operatorsUrl = useMemo(() => {
    if (!canView || activeTab !== 'operators') return null;
    const params = new URLSearchParams(sharedParams);
    params.set('page', String(pages.operators));
    params.set('limit', '20');
    return `/api/admin/inventory/activity/operators?${params}`;
  }, [canView, activeTab, sharedParams, pages.operators]);

  const insightsUrl = useMemo(() => {
    if (!canView || (activeTab !== 'insights' && activeTab !== 'movements')) return null;
    const params = new URLSearchParams(sharedParams);
    if (insightUnit) params.set('unit', insightUnit);
    if (calendarMonth) params.set('calendarMonth', calendarMonth);
    if (agingFilter) params.set('aging', agingFilter);
    return `/api/admin/inventory/activity/insights?${params}`;
  }, [canView, activeTab, sharedParams, insightUnit, calendarMonth, agingFilter]);

  const referencesUrl = useMemo(() => {
    if (!canView || activeTab !== 'references') return null;
    const params = new URLSearchParams();
    params.set('page', String(pages.references));
    params.set('limit', '20');
    if (typeFilter) params.set('type', typeFilter);
    if (brandFilter) params.set('brand', brandFilter);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (productFilterId) params.set('productId', productFilterId);
    if (locationFilter.locationId) params.set('locationId', locationFilter.locationId);
    if (appliedSearch) params.set('refSearch', appliedSearch);
    return `/api/admin/inventory/activity/references?${params}`;
  }, [
    canView,
    activeTab,
    pages.references,
    typeFilter,
    brandFilter,
    dateFrom,
    dateTo,
    productFilterId,
    locationFilter.locationId,
    appliedSearch,
  ]);

  const brandRes = useSWR(canView ? '/api/admin/inventory/brands' : null, fetcher, { revalidateOnFocus: false });
  const brandOptions = brandRes.data?.brands || [];
  const movementRes = useSWR(movementUrl, fetcher, { revalidateOnFocus: false, keepPreviousData: true });
  const positionRes = useSWR(positionUrl, fetcher, { revalidateOnFocus: false, keepPreviousData: true });
  const operatorsRes = useSWR(operatorsUrl, fetcher, { revalidateOnFocus: false, keepPreviousData: true });
  const insightsRes = useSWR(insightsUrl, fetcher, { revalidateOnFocus: false, keepPreviousData: true });
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
  const searchTruncated = Boolean(
    (activeTab === 'movements' && movementRes.data?.searchMeta?.truncated) ||
    (activeTab === 'position' && positionRes.data?.searchMeta?.truncated) ||
    (activeTab === 'operators' && operatorsRes.data?.searchMeta?.truncated) ||
    (activeTab === 'insights' && insightsRes.data?.searchMeta?.truncated)
  );

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
            Ledger = what happened · Stock = what exists · Operators = who entered it
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

        <div className="space-y-3">
          <div className="grid grid-cols-4 items-end gap-3">
            <label className="relative col-span-3 block min-w-0">
              <span className="sr-only">{activeTab === 'references' ? 'Search reference' : 'Search product, SKU, or barcode'}</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                type="text"
                placeholder={activeTab === 'references' ? 'Search reference' : 'Search product, SKU, or barcode'}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  if (activeTab !== 'references') setProductFilterId('');
                  resetAllPages();
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  setAppliedSearch(search.replace(/[\r\n]+/g, ' ').trim());
                  resetAllPages();
                }}
                className="h-11 w-full rounded-full border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </label>
            <div className="col-span-1 min-w-0">
              <LocationSelector
                mode="filter"
                fields={['branch']}
                selectedBranchId={locationFilter.branchId}
                selectedFloorId={locationFilter.floorId}
                selectedRackId={locationFilter.rackId}
                labelClassName="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500"
                inputClassName="h-11 w-full rounded-full border border-slate-200 bg-white px-4 pr-9 text-sm text-slate-800 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
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
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <FilterSelect
              label="Type"
              value={typeFilter}
              onChange={(event) => {
                setTypeFilter(event.target.value);
                resetAllPages();
              }}
            >
              <option value="">All types</option>
              {LEDGER_FILTER_TYPES.map((key) => (
                <option key={key} value={key}>{LEDGER_FILTER_TYPE_LABELS[key]}</option>
              ))}
            </FilterSelect>

            <FilterSelect
              label="Dates"
              value={matchingDatePreset(dateFrom, dateTo)}
              onChange={(event) => {
                const next = event.target.value;
                if (next === 'custom') return;
                if (!next) {
                  applyDates('', '');
                  return;
                }
                const preset = DATE_PRESETS.find((item) => item.id === next);
                if (preset) applyDatePreset(preset.days);
              }}
            >
              <option value="">All dates</option>
              {DATE_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>{preset.label}</option>
              ))}
              <option value="custom">Custom range</option>
            </FilterSelect>

            <FilterSelect
              label="Brand"
              value={brandFilter}
              onChange={(event) => {
                setBrandFilter(event.target.value);
                resetAllPages();
              }}
            >
              <option value="">All brands</option>
              {brandFilter && !brandOptions.includes(brandFilter) ? (
                <option value={brandFilter}>{brandFilter}</option>
              ) : null}
              {brandOptions.map((brand) => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </FilterSelect>

            <label className="block min-w-0">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => applyDates(e.target.value, dateTo)}
                className="h-11 w-full rounded-full border border-slate-200 bg-white px-4 text-sm text-slate-800 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </label>
            <label className="block min-w-0">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">To</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => applyDates(dateFrom, e.target.value)}
                className="h-11 w-full rounded-full border border-slate-200 bg-white px-4 text-sm text-slate-800 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </label>
          </div>
        </div>

        {searchTruncated && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            Showing the closest products. Type more of the name or SKU to narrow the list.
          </p>
        )}

        {locationFilter.branchId && (
          <div className="border-t border-gray-100 pt-4">
            <LocationSelector
              mode="filter"
              fields={['floor', 'rack']}
              layout="horizontal"
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
        )}

        {(productFilterId || operatorFilterId || soldForFilterId || referenceFilter || refsFilter || locationFilter.branchId || locationFilter.locationId || appliedSearch || typeFilter || brandFilter || dateFrom || dateTo || agingFilter) && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
            {appliedSearch && (
              <button type="button" onClick={() => { setSearch(''); setAppliedSearch(''); resetAllPages(); }}>Search: {appliedSearch} ×</button>
            )}
            {typeFilter && (
              <button type="button" onClick={() => { setTypeFilter(''); resetAllPages(); }}>Type: {LEDGER_FILTER_TYPE_LABELS[typeFilter] || typeFilter} ×</button>
            )}
            {brandFilter && (
              <button type="button" onClick={() => { setBrandFilter(''); resetAllPages(); }}>Brand: {brandFilter} ×</button>
            )}
            {productFilterId && (
              <button type="button" onClick={() => { setProductFilterId(''); resetAllPages(); }}>Product pinned ×</button>
            )}
            {(dateFrom || dateTo) && (
              <button type="button" onClick={() => applyDates('', '')}>
                Dates: {dateFrom || '…'} – {dateTo || '…'} ×
              </button>
            )}
            {locationFilter.branchId && (
              <button type="button" onClick={() => { setLocationFilter({ branchId: null, floorId: null, rackId: null, locationId: null }); resetAllPages(); }}>Branch filter ×</button>
            )}
            {locationFilter.locationId && (
              <button type="button" onClick={() => { setLocationFilter((prev) => ({ ...prev, rackId: null, locationId: null })); resetAllPages(); }}>Rack filter ×</button>
            )}
            {agingFilter === '45' && (
              <button type="button" onClick={() => setAgingFilter('')}>Stock older than 45 days ×</button>
            )}
            {operatorFilterId && (
              <button type="button" onClick={() => { setOperatorFilterId(''); resetAllPages(); }}>Recorded-by filter ×</button>
            )}
            {soldForFilterId && (
              <button type="button" onClick={() => { setSoldForFilterId(''); resetAllPages(); }}>Sold-for filter ×</button>
            )}
            {referenceFilter && (
              <button type="button" onClick={() => { setReferenceFilter(''); resetAllPages(); }}>Ref: {referenceFilter} ×</button>
            )}
            {refsFilter && (
              <button type="button" onClick={() => { setRefsFilter(''); resetAllPages(); }}>Transfer refs ×</button>
            )}
            <button
              type="button"
              onClick={() => {
                setProductFilterId('');
                setOperatorFilterId('');
                setSoldForFilterId('');
                setReferenceFilter('');
                setRefsFilter('');
                setSearch('');
                setAppliedSearch('');
                setTypeFilter('');
                setBrandFilter('');
                setDateFrom('');
                setDateTo('');
                setAgingFilter('');
                setLocationFilter({ branchId: null, floorId: null, rackId: null, locationId: null });
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
          <div className="p-4 border-b border-gray-100 space-y-2">
            <p className="text-sm text-gray-600">Append-only ledger · {movementPagination.total || 0} entries</p>
            {insights?.kpis && (
              <button
                type="button"
                onClick={() => setActiveTab('insights')}
                className="flex flex-wrap gap-3 text-left text-xs text-[#334155]"
              >
                {(insights.kpis || []).slice(0, 5).map((kpi) => (
                  <span key={kpi.id}>{kpi.title}: {Number(kpi.value || 0).toLocaleString()}</span>
                ))}
                <span className="text-[#047857]">Open insights · {insights.range?.label}</span>
              </button>
            )}
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
                        Recorded by {row.performedBy?.name || row.performedBy?.email || '—'}
                        {row.reasonLabel ? ` · ${row.reasonLabel}` : ''}
                      </p>
                      {row.soldForName ? (
                        <p className="text-xs text-gray-600">
                          Sold for{' '}
                          <button
                            type="button"
                            disabled={!row.soldForUserId}
                            onClick={() => {
                              setSoldForFilterId(String(row.soldForUserId));
                              setTabPage('movements', 1);
                            }}
                            className="font-semibold text-emerald-700 hover:underline disabled:text-gray-600 disabled:no-underline"
                          >
                            {row.soldForName}
                          </button>
                        </p>
                      ) : null}
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
        <div>
          {insightsRes.error ? (
            <div className="p-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl">
              {insightsRes.error.message || 'Failed to load insights'}
              <button type="button" className="ml-3 underline" onClick={() => insightsRes.mutate()}>Retry</button>
            </div>
          ) : !insights ? (
            <div className="p-8 bg-white border border-[#E2E8F0] rounded-xl text-center text-[#64748B]">
              <Loader2 className="inline animate-spin text-[#047857]" size={24} />
              <p className="mt-2">Loading insights…</p>
            </div>
          ) : (
            <InsightsDashboard
              data={insights}
              onDrill={drillToLedger}
              onBranch={(branchId) => {
                if (!branchId) return;
                setLocationFilter({ branchId, floorId: null, rackId: null, locationId: null });
                resetAllPages();
              }}
              onUnit={(unit) => setInsightUnit(unit)}
              onCalendarMonth={(delta) => {
                const base = calendarMonth || insights.calendar?.month;
                if (!base) return;
                const shifted = delta > 0 ? addIsoDays(base, 32) : addIsoDays(base, -1);
                setCalendarMonth(`${shifted.slice(0, 7)}-01`);
              }}
              onAging={(value) => setAgingFilter(value)}
            />
          )}
        </div>
      )}
    </div>
  );
}
