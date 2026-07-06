'use client';

import { useCallback, useMemo, useState, Fragment } from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { ChevronDown, ChevronRight, Download, Loader2, Search } from 'lucide-react';
import { adminFetch, adminJson } from '@/lib/client/adminFetch';
import { canReadAuditLog } from '@/lib/shared/permissions';

const fetcher = (url) => adminJson(url);

const ROLE_BADGE_STYLES = {
  super_admin: 'bg-purple-100 text-purple-800',
  inventory_manager: 'bg-emerald-100 text-emerald-800',
  inventory_supervisor: 'bg-emerald-100 text-emerald-800',
  product_manager: 'bg-blue-100 text-blue-800',
  data_entry: 'bg-blue-100 text-blue-800',
  sales: 'bg-orange-100 text-orange-800',
  viewer: 'bg-gray-100 text-gray-700',
};

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  inventory_manager: 'Inventory Manager',
  inventory_supervisor: 'Inventory Supervisor',
  product_manager: 'Product Manager',
  data_entry: 'Data Entry',
  sales: 'Sales',
  viewer: 'Viewer',
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

function DiffBlock({ label, value }) {
  if (value == null) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <pre className="text-xs bg-gray-50 border border-gray-100 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
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
  const filename = match?.[1] || 'audit-log.csv';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function AuditLogPage() {
  const { data: meData } = useSWR('/api/auth/me', fetcher, { revalidateOnFocus: false });
  const role = meData?.user?.role;
  const canView = canReadAuditLog(role);

  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);
  const [exporting, setExporting] = useState(false);

  const auditUrl = useMemo(() => {
    if (!canView) return null;
    const params = new URLSearchParams({ page: String(page), limit: '50', filters: '1' });
    if (search.trim()) params.set('search', search.trim());
    if (action) params.set('action', action);
    if (entityType) params.set('entityType', entityType);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    return `/api/admin/audit?${params}`;
  }, [canView, page, search, action, entityType, dateFrom, dateTo]);

  const { data, error, isLoading, isValidating } = useSWR(auditUrl, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  const items = data?.items || [];
  const pagination = data?.pagination || { page: 1, pages: 1, total: 0 };
  const filterActions = data?.filters?.actions || [];
  const filterEntityTypes = data?.filters?.entityTypes || [];

  const buildExportUrl = useCallback(
    (format) => {
      const params = new URLSearchParams({ format });
      if (search.trim()) params.set('search', search.trim());
      if (action) params.set('action', action);
      if (entityType) params.set('entityType', entityType);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      return `/api/admin/audit/export?${params}`;
    },
    [search, action, entityType, dateFrom, dateTo]
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
        Audit log is restricted to super admins.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Audit log</h1>
          <p className="text-sm text-gray-500 mt-1">
            System-wide record of meaningful actions
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

      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search action or entity…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white"
          >
            <option value="">All actions</option>
            {filterActions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white"
          >
            <option value="">All entities</option>
            {filterEntityTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
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
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {error && (
          <div className="p-4 text-sm text-red-600 bg-red-50 border-b border-red-100">
            {error.message || 'Failed to load audit log'}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 w-8" />
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(isLoading || isValidating) && items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                    <Loader2 className="inline animate-spin text-emerald-600" size={24} />
                    <p className="mt-2">Loading audit log…</p>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                    No audit entries found
                  </td>
                </tr>
              ) : (
                items.map((row) => {
                  const isOpen = expandedId === row._id;
                  const roleStyle =
                    ROLE_BADGE_STYLES[row.actorRole] || 'bg-gray-100 text-gray-700';
                  return (
                    <Fragment key={row._id}>
                      <tr
                        className="hover:bg-gray-50/80 cursor-pointer"
                        onClick={() => setExpandedId(isOpen ? null : row._id)}
                      >
                        <td className="px-4 py-3 text-gray-400">
                          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{row.actorName}</div>
                          <span
                            className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${roleStyle}`}
                          >
                            {ROLE_LABELS[row.actorRole] || row.actorRole || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-700">{row.action}</td>
                        <td className="px-4 py-3 text-gray-600">
                          <div>{row.entityType || '—'}</div>
                          {row.entityId != null && (
                            <div className="text-xs text-gray-400 font-mono mt-0.5 truncate max-w-[200px]">
                              {String(row.entityId)}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                          {formatTs(row.createdAt)}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-gray-50/50">
                          <td colSpan={5} className="px-4 py-4">
                            <div className="grid sm:grid-cols-2 gap-4 max-w-4xl">
                              <DiffBlock label="Before" value={row.before} />
                              <DiffBlock label="After" value={row.after} />
                              {row.metadata && (
                                <div className="sm:col-span-2">
                                  <DiffBlock label="Metadata" value={row.metadata} />
                                </div>
                              )}
                              {row.ip && (
                                <p className="text-xs text-gray-500 sm:col-span-2">IP: {row.ip}</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
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
              className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-white"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={pagination.page >= pagination.pages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-white"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
