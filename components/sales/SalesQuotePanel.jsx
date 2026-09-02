'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { adminJson } from '@/lib/client/adminFetch';
import { formatPaise } from '@/lib/shared/formatMoney';
import {
  OFFER_BELOW_RANGE_ERROR,
  paiseToRupeesString,
  rupeesStringToPaise,
  lineTotalPaise,
  quoteGrandTotalPaise,
} from '@/lib/shared/salesPricing';
import { REQUEST_STATUS_LABELS } from '@/lib/shared/salesConstants';
import { ChevronDownIcon } from '@/components/Icons';

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

/** New tabs stay open so the salesman can name the walk-in.
 * Collapse only after the first product lands on this tab. */
function shouldDefaultCustomerFieldsOpen(bucket) {
  return (bucket?.lines || []).length === 0;
}

function CustomerFields({ bucket, onPatch }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimer = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    setName(bucket.customerName || '');
    setPhone(bucket.phone || '');
    setEmail(bucket.email || '');
    setNotes(bucket.notes || '');
    setSuggestions([]);
    setShowSuggestions(false);
  }, [bucket._id, bucket.customerName, bucket.phone, bucket.email, bucket.notes]);

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
    const displayName = customer.name || customer.companyName || '';
    setName(displayName);
    setPhone(customer.phone);
    setEmail(customer.email || '');
    setShowSuggestions(false);
    setSuggestions([]);
    try {
      await onPatch({
        customerName: displayName,
        phone: customer.phone || '',
        email: customer.email || '',
      });
    } catch {
      /* onPatch handles toast */
    }
  };

  const inputClass =
    'w-full border-0 border-b border-black/10 bg-transparent px-0 py-3 lg:py-2 text-base lg:text-sm placeholder:text-black/30 focus:outline-none focus:border-rich-black transition-colors';

  return (
    <div className="space-y-3" ref={wrapperRef}>
      <div className="relative space-y-3">
        <input
          className={inputClass}
          placeholder="Search customer (name, phone, company)"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            searchCustomers(e.target.value);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setShowSuggestions(true);
          }}
          onBlur={() => {
            setTimeout(() => {
              if (name !== (bucket.customerName || '')) onPatch({ customerName: name });
            }, 150);
          }}
        />
        <input
          className={inputClass}
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
              if (phone !== (bucket.phone || '')) onPatch({ phone });
            }, 150);
          }}
        />
        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute z-20 left-0 right-0 top-full mt-1 bg-white shadow-lg max-h-48 overflow-y-auto">
            {suggestions.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="w-full text-left px-3 py-3.5 lg:py-2.5 text-sm hover:bg-warm-white border-b border-black/5 last:border-0 min-h-[44px] lg:min-h-0"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectCustomer(c);
                  }}
                >
                  <span className="font-medium text-rich-black">
                    {c.name || c.companyName || c.phone || 'Lead'}
                  </span>
                  {c.companyName && c.name ? (
                    <span className="text-black/40 ml-2">{c.companyName}</span>
                  ) : null}
                  {c.phone ? <span className="text-black/40 ml-2">{c.phone}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <input
        type="email"
        className={inputClass}
        placeholder="Email (optional)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onBlur={() => {
          if (email !== (bucket.email || '')) onPatch({ email });
        }}
      />
      <textarea
        className={`${inputClass} resize-none`}
        placeholder="Notes (optional)"
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => {
          if (notes !== (bucket.notes || '')) onPatch({ notes });
        }}
      />
    </div>
  );
}

/**
 * Hairline position cue for the quote list.
 * Native scrollbars are hidden; this shows where you are and how many
 * lines still sit below the fold — without looking like a Windows scrollbar.
 */
