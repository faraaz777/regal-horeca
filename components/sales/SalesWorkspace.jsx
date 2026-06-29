'use client';



import { useState, useCallback, useEffect, useRef } from 'react';

import { useSearchParams, useRouter } from 'next/navigation';

import useSWR from 'swr';

import toast from 'react-hot-toast';

import Link from 'next/link';

import { adminJson } from '@/lib/client/adminFetch';

import { primeSalesSessionCache, SALES_SESSION_KEY } from '@/lib/client/salesSessionCache';

import { formatPaise } from '@/lib/shared/formatMoney';
import SalesCatalogBrowse from '@/components/sales/SalesCatalogBrowse';

import { REQUEST_STATUS_LABELS } from '@/lib/shared/salesConstants';



const fetcher = (url) => adminJson(url);



function requestStatusClass(status) {

  const map = {

    submitted: 'text-amber-700 bg-amber-50',

    approved: 'text-green-700 bg-green-50',

    partially_approved: 'text-blue-700 bg-blue-50',

    rejected: 'text-red-700 bg-red-50',

    fulfilled: 'text-gray-700 bg-gray-100',

    cancelled: 'text-gray-500 bg-gray-50',

  };

  return map[status] || 'text-gray-600 bg-gray-50';

}



function CustomerFields({ bucket, onPatch }) {

  const [name, setName] = useState('');

  const [phone, setPhone] = useState('');

  const [suggestions, setSuggestions] = useState([]);

  const [showSuggestions, setShowSuggestions] = useState(false);

  const searchTimer = useRef(null);

  const wrapperRef = useRef(null);



  useEffect(() => {

    setName(bucket.customerName || '');

    setPhone(bucket.phone || '');

    setSuggestions([]);

    setShowSuggestions(false);

  }, [bucket._id, bucket.customerName, bucket.phone]);



  useEffect(() => {

    function handleClickOutside(e) {

      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {

        setShowSuggestions(false);

      }

    }

    document.addEventListener('mousedown', handleClickOutside);

    return () => document.removeEventListener('mousedown', handleClickOutside);

  }, []);



  const searchCustomers = (term) => {

    if (searchTimer.current) clearTimeout(searchTimer.current);

    if (!term || term.length < 2) {

      setSuggestions([]);

      return;

    }

    searchTimer.current = setTimeout(async () => {

      try {

        const data = await adminJson(

          `/api/sales/customers?q=${encodeURIComponent(term)}&limit=8`

        );

        setSuggestions(data.customers || []);

        setShowSuggestions((data.customers || []).length > 0);

      } catch {

        setSuggestions([]);

      }

    }, 250);

  };



  const selectCustomer = async (customer) => {

    setName(customer.name);

    setPhone(customer.phone);

    setShowSuggestions(false);

    setSuggestions([]);

    try {

      await onPatch({

        customerName: customer.name,

        phone: customer.phone,

        email: customer.email || '',

      });

    } catch {

      /* onPatch handles toast */

    }

  };



  return (
    <div className="mt-2 space-y-2" ref={wrapperRef}>
      <input
        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
        placeholder="Customer name"

        value={name}

        onChange={(e) => setName(e.target.value)}

        onBlur={() => {

          if (name !== (bucket.customerName || '')) {

            onPatch({ customerName: name });

          }

        }}

      />

      <div className="relative">

        <input
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          placeholder="Phone"

          value={phone}

          onChange={(e) => {

            setPhone(e.target.value);

            searchCustomers(e.target.value);

          }}

          onFocus={() => {

            if (suggestions.length > 0) setShowSuggestions(true);

          }}

          onBlur={() => {

            setTimeout(() => {

              if (phone !== (bucket.phone || '')) {

                onPatch({ phone });

              }

            }, 150);

          }}

        />

        {showSuggestions && suggestions.length > 0 && (

          <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">

            {suggestions.map((c) => (

              <li key={c.id}>

                <button

                  type="button"

                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"

                  onMouseDown={(e) => {

                    e.preventDefault();

                    selectCustomer(c);

                  }}

                >

                  <span className="font-medium">{c.name}</span>

                  <span className="text-gray-500 ml-2">{c.phone}</span>

                </button>

              </li>

            ))}

          </ul>

        )}

      </div>

    </div>

  );

}



