'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { adminJson } from '@/lib/client/adminFetch';
import { REQUEST_STATUS_LABELS } from '@/lib/shared/salesConstants';
import { formatPaise } from '@/lib/shared/formatMoney';
import FulfilRackPanel, {
  isLineBalanced,
} from '@/components/admin/inventory/requests/FulfilRackPanel';

const fetcher = (url) => adminJson(url);

/** Approve has already taken these requests out of sellable stock. */
const RESERVED_STATUSES = ['approved', 'partially_approved'];

/**
 * Statuses the supervisor can still act on. Mirrors OPEN_STATUSES on the
 * server, which allows rejecting an approved request and returns the reserved
 * stock to the racks it came from.
 */
const REVIEWABLE_STATUSES = ['submitted', ...RESERVED_STATUSES];

const ACTION_DONE_MESSAGE = {
  approve: 'Approved — stock reserved',
  fulfill: 'Fulfilled — sale recorded',
  reject: 'Rejected — stock returned',
};

/** Rack quantities keyed by line, seeded from what approve reserved. */
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

export default function InventoryRequestsPage() {
  const [selectedId, setSelectedId] = useState(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [allocations, setAllocations] = useState({});

  const { data, mutate } = useSWR('/api/admin/inventory/requests?limit=50', fetcher, {
    revalidateOnFocus: false,
  });

  const { data: detailData, mutate: mutateDetail } = useSWR(
    selectedId ? `/api/admin/inventory/requests/${selectedId}` : null,
    fetcher
  );

  const requests = data?.requests || [];
  const detail = detailData?.request;
  const activities = detailData?.activities || [];
  const fulfilmentPlan = detailData?.fulfilmentPlan || null;
  const isReserved = Boolean(detail && RESERVED_STATUSES.includes(detail.status));

  /**
   * Reseed whenever the plan changes — after approve, after switching request,
   * and after a fulfil — so the panel always opens on what is truly reserved.
   */
  useEffect(() => {
    setAllocations(seedAllocations(fulfilmentPlan));
  }, [fulfilmentPlan]);

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
      mutate();
      mutateDetail();
    } catch (e) {
      toast.error(e.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Stock requests</h1>
        <ul className="divide-y divide-gray-200 bg-white border border-gray-200 rounded-lg max-h-[70vh] overflow-y-auto">
          {requests.map((r) => (
            <li key={r._id}>
              <button
                type="button"
                onClick={() => setSelectedId(r._id)}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${
                  selectedId === r._id ? 'bg-gray-50' : ''
                }`}
              >
                <p className="font-medium">{r.requestNumber}</p>
                <p className="text-sm text-gray-600">
                  {r.customerName} · {r.salesUserName}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {REQUEST_STATUS_LABELS[r.status] || r.status}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        {!detail ? (
          <p className="text-sm text-gray-500">Select a request to review.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">{detail.requestNumber}</h2>
              <p className="text-sm text-gray-600">{detail.customerName}</p>
              <p className="text-xs text-gray-500">Sales: {detail.salesUserName}</p>
            </div>

            <ul className="space-y-2 text-sm">
              {detail.lines?.map((line) => (
                <li key={line._id} className="border border-gray-100 rounded p-2">
                  <p className="font-medium">{line.productTitle}</p>
                  <p className="text-gray-600">
                    Qty {line.requestedQty}
                    {line.approvedQty != null && ` → approved ${line.approvedQty}`}
                    · {formatPaise(line.offeredRatePaise)}
                  </p>
                  <p className="text-xs text-gray-500">Stock at submit: {line.stockAtSubmit}</p>
                </li>
              ))}
            </ul>

            {detail.supervisorComment && (
              <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">{detail.supervisorComment}</p>
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
                {/*
                  Rejecting after approval is deliberate — a sale can still fall
                  through, and the reserved stock has to get back on the shelf.
                  It never reverses a sale: once fulfilled, the option is gone.
                */}
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
  );
}
