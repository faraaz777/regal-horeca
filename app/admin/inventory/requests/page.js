'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { adminJson } from '@/lib/client/adminFetch';
import {
  REQUEST_STATUS_LABELS,
  NEEDS_ACTION_STATUSES,
} from '@/lib/shared/salesConstants';
import { formatPaise } from '@/lib/shared/formatMoney';
import { formatWaiting } from '@/lib/shared/requestHistory';
import FulfilRackPanel, {
  isLineBalanced,
} from '@/components/admin/inventory/requests/FulfilRackPanel';

const fetcher = (url) => adminJson(url);

const RESERVED_STATUSES = ['approved', 'partially_approved'];
const REVIEWABLE_STATUSES = ['submitted', ...RESERVED_STATUSES];

const ACTION_DONE_MESSAGE = {
  approve: 'Approved — stock reserved',
  fulfill: 'Fulfilled — sale recorded',
  reject: 'Rejected — stock returned',
};

const STATUS_CHIPS = [
  { value: 'needs_action', label: 'Needs action' },
  { value: 'submitted', label: 'Pending review' },
  { value: 'approved', label: 'Approved' },
  { value: 'fulfilled', label: 'Fulfilled' },
  { value: 'rejected', label: 'Rejected' },
  { value: '', label: 'All' },
];

function seedAllocations(plan) {
  const seeded = {};
  for (const line of plan || []) {
    seeded[line.lineId] = {};
    for (const slice of line.reserved || []) {
      seeded[line.lineId][slice.locationId] = slice.qty;
    }
  }
  return seeded;
}

function lineQty(r) {
  const lines = r.lines || [];
  const pcs = lines.reduce((sum, line) => sum + (Number(line.requestedQty) || 0), 0);
  return { count: lines.length, pcs };
}

function StatusBadge({ status }) {
  const colors = {
    submitted: 'bg-amber-100 text-amber-900',
    approved: 'bg-green-100 text-green-900',
    partially_approved: 'bg-blue-100 text-blue-900',
    rejected: 'bg-red-100 text-red-800',
    fulfilled: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-gray-100 text-gray-500',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${colors[status] || 'bg-gray-100'}`}>
      {REQUEST_STATUS_LABELS[status] || status}
    </span>
  );
}