function QuoteListHint({ scrollRef, lineCount }) {
  const [hint, setHint] = useState({
    overflow: false,
    thumbTopPct: 0,
    thumbHeightPct: 20,
    remainingBelow: 0,
    atTop: true,
    atBottom: true,
  });

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const overflow = scrollHeight > clientHeight + 4;
    const maxScroll = Math.max(1, scrollHeight - clientHeight);
    const thumbHeightPct = overflow ? Math.max(14, (clientHeight / scrollHeight) * 100) : 100;
    const thumbTopPct = overflow ? (scrollTop / maxScroll) * (100 - thumbHeightPct) : 0;
    const atTop = scrollTop < 6;
    const atBottom = scrollTop + clientHeight >= scrollHeight - 6;
    const box = el.getBoundingClientRect();
    let remainingBelow = 0;
    if (overflow && !atBottom) {
      for (const child of el.children) {
        if (child.getBoundingClientRect().top > box.bottom - 6) remainingBelow += 1;
      }
    }
    setHint({ overflow, thumbTopPct, thumbHeightPct, remainingBelow, atTop, atBottom });
  }, [scrollRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', measure);
      ro.disconnect();
    };
  }, [measure, lineCount]);

  if (lineCount < 2) return null;

  return (
    <div
      className="pointer-events-none absolute top-1 bottom-1 -right-2 lg:-right-3 w-3 flex flex-col items-center"
      aria-hidden
    >
      <span
        className={`block h-1 w-1 rounded-full shrink-0 mb-1 transition-colors ${
          hint.atTop ? 'bg-rich-black/50' : 'bg-black/15'
        }`}
      />
      <div className="relative flex-1 w-px min-h-[2rem] bg-black/[0.08]">
        {hint.overflow ? (
          <span
            className="absolute left-1/2 -translate-x-1/2 w-0.5 rounded-full bg-rich-black/40"
            style={{ top: `${hint.thumbTopPct}%`, height: `${hint.thumbHeightPct}%` }}
          />
        ) : null}
      </div>
      <span
        className={`block h-1 w-1 rounded-full shrink-0 mt-1 transition-colors ${
          hint.atBottom ? 'bg-rich-black/50' : 'bg-black/15'
        }`}
      />
      {hint.remainingBelow > 0 ? (
        <span className="mt-1 text-[8px] font-semibold tabular-nums leading-none text-black/40">
          +{hint.remainingBelow}
        </span>
      ) : null}
    </div>
  );
}

