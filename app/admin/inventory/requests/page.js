'use client';

import { useState } from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { adminJson } from '@/lib/client/adminFetch';
import { REQUEST_STATUS_LABELS } from '@/lib/shared/salesConstants';
import { formatPaise } from '@/lib/shared/formatMoney';

const fetcher = (url) => adminJson(url);

export default function InventoryRequestsPage() {
  const [selectedId, setSelectedId] = useState(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

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

  const handleReview = async (action) => {
    if (!selectedId) return;
    if (action === 'reject' && !comment.trim()) {
      toast.error('Comment required for rejection');
      return;
    }
    setBusy(true);
    try {
      await adminJson(`/api/admin/inventory/requests/${selectedId}`, {
        method: 'PATCH',
        body: JSON.stringify({ action, comment }),
      });
      toast.success(action === 'approve' ? 'Approved' : action === 'fulfill' ? 'Fulfilled' : 'Updated');
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

            {detail.status === 'submitted' && (
              <>
                <textarea
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="Comment (required if rejecting)"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                />
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
              </>
            )}

            {['approved', 'partially_approved'].includes(detail.status) && (
              <button
                type="button"
                disabled={busy}
                onClick={() => handleReview('fulfill')}
                className="w-full py-2 bg-black text-white rounded text-sm disabled:opacity-50"
              >
                Mark fulfilled (deduct hold)
              </button>
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