export default function InventoryRequestsPage() {
  const [status, setStatus] = useState('needs_action');
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [allocations, setAllocations] = useState({});

  useEffect(() => {
    const timer = setTimeout(() => setQ(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const listUrl = useMemo(() => {
    const params = new URLSearchParams({ limit: '50' });
    if (status) params.set('status', status);
    if (q) params.set('q', q);
    return `/api/admin/inventory/requests?${params}`;
  }, [status, q]);

  const { data, mutate } = useSWR(listUrl, fetcher, { revalidateOnFocus: false });
  const { data: detailData, mutate: mutateDetail } = useSWR(
    selectedId ? `/api/admin/inventory/requests/${selectedId}` : null,
    fetcher
  );

  const requests = data?.requests || [];
  const byStatus = data?.summary?.byStatus || {};
  const needsCount =
    (byStatus.submitted || 0) + (byStatus.approved || 0) + (byStatus.partially_approved || 0);
  const chipCount = (value) => {
    if (value === 'needs_action') return needsCount;
    if (value === 'approved') return (byStatus.approved || 0) + (byStatus.partially_approved || 0);
    if (!value) return data?.summary?.total ?? requests.length;
    return byStatus[value] || 0;
  };

  const detail = detailData?.request;
  const activities = detailData?.activities || [];
  const fulfilmentPlan = detailData?.fulfilmentPlan || null;
  const liveStock = detailData?.liveStock || null;
  const isReserved = Boolean(detail && RESERVED_STATUSES.includes(detail.status));

  useEffect(() => {
    if (!requests.length) {
      setSelectedId(null);
      return;
    }
    if (selectedId && requests.some((r) => r._id === selectedId)) return;
    setSelectedId(requests[0]._id);
  }, [requests, selectedId]);

  useEffect(() => {
    setAllocations(seedAllocations(fulfilmentPlan));
    setComment('');
  }, [fulfilmentPlan, selectedId]);

  const setRackQty = useCallback((lineId, locationId, qty) => {
    setAllocations((prev) => ({
      ...prev,
      [lineId]: { ...(prev[lineId] || {}), [locationId]: qty },
    }));
  }, []);

  const resetLine = useCallback(
    (lineId) => {
      const line = (fulfilmentPlan || []).find((l) => l.lineId === lineId);
      if (!line) return;
      const reset = {};
      for (const slice of line.reserved || []) reset[slice.locationId] = slice.qty;
      setAllocations((prev) => ({ ...prev, [lineId]: reset }));
    },
    [fulfilmentPlan]
  );

  const fulfilReady = useMemo(() => {
    if (!fulfilmentPlan?.length) return true;
    return fulfilmentPlan.every((line) =>
      isLineBalanced(line, allocations[line.lineId] || {})
    );
  }, [fulfilmentPlan, allocations]);

  const handleReview = async (action) => {
    if (!selectedId) return;
    if (action === 'reject' && !comment.trim()) {
      toast.error('Comment required for rejection');
      return;
    }

    const payload = { action, comment };
    if (action === 'fulfill' && fulfilmentPlan?.length) {
      payload.allocations = fulfilmentPlan.map((line) => ({
        lineId: line.lineId,
        locations: Object.entries(allocations[line.lineId] || {})
          .map(([locationId, qty]) => ({ locationId, qty: Number(qty) || 0 }))
          .filter((loc) => loc.qty > 0),
      }));
    }

    setBusy(true);
    try {
      await adminJson(`/api/admin/inventory/requests/${selectedId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      toast.success(ACTION_DONE_MESSAGE[action] || 'Updated');
      setComment('');
      const nextList = await mutate();
      const remaining = (nextList?.requests || []).filter((r) => r._id !== selectedId);
      const next =
        status === 'needs_action' || !status
          ? remaining.find((r) => NEEDS_ACTION_STATUSES.includes(r.status)) || remaining[0]
          : remaining[0];
      setSelectedId(next?._id || null);
      mutateDetail();
    } catch (e) {
      toast.error(e.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Stock requests</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Newest first. Closed requests stay in history — they are never deleted.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_CHIPS.map((chip) => (
          <button
            key={chip.value || 'all'}
            type="button"
            onClick={() => {
              setStatus(chip.value);
              setSelectedId(null);
            }}
            className={`inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-full text-sm border ${
              status === chip.value
                ? 'bg-black text-white border-black'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {chip.label}
            <span className={`tabular-nums text-xs ${status === chip.value ? 'text-white/80' : 'text-gray-500'}`}>
              {chipCount(chip.value)}
            </span>
          </button>
        ))}
      </div>

      <input
        type="search"
        placeholder="Search request #, customer, salesman, SKU…"
        className="w-full max-w-xl border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
      />

      <div className="grid lg:grid-cols-2 gap-6">
        <div className={selectedId ? 'hidden lg:block' : ''}>
          <ul className="divide-y divide-gray-200 bg-white border border-gray-200 rounded-lg max-h-[70vh] overflow-y-auto">
            {requests.length === 0 ? (
              <li className="px-4 py-8 text-sm text-gray-500 text-center">
                {q || status ? 'No requests match these filters.' : 'No stock requests yet.'}
              </li>
            ) : (
              requests.map((r) => {
                const { count, pcs } = lineQty(r);
                const waiting = NEEDS_ACTION_STATUSES.includes(r.status)
                  ? formatWaiting(r.submittedAt || r.createdAt)
                  : '';
                return (
                  <li key={r._id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(r._id)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${
                        selectedId === r._id ? 'bg-gray-50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-gray-900">{r.requestNumber}</p>
                        <StatusBadge status={r.status} />
                      </div>
                      <p className="text-sm text-gray-600 mt-0.5">
                        {r.customerName || 'Walk-in'} · {r.salesUserName || '—'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {count} line{count !== 1 ? 's' : ''} · {pcs} pcs
                        {waiting ? ` · ${waiting}` : ''}
                      </p>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        <div className={`bg-white border border-gray-200 rounded-lg p-4 ${!selectedId ? 'hidden lg:block' : ''}`}>
          {selectedId ? (
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="lg:hidden text-sm text-gray-600 mb-3 hover:underline"
            >
              ← Back to list
            </button>
          ) : null}

          {!detail ? (
            <p className="text-sm text-gray-500">Select a request to review.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-lg font-semibold">{detail.requestNumber}</h2>
                  <StatusBadge status={detail.status} />
                </div>
                <p className="text-sm text-gray-800 mt-1">{detail.customerName || 'Walk-in'}</p>
                {detail.phone ? <p className="text-xs text-gray-500">{detail.phone}</p> : null}
                <p className="text-xs text-gray-500 mt-1">
                  Sales: {detail.salesUserName || '—'}
                  {detail.submittedAt || detail.createdAt
                    ? ` · ${new Date(detail.submittedAt || detail.createdAt).toLocaleString('en-IN')}`
                    : ''}
                </p>
              </div>

              <div className="overflow-x-auto border border-gray-100 rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Product</th>
                      <th className="px-3 py-2 text-right">Asked</th>
                      {detail.lines?.some((l) => l.approvedQty != null) ? (
                        <th className="px-3 py-2 text-right">Approved</th>
                      ) : null}
                      {liveStock ? <th className="px-3 py-2 text-right">On hand</th> : null}
                      <th className="px-3 py-2 text-right">Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {detail.lines?.map((line) => {
                      const live = liveStock?.[String(line.productId)];
                      return (
                        <tr key={line._id}>
                          <td className="px-3 py-2">
                            <p className="font-medium text-gray-900">{line.productTitle}</p>
                            {line.sku ? (
                              <p className="text-[11px] font-mono text-gray-500">{line.sku}</p>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{line.requestedQty}</td>
                          {detail.lines?.some((l) => l.approvedQty != null) ? (
                            <td className="px-3 py-2 text-right tabular-nums">
                              {line.approvedQty ?? '—'}
                            </td>
                          ) : null}
                          {liveStock ? (
                            <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                              {live ?? '—'}
                            </td>
                          ) : null}
                          <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                            {formatPaise(line.offeredRatePaise)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {detail.supervisorComment && (
                <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                  {detail.supervisorComment}
                </p>
              )}

              {REVIEWABLE_STATUSES.includes(detail.status) && (
                <textarea
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder={
                    isReserved ? 'Reason (required to reject)' : 'Comment (required if rejecting)'
                  }
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                />
              )}

              {detail.status === 'submitted' && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleReview('approve')}
                    className="flex-1 py-2 bg-green-700 text-white rounded text-sm disabled:opacity-50"
                  >
                    Approve & reserve
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleReview('reject')}
                    className="flex-1 py-2 bg-red-600 text-white rounded text-sm disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              )}

              {isReserved && (
                <div className="space-y-2">
                  <FulfilRackPanel
                    plan={fulfilmentPlan}
                    allocations={allocations}
                    onChange={setRackQty}
                    onReset={resetLine}
                  />
                  <button
                    type="button"
                    disabled={busy || !fulfilReady}
                    onClick={() => handleReview('fulfill')}
                    className="w-full py-2 bg-black text-white rounded text-sm disabled:opacity-50"
                  >
                    Fulfil & record sale
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleReview('reject')}
                    className="w-full py-2 border border-red-300 text-red-700 rounded text-sm hover:bg-red-50 disabled:opacity-50"
                  >
                    Reject & return stock
                  </button>
                </div>
              )}

              {activities.length > 0 && (
                <div className="border-t pt-3">
                  <p className="text-xs font-medium text-gray-500 mb-2">Activity</p>
                  <ul className="text-xs space-y-1 text-gray-600">
                    {activities.map((a) => (
                      <li key={a._id}>
                        {a.userName || 'System'} — {a.action}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}