function QuoteLineRow({ line, isDraft, saving, onUpdateQty, onUpdateRate, onRemove, flash }) {
  const [qty, setQty] = useState(line.quantity);
  const [rateStr, setRateStr] = useState(paiseToRupeesString(line.offeredRatePaise));
  const [rateError, setRateError] = useState('');
  const qtyTimer = useRef(null);
  const rowRef = useRef(null);

  useEffect(() => {
    setQty(line.quantity);
  }, [line.quantity, line._id]);

  useEffect(() => {
    setRateStr(paiseToRupeesString(line.offeredRatePaise));
    setRateError('');
  }, [line.offeredRatePaise, line._id]);

  useEffect(() => {
    if (!flash || !rowRef.current) return undefined;
    rowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    return undefined;
  }, [flash]);

  const canNegotiate = Number(line.negotiablePercent) > 0 && line.listPricePaise > 0;
  const discountPct =
    line.listPricePaise > 0 && line.offeredRatePaise < line.listPricePaise
      ? Math.round((1 - line.offeredRatePaise / line.listPricePaise) * 1000) / 10
      : 0;

  const commitQty = useCallback(
    (next) => {
      const n = Math.max(1, parseInt(next, 10) || 1);
      setQty(n);
      if (n !== line.quantity) onUpdateQty(line._id, n);
    },
    [line._id, line.quantity, onUpdateQty]
  );

  const scheduleQty = (next) => {
    setQty(next);
    if (qtyTimer.current) clearTimeout(qtyTimer.current);
    qtyTimer.current = setTimeout(() => commitQty(next), 400);
  };

  const commitRate = () => {
    const paise = rupeesStringToPaise(rateStr);
    if (paise == null) {
      setRateError('Enter a valid amount');
      setRateStr(paiseToRupeesString(line.offeredRatePaise));
      return;
    }
    const list = Number(line.listPricePaise) || 0;
    const range = Number(line.negotiablePercent) || 0;
    const approxMin =
      list > 0 && range > 0 ? Math.ceil(list * (1 - range / 100)) : list;
    if (list > 0 && paise < approxMin) {
      setRateError(OFFER_BELOW_RANGE_ERROR);
      setRateStr(paiseToRupeesString(line.offeredRatePaise));
      return;
    }
    setRateError('');
    if (paise !== line.offeredRatePaise) onUpdateRate(line._id, paise);
  };

  return (
    <div
      ref={rowRef}
      className={`border-b border-black/5 py-2.5 last:border-b-0 transition-colors duration-500 ${
        flash ? 'bg-royal-gold/10' : ''
      }`}
    >
      <div className="flex gap-2.5">
        <div className="shrink-0 w-9 h-9 lg:w-10 lg:h-10 bg-white border border-black/[0.06] rounded-sm overflow-hidden">
          {line.heroImage ? (
            <img src={line.heroImage} alt="" className="w-full h-full object-contain p-0.5" />
          ) : (
            <div className="w-full h-full bg-black/[0.03]" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-[13px] text-rich-black leading-snug truncate min-w-0">
              {line.productTitle}
            </p>
            <p className="text-[13px] font-semibold text-rich-black tabular-nums shrink-0">
              {formatPaise(lineTotalPaise(line))}
            </p>
          </div>

          {isDraft ? (
            <div className="mt-1.5 space-y-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="inline-flex items-center bg-warm-white overflow-hidden shrink-0">
                  <button
                    type="button"
                    disabled={saving || qty <= 1}
                    className="h-8 w-8 lg:h-7 lg:w-7 text-sm text-rich-black hover:bg-black/5 disabled:opacity-40"
                    onClick={() => commitQty(qty - 1)}
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    className="w-8 bg-transparent h-8 lg:h-7 text-xs text-center tabular-nums focus:outline-none"
                    value={qty}
                    disabled={saving}
                    onChange={(e) => scheduleQty(e.target.value)}
                    onBlur={() => commitQty(qty)}
                  />
                  <button
                    type="button"
                    disabled={saving}
                    className="h-8 w-8 lg:h-7 lg:w-7 text-sm text-rich-black hover:bg-black/5 disabled:opacity-40"
                    onClick={() => commitQty(qty + 1)}
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
                <div className="flex-1 flex items-center gap-1 min-w-0 border-b border-black/10 focus-within:border-rich-black">
                  <span className="text-[10px] uppercase tracking-wider text-black/35 shrink-0">
                    Offer
                  </span>
                  <span className="text-[11px] text-black/35">₹</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    className={`flex-1 min-w-0 bg-transparent py-1 text-xs tabular-nums focus:outline-none ${
                      rateError ? 'text-accent' : 'text-rich-black'
                    }`}
                    value={rateStr}
                    disabled={saving}
                    onChange={(e) => {
                      setRateStr(e.target.value);
                      setRateError('');
                    }}
                    onBlur={commitRate}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur();
                      }
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="shrink-0 h-8 w-8 lg:h-7 lg:w-7 text-base leading-none text-accent/70 hover:text-accent hover:bg-accent/5"
                  disabled={saving}
                  onClick={() => onRemove(line._id)}
                  aria-label="Remove item"
                  title="Remove"
                >
                  ×
                </button>
              </div>
              {(line.listPricePaise > 0 || rateError) && (
                <p className="text-[11px] text-black/40 truncate">
                  {rateError ? (
                    <span className="text-accent">{rateError}</span>
                  ) : discountPct > 0 ? (
                    <>
                      List <span className="line-through">{formatPaise(line.listPricePaise)}</span>
                      <span className="text-accent font-medium"> · {discountPct}% off</span>
                      {canNegotiate && <> · up to {line.negotiablePercent}%</>}
                    </>
                  ) : (
                    <>
                      List {formatPaise(line.listPricePaise)}
                      {canNegotiate && <> · up to {line.negotiablePercent}%</>}
                    </>
                  )}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-1 text-[11px] text-black/45 tabular-nums">
              {formatPaise(line.offeredRatePaise)} × {line.quantity}
              {line.listPricePaise > 0 && line.offeredRatePaise !== line.listPricePaise && (
                <>
                  {' '}
                  · List {formatPaise(line.listPricePaise)}
                  {discountPct > 0 && (
                    <span className="text-accent"> · {discountPct}% off</span>
                  )}
                </>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Quote panel for the active customer bucket.
 *
 * Desktop (lg+): sticky sidebar beside the catalog.
 * Phone/tablet: filled by the parent as a right-edge drawer so the catalog
 * stays full-width and the quote never drops under the product grid.
 */
export default function SalesQuotePanel({
  activeBucket,
  linked,
  canClone,
  submitting,
  savingLines,
  onCloseTab,
  onDiscardQuote,
  onCustomerPatch,
  onUpdateQty,
  onUpdateRate,
  onRemoveLine,
  onSubmit,
  onClone,
  onHidePanel,
}) {
  const isDraft = activeBucket?.status === 'draft';
  const lines = activeBucket?.lines || [];
  const grandTotal = quoteGrandTotalPaise(lines);
  const [customerFieldsOpen, setCustomerFieldsOpen] = useState(true);
  const [flashLineId, setFlashLineId] = useState(null);
  const lineCountRef = useRef(0);
  const bucketIdRef = useRef(null);
  const lineIdsRef = useRef([]);
  const listScrollRef = useRef(null);

  useEffect(() => {
    if (!activeBucket) return;
    const id = String(activeBucket._id);
    const count = activeBucket.lines?.length || 0;
    if (bucketIdRef.current !== id) {
      bucketIdRef.current = id;
      lineCountRef.current = count;
      setCustomerFieldsOpen(shouldDefaultCustomerFieldsOpen(activeBucket));
      lineIdsRef.current = (activeBucket.lines || []).map((l) => String(l._id));
      return;
    }
    if (lineCountRef.current === 0 && count > 0) {
      setCustomerFieldsOpen(false);
    }
    lineCountRef.current = count;
  }, [activeBucket?._id, activeBucket?.lines?.length]);

  useEffect(() => {
    if (!activeBucket) return;
    const ids = (activeBucket.lines || []).map((l) => String(l._id));
    const added = ids.find((lineId) => !lineIdsRef.current.includes(lineId));
    lineIdsRef.current = ids;
    if (!added) return undefined;
    setFlashLineId(added);
    const t = setTimeout(() => setFlashLineId(null), 900);
    return () => clearTimeout(t);
  }, [activeBucket?._id, activeBucket?.lines]);

  return (
    <div className="w-full h-full lg:w-80 xl:w-[21rem] shrink-0 bg-white p-5 lg:pl-4 lg:pr-5 lg:pt-4 lg:pb-4 flex flex-col gap-4 lg:gap-3 lg:h-full shadow-sm overflow-x-visible overflow-y-hidden">
      {onHidePanel ? (
        <button
          type="button"
          onClick={onHidePanel}
          className="lg:hidden shrink-0 min-h-[44px] -mt-1 -mx-1 px-3 rounded-lg text-sm font-semibold text-rich-black hover:bg-black/[0.04] text-left"
        >
          ← Back to catalog
        </button>
      ) : null}

      {!activeBucket ? (
        <div className="py-8 text-center space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/35">
            Quote
          </p>
          <p className="text-sm font-medium text-rich-black">No customer selected</p>
          <p className="text-xs text-black/45 leading-relaxed px-2">
            Tap <span className="font-semibold text-rich-black">+ Add customer</span> to open a
            quote, then browse the catalog and add products.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2 shrink-0">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/35">
                Quote
              </p>
              <h2 className="text-xl font-semibold text-rich-black leading-tight mt-1">
                {activeBucket.customerName || `Customer ${activeBucket.displayNumber}`}
              </h2>
              <p className="text-xs text-black/40 mt-1">
                Tab #{activeBucket.displayNumber}
                {isDraft ? ' · Draft' : ''}
              </p>
              {linked && (
                <p className="text-[11px] text-black/40 mt-0.5 truncate">
                  {linked.requestNumber}
                  {linked.reviewedByName ? ` · ${linked.reviewedByName}` : ''}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onCloseTab}
              className="text-[10px] uppercase tracking-wider text-black/40 hover:text-rich-black shrink-0 min-h-[44px] lg:min-h-0 px-2 lg:px-1 lg:py-1"
              title="Remove from workspace"
            >
              Close
            </button>
          </div>

          {linked && (
            <div className={`px-2.5 py-2 text-xs ${requestStatusClass(linked.status)}`}>
              <p className="font-medium leading-snug">
                {REQUEST_STATUS_LABELS[linked.status] || linked.status}
              </p>
              {linked.supervisorComment && (
                <p className="mt-0.5 text-[11px]">
                  {linked.status === 'rejected' && (
                    <span className="font-medium">Reason: </span>
                  )}
                  {linked.supervisorComment}
                </p>
              )}
            </div>
          )}

          {isDraft && (
            <div className="shrink-0">
              <div
                className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                  customerFieldsOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                }`}
              >
                <div
                  className={`min-h-0 ${
                    customerFieldsOpen ? 'overflow-visible' : 'overflow-hidden'
                  }`}
                >
                  <div className="pb-2">
                    <CustomerFields bucket={activeBucket} onPatch={onCustomerPatch} />
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCustomerFieldsOpen((v) => !v)}
                className="w-full flex items-center gap-2 min-h-[44px] lg:min-h-0 py-2 lg:py-1.5 group"
                aria-expanded={customerFieldsOpen}
                aria-label={
                  customerFieldsOpen ? 'Hide customer details' : 'Show customer details'
                }
              >
                <span className="flex-1 h-px bg-black/10 group-hover:bg-black/20" />
                <span className="flex h-10 w-10 lg:h-7 lg:w-7 shrink-0 items-center justify-center rounded-full border border-black/15 bg-white text-black/45 group-hover:border-black/30 group-hover:text-rich-black">
                  <ChevronDownIcon
                    className={`w-4 h-4 lg:w-3.5 lg:h-3.5 transition-transform duration-300 ${
                      customerFieldsOpen ? 'rotate-180' : ''
                    }`}
                  />
                </span>
                <span className="flex-1 h-px bg-black/10 group-hover:bg-black/20" />
              </button>
            </div>
          )}

          {isDraft && lines.length > 0 && (
            <button
              type="button"
              onClick={onDiscardQuote}
              disabled={savingLines}
              className="shrink-0 w-full min-h-[44px] lg:min-h-0 py-2.5 lg:py-2 text-xs uppercase tracking-wider text-accent/80 hover:text-accent border border-accent/20 hover:border-accent/40 transition-colors disabled:opacity-50"
            >
              Discard quote ({lines.length} {lines.length === 1 ? 'item' : 'items'})
            </button>
          )}

          {activeBucket.status === 'submitted' && !linked && (
            <p className="shrink-0 text-[11px] text-amber-800 bg-amber-50 px-2.5 py-1.5">
              Awaiting inventory review…
            </p>
          )}

          <div className="relative flex-1 min-h-0">
            <div
              ref={listScrollRef}
              className="h-full overflow-y-auto overscroll-contain quote-scrollbar border-t border-black/5 pt-1 pr-1"
            >
              {lines.length === 0 ? (
                <p className="text-sm text-black/35 py-6 text-center">
                  No products yet — add from the catalog.
                </p>
              ) : (
                lines.map((line) => (
                  <QuoteLineRow
                    key={line._id}
                    line={line}
                    isDraft={isDraft}
                    saving={savingLines}
                    flash={String(line._id) === String(flashLineId)}
                    onUpdateQty={onUpdateQty}
                    onUpdateRate={onUpdateRate}
                    onRemove={onRemoveLine}
                  />
                ))
              )}
            </div>
            {lines.length > 0 ? (
              <>
                <div className="pointer-events-none absolute inset-x-0 top-0 h-3 bg-gradient-to-b from-white to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-white to-transparent" />
                <QuoteListHint scrollRef={listScrollRef} lineCount={lines.length} />
              </>
            ) : null}
          </div>

          <div className="shrink-0 space-y-3 pt-1">
            {lines.length > 0 && (
              <div className="border-t border-black/10 pt-4 flex items-baseline justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/40">
                  Total
                </span>
                <span className="text-2xl font-semibold text-rich-black tabular-nums">
                  {formatPaise(grandTotal)}
                </span>
              </div>
            )}

            {canClone && (
              <button
                type="button"
                onClick={onClone}
                className="w-full min-h-[48px] lg:min-h-0 py-3 lg:py-2.5 border border-rich-black text-rich-black text-sm font-semibold hover:bg-warm-white transition-colors"
              >
                Create new request from this
              </button>
            )}

            {isDraft && lines.length > 0 && (
              <button
                type="button"
                disabled={submitting || savingLines}
                onClick={onSubmit}
                className="w-full min-h-[48px] lg:min-h-0 py-3 lg:py-2.5 bg-rich-black text-white text-base lg:text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {submitting ? 'Submitting…' : 'Send to inventory'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