export default function SalesWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusBucketParam = searchParams.get('bucket');
  const clearedFocusParam = useRef(false);

  const [activeBucketId, setActiveBucketId] = useState(null);

  const [submitting, setSubmitting] = useState(false);

  const [closingSession, setClosingSession] = useState(false);



  const { data: workspace, mutate: mutateWorkspace, isLoading: sessionLoading } = useSWR(
    SALES_SESSION_KEY,
    fetcher,
    { revalidateOnFocus: true, revalidateOnMount: true }
  );



  const buckets = workspace?.buckets || [];

  // Open the bucket created via "New request" on the requests list.
  useEffect(() => {
    if (!focusBucketParam || clearedFocusParam.current || buckets.length === 0) return;

    const focused = buckets.find((b) => String(b._id) === focusBucketParam);
    if (focused) {
      setActiveBucketId(focused._id);
      clearedFocusParam.current = true;
      router.replace('/admin/sales', { scroll: false });
    }
  }, [focusBucketParam, buckets, router]);

  useEffect(() => {

    if (buckets.length === 0) {

      setActiveBucketId(null);

      return;

    }

    const stillExists = buckets.some((b) => String(b._id) === String(activeBucketId));

    if (!activeBucketId || !stillExists) {

      const latestDraft = [...buckets].reverse().find((b) => b.status === 'draft');

      setActiveBucketId((latestDraft || buckets[buckets.length - 1])._id);

    }

  }, [buckets, activeBucketId]);



  const activeBucket =

    buckets.find((b) => String(b._id) === String(activeBucketId)) || null;



  const { data: requestsData } = useSWR('/api/sales/requests?limit=5', fetcher, {

    revalidateOnFocus: false,

  });



  const pendingCount =

    requestsData?.requests?.filter((r) => r.status === 'submitted').length || 0;



  const refresh = useCallback(async () => {
    await primeSalesSessionCache();
  }, []);



  const handleAddCustomer = async () => {

    try {

      const { bucket } = await adminJson('/api/sales/buckets', {

        method: 'POST',

        body: JSON.stringify({}),

      });

      setActiveBucketId(bucket._id);

      toast.success(`Customer ${bucket.displayNumber} added`);

      await refresh();

    } catch (e) {

      toast.error(e.message || 'Failed to add customer');

    }

  };



  const handleAddProduct = async (product) => {

    if (!activeBucket || activeBucket.status !== 'draft') {

      toast.error('Select a draft customer bucket first');

      return;

    }

    try {

      await adminJson(`/api/sales/buckets/${activeBucket._id}/lines`, {

        method: 'POST',

        body: JSON.stringify({ productId: product.id, quantity: 1 }),

      });

      toast.success(`Added ${product.title}`);

      await refresh();

    } catch (e) {

      toast.error(e.message || 'Failed to add product');

    }

  };



  const handleUpdateLineQty = async (lineId, quantity) => {

    if (!activeBucket || quantity < 1) return;

    const lines = activeBucket.lines.map((l) =>

      String(l._id) === String(lineId)

        ? {

            productId: String(l.productId),

            quantity,

            offeredRatePaise: l.offeredRatePaise,

            notes: l.notes,

          }

        : {

            productId: String(l.productId),

            quantity: l.quantity,

            offeredRatePaise: l.offeredRatePaise,

            notes: l.notes,

          }

    );

    try {

      await adminJson(`/api/sales/buckets/${activeBucket._id}/lines`, {

        method: 'PUT',

        body: JSON.stringify({ lines }),

      });

      await refresh();

    } catch (e) {

      toast.error(e.message || 'Update failed');

    }

  };



  const handleRemoveLine = async (lineId) => {

    if (!activeBucket) return;

    const lines = activeBucket.lines

      .filter((l) => String(l._id) !== String(lineId))

      .map((l) => ({

        productId: String(l.productId),

        quantity: l.quantity,

        offeredRatePaise: l.offeredRatePaise,

        notes: l.notes,

      }));

    try {

      await adminJson(`/api/sales/buckets/${activeBucket._id}/lines`, {

        method: 'PUT',

        body: JSON.stringify({ lines }),

      });

      await refresh();

    } catch (e) {

      toast.error(e.message || 'Remove failed');

    }

  };



  const handleSubmitBucket = async () => {

    if (!activeBucket) return;

    if (!confirm('Send this bucket to inventory for approval?')) return;

    setSubmitting(true);

    try {

      const result = await adminJson(`/api/sales/buckets/${activeBucket._id}/submit`, {

        method: 'POST',

      });

      if (result.stockWarnings?.length) {

        toast(

          `${result.stockWarnings.length} item(s) exceed available stock — inventory will review`,

          { icon: '⚠️' }

        );

      } else {

        toast.success(`Request ${result.request.requestNumber} submitted`);

      }

      await refresh();

    } catch (e) {

      toast.error(e.message || 'Submit failed');

    } finally {

      setSubmitting(false);

    }

  };



  const handleCustomerPatch = async (patch) => {

    if (!activeBucket || activeBucket.status !== 'draft') return;

    try {

      await adminJson(`/api/sales/buckets/${activeBucket._id}`, {

        method: 'PATCH',

        body: JSON.stringify(patch),

      });

      await mutateWorkspace();

    } catch (e) {

      toast.error(e.message || 'Save failed');

      throw e;

    }

  };



  const handleCloseTab = async () => {

    if (!activeBucket) return;

    const isDraft = activeBucket.status === 'draft';

    const msg = isDraft

      ? 'Close this empty customer tab?'

      : 'Remove this customer from your workspace? History stays in My requests.';

    if (!confirm(msg)) return;

    try {

      const result = await adminJson(`/api/sales/buckets/${activeBucket._id}/complete`, {

        method: 'POST',

      });

      toast.success(result.removed ? 'Tab closed' : 'Customer marked done');

      setActiveBucketId(null);

      await mutateWorkspace();

    } catch (e) {

      toast.error(e.message || 'Could not close tab');

    }

  };



  const handleCloneRequest = async () => {
    if (!activeBucket) return;
    try {
      const { bucket } = await adminJson(`/api/sales/buckets/${activeBucket._id}/clone`, {
        method: 'POST',
      });
      setActiveBucketId(bucket._id);
      await primeSalesSessionCache();
      toast.success('New draft created — edit and resubmit when ready');
    } catch (e) {
      toast.error(e.message || 'Could not create new request');
    }
  };



  const handleEndSession = async () => {

    if (!confirm('End this sales session? Active customer tabs will stay until you close them.')) {

      return;

    }

    setClosingSession(true);

    try {

      await adminJson('/api/sales/session', { method: 'DELETE' });

      toast.success('Session ended');

      setActiveBucketId(null);

      await mutateWorkspace();

    } catch (e) {

      toast.error(e.message || 'Could not end session');

    } finally {

      setClosingSession(false);

    }

  };



  const linked = activeBucket?.linkedRequest;

  const canClone =

    activeBucket?.status === 'submitted' &&

    linked &&

    ['rejected', 'approved', 'partially_approved', 'fulfilled', 'cancelled'].includes(

      linked.status

    );



  return (

    <div className="space-y-6">

      <div className="flex flex-wrap items-center justify-between gap-4">

        <div>

          <h1 className="text-2xl font-bold text-gray-900">Sales floor</h1>

          <p className="text-sm text-gray-600 mt-1">

            Assist customers, build quotes, and send stock requests to inventory.

          </p>

        </div>

        <div className="flex items-center gap-2 flex-wrap">

          {pendingCount > 0 && (

            <Link

              href="/admin/sales/requests?status=submitted"

              className="text-sm px-3 py-1.5 rounded-full bg-amber-100 text-amber-900 font-medium"

            >

              {pendingCount} pending

            </Link>

          )}

          <Link

            href="/admin/sales/requests"

            className="text-sm text-gray-600 hover:text-gray-900 underline"

          >

            All requests

          </Link>

          <button

            type="button"

            disabled={closingSession}

            onClick={handleEndSession}

            className="text-sm px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"

          >

            {closingSession ? 'Ending…' : 'End session'}

          </button>

        </div>

      </div>



      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-3">

        {sessionLoading && buckets.length === 0 ? (

          <span className="text-sm text-gray-500">Loading session…</span>

        ) : (

          buckets.map((b) => {

            const isActive = String(b._id) === String(activeBucket?._id);

            const label = b.customerName || `Customer ${b.displayNumber}`;

            const reqStatus = b.linkedRequest?.status;

            return (

              <button

                key={b._id}

                type="button"

                onClick={() => setActiveBucketId(b._id)}

                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${

                  isActive

                    ? 'bg-black text-white border-black'

                    : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'

                }`}

              >

                {label}

                {b.lines?.length > 0 && (

                  <span className="ml-2 opacity-80">({b.lines.length})</span>

                )}

                {reqStatus && (

                  <span

                    className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded ${

                      isActive ? 'bg-white/20' : requestStatusClass(reqStatus)

                    }`}

                  >

                    {REQUEST_STATUS_LABELS[reqStatus] || reqStatus}

                  </span>

                )}

              </button>

            );

          })

        )}

        <button

          type="button"

          onClick={handleAddCustomer}

          className="px-4 py-2 rounded-lg text-sm font-medium border border-dashed border-gray-400 text-gray-600 hover:bg-gray-50"

        >

          + Add customer

        </button>

      </div>



      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-start">
        <div className="flex-1 min-w-0 w-full">
          <SalesCatalogBrowse activeBucket={activeBucket} onAddProduct={handleAddProduct} />
        </div>

        <div className="w-full lg:w-64 xl:w-72 shrink-0 bg-white border border-gray-200 rounded-lg p-3 space-y-2.5 lg:sticky lg:top-6">
          {!activeBucket ? (
            <p className="text-xs text-gray-500">Click &quot;+ Add customer&quot; to start a quote.</p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-gray-900 leading-tight">
                    Customer {activeBucket.displayNumber}
                  </h2>
                  {linked && (
                    <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                      {linked.requestNumber}
                      {linked.reviewedByName ? ` · ${linked.reviewedByName}` : ''}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleCloseTab}
                  className="text-[11px] text-gray-500 hover:text-gray-800 shrink-0"
                  title="Remove from workspace"
                >
                  Close
                </button>
              </div>

              {linked && (
                <div
                  className={`rounded px-2 py-1.5 text-xs ${requestStatusClass(linked.status)}`}
                >
                  <p className="font-medium leading-snug">
                    {REQUEST_STATUS_LABELS[linked.status] || linked.status}
                  </p>
                  {linked.status === 'rejected' && linked.supervisorComment && (
                    <p className="mt-0.5 text-[11px]">
                      <span className="font-medium">Reason:</span> {linked.supervisorComment}
                    </p>
                  )}
                  {linked.status !== 'rejected' && linked.supervisorComment && (
                    <p className="mt-0.5 text-[11px] opacity-80">{linked.supervisorComment}</p>
                  )}
                </div>
              )}

              {activeBucket.status === 'draft' && (
                <CustomerFields bucket={activeBucket} onPatch={handleCustomerPatch} />
              )}

              {activeBucket.status === 'submitted' && !linked && (
                <p className="text-[11px] text-amber-700 bg-amber-50 rounded px-2 py-1">
                  Awaiting inventory review…
                </p>
              )}

              <div className="border-t border-gray-100 pt-2 space-y-1.5 max-h-56 overflow-y-auto">
                {activeBucket.lines?.length === 0 ? (
                  <p className="text-xs text-gray-400 py-0.5">No products yet.</p>
                ) : (
                  activeBucket.lines.map((line) => (
                    <div key={line._id} className="border border-gray-100 rounded px-2 py-1.5 text-xs">
                      <p className="font-medium truncate text-sm leading-tight">{line.productTitle}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {formatPaise(line.offeredRatePaise)} × {line.quantity}
                      </p>
                      {activeBucket.status === 'draft' && (
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            type="number"
                            min={1}
                            key={`${activeBucket._id}-${line._id}-qty`}
                            className="w-14 border rounded px-1 py-0.5 text-xs"
                            defaultValue={line.quantity}
                            onBlur={(e) =>
                              handleUpdateLineQty(line._id, parseInt(e.target.value, 10) || 1)
                            }
                          />
                          <button
                            type="button"
                            className="text-[11px] text-red-600"
                            onClick={() => handleRemoveLine(line._id)}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {canClone && (
                <button
                  type="button"
                  onClick={handleCloneRequest}
                  className="w-full py-1.5 border border-black text-black rounded-md text-xs font-medium hover:bg-gray-50"
                >
                  Create new request from this
                </button>
              )}

              {activeBucket.status === 'draft' && activeBucket.lines?.length > 0 && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSubmitBucket}
                  className="w-full py-1.5 bg-black text-white rounded-md text-xs font-medium disabled:opacity-50"
                >
                  {submitting ? 'Submitting…' : 'Send to inventory'}
                </button>
              )}
            </>
          )}
        </div>
      </div>

    </div>

  );

}

