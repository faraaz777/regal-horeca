'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { adminJson } from '@/lib/client/adminFetch';
import { primeSalesSessionCache, SALES_SESSION_KEY } from '@/lib/client/salesSessionCache';
import SalesCatalogBrowse from '@/components/sales/SalesCatalogBrowse';
import SalesQuotePanel from '@/components/sales/SalesQuotePanel';
import SalesConfirmDialog from '@/components/sales/SalesConfirmDialog';
import { REQUEST_STATUS_LABELS } from '@/lib/shared/salesConstants';
import { formatPaise } from '@/lib/shared/formatMoney';
import { quoteGrandTotalPaise } from '@/lib/shared/salesPricing';
import { PlusIcon } from '@/components/Icons';

const fetcher = (url) => adminJson(url);

/**
 * Tab color is status, not “active vs not”.
 * Salesman should see draft / pending / done without reading the label.
 */
function customerTabTone(bucket) {
  const status = bucket.linkedRequest?.status;
  if (status === 'rejected') {
    return { dot: 'bg-accent', label: 'Rejected', short: 'Rejected' };
  }
  if (status === 'approved' || status === 'partially_approved') {
    return {
      dot: 'bg-emerald-500',
      label: REQUEST_STATUS_LABELS[status],
      short: status === 'partially_approved' ? 'Partial' : 'Approved',
    };
  }
  if (status === 'fulfilled') {
    return { dot: 'bg-slate-400', label: 'Fulfilled', short: 'Done' };
  }
  if (status === 'cancelled') {
    return { dot: 'bg-black/30', label: 'Cancelled', short: 'Cancelled' };
  }
  if (status === 'submitted' || bucket.status === 'submitted') {
    return { dot: 'bg-amber-500', label: 'Pending review', short: 'Pending' };
  }
  return { dot: 'bg-royal-gold', label: 'Draft', short: 'Draft' };
}

function mapLinePayload(lines) {
  return lines.map((l) => ({
    productId: String(l.productId),
    quantity: l.quantity,
    offeredRatePaise: l.offeredRatePaise,
    notes: l.notes,
  }));
}

/** lg = 1024px — matches Tailwind, where the quote docks beside the catalog. */
function useDesktopQuoteLayout() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  return isDesktop;
}

