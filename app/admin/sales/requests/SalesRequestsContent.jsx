'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { adminJson } from '@/lib/client/adminFetch';
import { primeSalesSessionCache } from '@/lib/client/salesSessionCache';
import { groupRequestsByDate, formatRequestDateTime } from '@/lib/shared/requestHistory';
import { REQUEST_STATUS_LABELS } from '@/lib/shared/salesConstants';

const fetcher = (url) => adminJson(url);

const CLONEABLE = ['rejected', 'approved', 'partially_approved', 'fulfilled', 'cancelled'];

const STATUS_FILTERS = ['', 'submitted', 'approved', 'rejected', 'fulfilled'];

const DATE_FILTERS = [
  { value: '', label: 'All time' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
];

function StatusBadge({ status }) {
  const colors = {
    submitted: 'bg-amber-100 text-amber-900',
    approved: 'bg-green-100 text-green-900',
    partially_approved: 'bg-blue-100 text-blue-900',
    rejected: 'bg-red-100 text-red-900',
    fulfilled: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-gray-100 text-gray-500',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100'}`}>
      {REQUEST_STATUS_LABELS[status] || status}
    </span>
  );
}

function SummaryCard({ label, value, sub }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-semibold text-gray-900 mt-0.5">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function buildListUrl({ status, days, q }) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (days) params.set('days', days);
  if (q?.trim()) params.set('q', q.trim());
  const qs = params.toString();
  return `/api/sales/requests?limit=100${qs ? `&${qs}` : ''}`;
}

function buildPageUrl({ status, days, q }) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (days) params.set('days', days);
  if (q?.trim()) params.set('q', q.trim());
  const qs = params.toString();
  return qs ? `/admin/sales/requests?${qs}` : '/admin/sales/requests';
}

export default function SalesRequestsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const status = searchParams.get('status') || '';
  const days = searchParams.get('days') || '';
  const qParam = searchParams.get('q') || '';

  const [searchInput, setSearchInput] = useState(qParam);
  const [cloningId, setCloningId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    setSearchInput(qParam);
  }, [qParam]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchInput.trim();
      if (trimmed === qParam) return;
      router.replace(buildPageUrl({ status, days, q: trimmed }), { scroll: false });
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput, qParam, status, days, router]);

  const listUrl = buildListUrl({ status, days, q: qParam });
  const { data, isLoading } = useSWR(listUrl, fetcher, { revalidateOnFocus: false });

  const requests = data?.requests || [];
  const summary = data?.summary;
  const groups = useMemo(() => groupRequestsByDate(requests), [requests]);

  const approvedCount =
    (summary?.byStatus?.approved || 0) + (summary?.byStatus?.partially_approved || 0);
  const rejectedCount = summary?.byStatus?.rejected || 0;
  const pendingCount = summary?.byStatus?.submitted || 0;
  const total = summary?.total ?? requests.length;
  const resolved = total - pendingCount;
  const approvedPct = resolved > 0 ? Math.round((approvedCount / resolved) * 100) : null;

  const setDaysFilter = useCallback(
    (value) => {
      router.replace(buildPageUrl({ status, days: value, q: qParam }), { scroll: false });
    },
    [router, status, qParam]
  );

  const handleClone = async (requestId) => {
    if (cloningId) return;
    setCloningId(requestId);
    try {
      const { bucket } = await adminJson(`/api/sales/requests/${requestId}/clone`, {
        method: 'POST',
      });
      await primeSalesSessionCache();
      router.push(`/admin/sales?bucket=${bucket._id}`);
      toast.success(`Draft ready for ${bucket.customerName || 'customer'}`);
    } catch (e) {
      toast.error(e.message || 'Could not clone request');
    } finally {
      setCloningId(null);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Request history</h1>
          <p className="text-sm text-gray-600 mt-1">
            Track submissions, outcomes, and start new requests from past orders.
          </p>
        </div>
        <Link href="/admin/sales" className="inline-flex items-center min-h-[44px] text-sm text-gray-600 hover:underline shrink-0">
          ← Back to sales floor
        </Link>
      </div>

      {!isLoading && summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard label="Total" value={total} />
          <SummaryCard label="Pending" value={pendingCount} />
          <SummaryCard
            label="Approved"
            value={approvedCount}
            sub={approvedPct != null ? `${approvedPct}% of resolved` : undefined}
          />
          <SummaryCard label="Rejected" value={rejectedCount} />
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="search"
          placeholder="Search request #, customer, product, SKU…"
          className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-base sm:text-sm min-h-[48px]"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <div className="flex gap-2 flex-wrap">
          {DATE_FILTERS.map((d) => (
            <button
              key={d.value || 'all'}
              type="button"
              onClick={() => setDaysFilter(d.value)}
              className={`min-h-[40px] px-4 py-2 rounded-full text-sm border whitespace-nowrap ${
                days === d.value ? 'bg-black text-white border-black' : 'border-gray-300'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map((s) => (
          <Link
            key={s || 'all'}
            href={buildPageUrl({ status: s, days, q: qParam })}
            className={`inline-flex items-center min-h-[40px] px-4 py-2 rounded-full text-sm border ${
              status === s ? 'bg-black text-white border-black' : 'border-gray-300'
            }`}
          >
            {s ? REQUEST_STATUS_LABELS[s] : 'All statuses'}
          </Link>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : requests.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-sm text-gray-600">
            {qParam || days || status
              ? 'No requests match your filters.'
              : 'No requests yet. Submit one from the sales floor.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.sortKey}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                {group.label}
              </h2>
              <ul className="divide-y divide-gray-200 bg-white border border-gray-200 rounded-lg overflow-hidden">
                {group.items.map((r) => {
                  const isExpanded = expandedId === r._id;
                  return (
                    <li key={r._id} className="px-4 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <button
                          type="button"
                          className="min-w-0 text-left flex-1 py-1"
                          onClick={() => setExpandedId(isExpanded ? null : r._id)}
                        >
                          <p className="font-medium text-gray-900">{r.requestNumber}</p>
                          <p className="text-sm text-gray-600">{r.customerName || 'Walk-in'}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {formatRequestDateTime(r)} · {r.lines?.length || 0} item
                            {(r.lines?.length || 0) !== 1 ? 's' : ''}
                          </p>
                          {r.status === 'rejected' && r.supervisorComment && !isExpanded && (
                            <p className="text-xs text-red-700 mt-1 line-clamp-1">
                              Rejected: {r.supervisorComment}
                            </p>
                          )}
                        </button>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <StatusBadge status={r.status} />
                          {CLONEABLE.includes(r.status) && (
                            <button
                              type="button"
                              disabled={cloningId === r._id}
                              onClick={() => handleClone(r._id)}
                              className="text-sm min-h-[40px] px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                            >
                              {cloningId === r._id ? 'Creating…' : 'New request'}
                            </button>
                          )}
                          {r.status === 'fulfilled' && (
                            <Link
                              href={`/admin/sales/requests/${r._id}/slip`}
                              className="text-sm min-h-[40px] px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 inline-flex items-center"
                            >
                              Charge sheet
                            </Link>
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-gray-100 text-sm space-y-3">
                          {r.supervisorComment && (
                            <p className="text-xs text-gray-700 bg-gray-50 rounded px-2 py-1.5">
                              <span className="font-medium">Supervisor note:</span>{' '}
                              {r.supervisorComment}
                              {r.reviewedByName ? ` (${r.reviewedByName})` : ''}
                            </p>
                          )}
                          <ul className="space-y-1.5">
                            {(r.lines || []).map((line) => (
                              <li
                                key={line._id}
                                className="flex justify-between gap-2 text-xs text-gray-700"
                              >
                                <span className="truncate">
                                  {line.productTitle}
                                  {line.sku ? ` · ${line.sku}` : ''}
                                </span>
                                <span className="shrink-0 text-gray-500">
                                  ×{line.requestedQty}
                                  {line.approvedQty != null && line.approvedQty !== line.requestedQty
                                    ? ` (${line.approvedQty} approved)`
                                    : ''}
                                </span>
                              </li>
                            ))}
                          </ul>
                          <p className="text-xs text-gray-400">
                            Submitted {formatRequestDateTime(r)}
                            {r.reviewedAt
                              ? ` · Reviewed ${new Date(r.reviewedAt).toLocaleString()}`
                              : ''}
                            {r.fulfilledAt
                              ? ` · Fulfilled ${new Date(r.fulfilledAt).toLocaleString()}`
                              : ''}
                          </p>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400">
        All requests are kept for audit. Use date filters to focus on recent activity — nothing is
        deleted from the system.
      </p>
    </div>
  );
}