export default function SalesWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusBucketParam = searchParams.get('bucket');
  const clearedFocusParam = useRef(false);

  const [activeBucketId, setActiveBucketId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [closingSession, setClosingSession] = useState(false);
  const [savingLines, setSavingLines] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  /**
   * Below lg the quote is a right drawer, not a stacked column.
   * Tablet portrait (~768px) would otherwise push the quote under the catalog.
   */
  const [quoteDrawerOpen, setQuoteDrawerOpen] = useState(false);
  const isDesktopQuote = useDesktopQuoteLayout();

  const { data: workspace, mutate: mutateWorkspace, isLoading: sessionLoading } = useSWR(
    SALES_SESSION_KEY,
    fetcher,
    { revalidateOnFocus: true, revalidateOnMount: true }
  );

  const buckets = workspace?.buckets || [];

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

  const activeBucket = buckets.find((b) => String(b._id) === String(activeBucketId)) || null;
  const quoteLineCount = activeBucket?.lines?.length || 0;
  const quoteTotalPaise = quoteGrandTotalPaise(activeBucket?.lines || []);

  useEffect(() => {
    if (!quoteDrawerOpen || isDesktopQuote) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') setQuoteDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [quoteDrawerOpen, isDesktopQuote]);

  /**
   * Pending badge must use summary counts — limit=5 undercounts real pending volume.
   */
  const { data: requestsData } = useSWR(
    '/api/sales/requests?limit=1&status=submitted',
    fetcher,
    { revalidateOnFocus: false }
  );
  const pendingCount = requestsData?.summary?.byStatus?.submitted ?? requestsData?.summary?.total ?? 0;

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
      setQuoteDrawerOpen(true);
      toast.success(`Customer ${bucket.displayNumber} added`);
      await refresh();
    } catch (e) {
      toast.error(e.message || 'Failed to add customer');
    }
  };

  const handleAddProduct = async (product, options = {}) => {
    if (!activeBucket || activeBucket.status !== 'draft') {
      toast.error('Select a draft customer bucket first');
      return;
    }
    const quantity = Math.max(1, parseInt(options.quantity, 10) || 1);
    const body = { productId: product.id, quantity };
    if (options.offeredRatePaise != null) {
      body.offeredRatePaise = options.offeredRatePaise;
    }
    try {
      await adminJson(`/api/sales/buckets/${activeBucket._id}/lines`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      toast.success(`Added ${product.title}${quantity > 1 ? ` × ${quantity}` : ''}`);
      await refresh();
    } catch (e) {
      toast.error(e.message || 'Failed to add product');
    }
  };

  const putLines = async (nextLines) => {
    if (!activeBucket) return;
    setSavingLines(true);
    try {
      await adminJson(`/api/sales/buckets/${activeBucket._id}/lines`, {
        method: 'PUT',
        body: JSON.stringify({ lines: mapLinePayload(nextLines) }),
      });
      await refresh();
    } catch (e) {
      toast.error(e.message || 'Update failed');
      await refresh();
    } finally {
      setSavingLines(false);
    }
  };

  const handleUpdateLineQty = async (lineId, quantity) => {
    if (!activeBucket || quantity < 1) return;
    const optimistic = activeBucket.lines.map((l) =>
      String(l._id) === String(lineId) ? { ...l, quantity } : l
    );
    mutateWorkspace(
      { ...workspace, buckets: buckets.map((b) => (String(b._id) === String(activeBucket._id) ? { ...b, lines: optimistic } : b)) },
      { revalidate: false }
    );
    await putLines(optimistic);
  };

  const handleUpdateLineRate = async (lineId, offeredRatePaise) => {
    if (!activeBucket) return;
    const optimistic = activeBucket.lines.map((l) =>
      String(l._id) === String(lineId) ? { ...l, offeredRatePaise } : l
    );
    mutateWorkspace(
      { ...workspace, buckets: buckets.map((b) => (String(b._id) === String(activeBucket._id) ? { ...b, lines: optimistic } : b)) },
      { revalidate: false }
    );
    await putLines(optimistic);
  };

  const handleRemoveLine = async (lineId) => {
    if (!activeBucket) return;
    const next = activeBucket.lines.filter((l) => String(l._id) !== String(lineId));
    mutateWorkspace(
      { ...workspace, buckets: buckets.map((b) => (String(b._id) === String(activeBucket._id) ? { ...b, lines: next } : b)) },
      { revalidate: false }
    );
    await putLines(next);
  };

  const handleSubmitBucket = () => {
    if (!activeBucket) return;
    setConfirmDialog({
      type: 'submit',
      title: 'Send to inventory?',
      message:
        'This quote will be submitted as a stock request. Inventory will review quantities and approve or reject.',
      confirmLabel: 'Send to inventory',
    });
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

  const handleDiscardQuote = () => {
    if (!activeBucket || activeBucket.status !== 'draft') return;
    const count = activeBucket.lines?.length || 0;
    if (count === 0) return;
    setConfirmDialog({
      type: 'discardQuote',
      title: 'Discard quote?',
      message: `Remove all ${count} product${count === 1 ? '' : 's'} from this quote? Customer details will stay on this tab.`,
      confirmLabel: 'Discard quote',
      confirmTone: 'danger',
    });
  };

  const handleCloseTab = () => {
    if (!activeBucket) return;
    const isDraft = activeBucket.status === 'draft';
    if (isDraft && activeBucket.lines?.length > 0) {
      setConfirmDialog({
        type: 'info',
        title: 'Clear products first',
        message:
          'Draft tabs with products cannot be closed. Remove all lines or send the quote to inventory, then close the tab.',
        confirmLabel: 'Got it',
        confirmTone: 'primary',
      });
      return;
    }
    setConfirmDialog({
      type: 'closeTab',
      title: isDraft ? 'Close this customer tab?' : 'Remove from workspace?',
      message: isDraft
        ? 'This empty draft tab will be removed from your workspace.'
        : 'History stays in My requests. You can clone a past request into a new draft later.',
      confirmLabel: 'Close tab',
      confirmTone: 'danger',
    });
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

  const handleEndSession = () => {
    setConfirmDialog({
      type: 'endSession',
      title: 'End this shift?',
      message:
        'Ends your sales session marker. Open customer tabs stay until you close them. Request history is kept.',
      confirmLabel: 'End shift',
    });
  };

  const runConfirm = async () => {
    if (!confirmDialog) return;
    const { type } = confirmDialog;

    if (type === 'info') {
      setConfirmDialog(null);
      return;
    }

    if (type === 'submit') {
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
        setConfirmDialog(null);
        await refresh();
      } catch (e) {
        toast.error(e.message || 'Submit failed');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (type === 'closeTab') {
      try {
        const result = await adminJson(`/api/sales/buckets/${activeBucket._id}/complete`, {
          method: 'POST',
        });
        toast.success(result.removed ? 'Tab closed' : 'Customer marked done');
        setActiveBucketId(null);
        setConfirmDialog(null);
        await mutateWorkspace();
      } catch (e) {
        toast.error(e.message || 'Could not close tab');
      }
      return;
    }

    if (type === 'discardQuote') {
      const next = [];
      mutateWorkspace(
        {
          ...workspace,
          buckets: buckets.map((b) =>
            String(b._id) === String(activeBucket._id) ? { ...b, lines: next } : b
          ),
        },
        { revalidate: false }
      );
      setConfirmDialog(null);
      try {
        await putLines(next);
        toast.success('Quote discarded');
      } catch (e) {
        toast.error(e.message || 'Could not discard quote');
      }
      return;
    }

    if (type === 'endSession') {
      setClosingSession(true);
      try {
        await adminJson('/api/sales/session', { method: 'DELETE' });
        toast.success('Shift ended');
        setActiveBucketId(null);
        setConfirmDialog(null);
        await mutateWorkspace();
      } catch (e) {
        toast.error(e.message || 'Could not end session');
      } finally {
        setClosingSession(false);
      }
    }
  };

  const linked = activeBucket?.linkedRequest;
  const canClone =
    activeBucket?.status === 'submitted' &&
    linked &&
    ['rejected', 'approved', 'partially_approved', 'fulfilled', 'cancelled'].includes(linked.status);

  return (
    <div className="-mx-1 px-1 space-y-6 lg:space-y-0 lg:gap-4 min-h-[calc(100vh-8rem)] lg:min-h-0 lg:h-[calc(100dvh-4rem)] lg:flex lg:flex-col lg:overflow-hidden touch-manipulation">
      <div className="flex flex-wrap items-start justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-semibold text-rich-black tracking-tight">Sales floor</h1>
          <p className="text-sm text-black/50 mt-1.5 max-w-xl leading-relaxed">
            Add a customer, build a quote from the catalog, negotiate rates within max discount, then
            send to inventory.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {pendingCount > 0 && (
            <Link
              href="/admin/sales/requests?status=submitted"
              className="inline-flex items-center min-h-[44px] lg:min-h-0 text-sm px-4 py-2 lg:px-3 lg:py-1.5 rounded-full bg-amber-50 text-amber-900 font-medium"
            >
              {pendingCount} pending
            </Link>
          )}
          <Link
            href="/admin/sales/requests"
            className="inline-flex items-center min-h-[44px] lg:min-h-0 text-sm px-4 py-2 lg:px-3 lg:py-1.5 rounded-full border border-black/15 text-rich-black hover:border-rich-black transition-colors"
          >
            My requests
          </Link>
          <Link
            href="/admin/sales/collections"
            className="inline-flex items-center min-h-[44px] lg:min-h-0 text-sm px-4 py-2 lg:px-3 lg:py-1.5 rounded-full border border-black/15 text-rich-black hover:border-rich-black transition-colors"
          >
            Collections
          </Link>
          <button
            type="button"
            disabled={closingSession}
            onClick={handleEndSession}
            className="inline-flex items-center min-h-[44px] lg:min-h-0 text-sm px-4 py-2 lg:px-3 lg:py-1.5 rounded-full text-accent/70 hover:text-accent hover:bg-accent/10 disabled:opacity-50 transition-colors"
          >
            {closingSession ? 'Ending…' : 'End shift'}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1 -mx-1 px-1 shrink-0">
        <div className="inline-flex items-center gap-2.5 p-1 lg:p-1 bg-black/[0.04] rounded-full min-w-min">
          {sessionLoading && buckets.length === 0 ? (
            <span className="text-sm text-black/40 shrink-0 px-4 py-2">Loading session…</span>
          ) : (
            buckets.map((b) => {
              const isActive = String(b._id) === String(activeBucket?._id);
              const name = b.customerName || `Customer ${b.displayNumber}`;
              const lineCount = b.lines?.length || 0;
              const tone = customerTabTone(b);
              return (
                <div
                  key={b._id}
                  className={`shrink-0 inline-flex items-center rounded-full pl-3.5 pr-1.5 min-h-[44px] lg:min-h-0 py-1 transition-all ${
                    isActive
                      ? 'bg-white text-rich-black shadow-sm ring-1 ring-black/10'
                      : 'text-black/55 hover:text-rich-black hover:bg-white/70'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveBucketId(b._id);
                      if (!isDesktopQuote) setQuoteDrawerOpen(true);
                    }}
                    title={tone.label}
                    className="inline-flex items-center gap-2 min-w-0 min-h-[40px] lg:min-h-0 py-1"
                  >
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${tone.dot}`} aria-hidden />
                    <span className="max-w-[8.5rem] truncate text-sm font-medium">{name}</span>
                    {lineCount > 0 && (
                      <span
                        className={`min-w-[1.25rem] h-[1.25rem] px-1 rounded-full text-[10px] font-semibold tabular-nums leading-[1.25rem] text-center ${
                          isActive ? 'bg-rich-black text-white' : 'bg-black/10 text-black/55'
                        }`}
                      >
                        {lineCount}
                      </span>
                    )}
                    {isActive && (
                      <span className="text-[10px] font-medium tracking-wide text-black/45">
                        {tone.short}
                      </span>
                    )}
                  </button>
                  {isActive && (
                    <button
                      type="button"
                      onClick={handleCloseTab}
                      className="ml-1 h-9 w-9 lg:h-6 lg:w-6 rounded-full text-black/35 hover:text-rich-black hover:bg-black/5 text-lg lg:text-sm leading-none"
                      title="Close tab"
                      aria-label="Close tab"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })
          )}
          <button
            type="button"
            onClick={handleAddCustomer}
            className="shrink-0 h-11 w-11 lg:h-10 lg:w-10 rounded-full bg-rich-black text-white flex items-center justify-center hover:opacity-90 transition-opacity shadow-sm"
            title="Add customer"
            aria-label="Add customer"
          >
            <PlusIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {!sessionLoading && buckets.length === 0 && (
        <div className="bg-white px-6 sm:px-8 py-14 text-center space-y-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/35">
            Get started
          </p>
          <h2 className="text-2xl font-semibold text-rich-black">Start your first quote</h2>
          <ol className="text-sm text-black/50 max-w-md mx-auto text-left space-y-2 list-decimal list-inside leading-relaxed">
            <li>Add a customer tab</li>
            <li>Search the catalog and add products (set qty as you add)</li>
            <li>Adjust offer rates within the allowed discount</li>
            <li>Send the quote to inventory for stock approval</li>
          </ol>
          <button
            type="button"
            onClick={handleAddCustomer}
            className="inline-flex mt-2 min-h-[48px] px-8 py-3 bg-rich-black text-white text-base font-semibold hover:opacity-90 transition-opacity"
          >
            + Add customer
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start lg:flex-1 lg:min-h-0 lg:overflow-hidden">
        <div className="flex-1 min-w-0 w-full max-md:pb-24 lg:h-full lg:min-h-0 lg:overflow-hidden">
          <SalesCatalogBrowse activeBucket={activeBucket} onAddProduct={handleAddProduct} />
        </div>

        {quoteDrawerOpen && !isDesktopQuote ? (
          <button
            type="button"
            aria-label="Close quote"
            className="lg:hidden fixed inset-0 z-40 bg-black/40"
            onClick={() => setQuoteDrawerOpen(false)}
          />
        ) : null}

        {!quoteDrawerOpen && !isDesktopQuote ? (
          <button
            type="button"
            onClick={() => setQuoteDrawerOpen(true)}
            className="lg:hidden fixed z-30 right-0 flex items-center gap-3 bg-rich-black text-white shadow-lg rounded-l-2xl pl-4 pr-3.5 py-3.5 min-h-[3.5rem] bottom-[max(1rem,env(safe-area-inset-bottom))] md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:flex-col md:items-center md:gap-2 md:rounded-l-2xl md:py-6 md:px-3.5 md:min-h-[9rem]"
            aria-label="Open quote"
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
              Quote
            </span>
            <span className="text-sm font-semibold tabular-nums">
              {quoteLineCount} {quoteLineCount === 1 ? 'item' : 'items'}
            </span>
            {quoteLineCount > 0 ? (
              <span className="text-sm font-semibold tabular-nums">{formatPaise(quoteTotalPaise)}</span>
            ) : null}
          </button>
        ) : null}

        <div
          className={`max-lg:fixed max-lg:inset-y-0 max-lg:right-0 max-lg:z-50 max-lg:w-[min(100vw,26rem)] max-lg:h-[100dvh] max-lg:flex max-lg:flex-col max-lg:shadow-2xl max-lg:transition-transform max-lg:duration-300 max-lg:ease-out lg:static lg:shadow-none lg:h-full lg:min-h-0 lg:flex lg:flex-col min-w-0 ${
            quoteDrawerOpen || isDesktopQuote
              ? 'max-lg:translate-x-0'
              : 'max-lg:translate-x-full max-lg:pointer-events-none'
          }`}
          inert={!isDesktopQuote && !quoteDrawerOpen ? '' : undefined}
        >
          <SalesQuotePanel
            activeBucket={activeBucket}
            linked={linked}
            canClone={canClone}
            submitting={submitting}
            savingLines={savingLines}
            onCloseTab={handleCloseTab}
            onDiscardQuote={handleDiscardQuote}
            onCustomerPatch={handleCustomerPatch}
            onUpdateQty={handleUpdateLineQty}
            onUpdateRate={handleUpdateLineRate}
            onRemoveLine={handleRemoveLine}
            onSubmit={handleSubmitBucket}
            onClone={handleCloneRequest}
            onHidePanel={isDesktopQuote ? undefined : () => setQuoteDrawerOpen(false)}
          />
        </div>
      </div>

      <SalesConfirmDialog
        open={Boolean(confirmDialog)}
        title={confirmDialog?.title}
        message={confirmDialog?.message}
        confirmLabel={confirmDialog?.confirmLabel}
        confirmTone={confirmDialog?.confirmTone || 'primary'}
        cancelLabel={confirmDialog?.type === 'info' ? null : 'Cancel'}
        busy={submitting || closingSession || savingLines}
        onCancel={() => setConfirmDialog(null)}
        onConfirm={runConfirm}
      />
    </div>
  );
}
