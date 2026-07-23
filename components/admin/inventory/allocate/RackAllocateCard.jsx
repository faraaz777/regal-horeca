'use client';

import { useEffect, useState } from 'react';
import { formatRackDisplayName } from '@/lib/shared/locationDisplay';
import {
  locationRackCode,
  locationRackName,
} from '@/lib/client/inventory/locationLabels';

/**
 * Rack tile — allocate ±; stored stock from Stock snapshot + Active/Empty footer.
 */
export default function RackAllocateCard({
  rack,
  floor,
  branchCode,
  branchName,
  allocatedQty,
  rowMax,
  currentStock,
  stockUnit = 'pcs',
  onQtyChange,
  disabled,
}) {
  const code = locationRackCode(rack) || formatRackDisplayName(rack);
  const name = locationRackName(rack);
  const title = name || code;
  const showCodeBadge = Boolean(code);
  const qty = Number(allocatedQty) || 0;
  const hasStoredStock = currentStock > 0;

  const branchLabel = branchCode || branchName || '';
  const floorLabel = floor?.code || floor?.name || '';
  const softPath = [branchLabel, floorLabel].filter(Boolean).join(' > ');

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(qty));

  useEffect(() => {
    if (!editing) setDraft(String(qty));
  }, [qty, editing]);

  const clampQty = (n) => {
    let next = Math.max(0, n);
    if (rowMax != null && rowMax >= 0) next = Math.min(rowMax, next);
    return next;
  };

  const canDecrease = qty > 0 && !disabled;
  const canIncrease = (rowMax == null || qty < rowMax) && !disabled;

  /**
   * Selected = qty > 0. Stronger wash + glow so the rack stands out
   * without adding a "Selected" label.
   */
  const borderTone =
    qty > 0
      ? 'border-2 border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-400/50 shadow-md shadow-emerald-500/25'
      : 'border border-gray-200 bg-white shadow-sm';

  const commitDraft = () => {
    const parsed = parseInt(draft, 10);
    onQtyChange(clampQty(Number.isNaN(parsed) ? 0 : parsed));
    setEditing(false);
  };

  return (
    <div
      className={`rounded-xl px-2.5 py-2 flex flex-col gap-1.5 min-w-0 transition-[box-shadow,background-color,border-color] duration-150 ${borderTone}`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-[13px] font-semibold text-gray-900 truncate leading-tight">
            {title}
          </p>
          {showCodeBadge ? (
            <span className="shrink-0 inline-flex px-1.5 py-0.5 rounded-full bg-sky-50 text-[10px] font-bold font-mono text-sky-700">
              {code}
            </span>
          ) : null}
        </div>
        {softPath ? (
          <p className="text-[10px] text-gray-400 truncate mt-0.5 leading-tight" title={softPath}>
            {softPath}
          </p>
        ) : null}
      </div>

      <div
        className={`w-full flex items-center justify-between gap-1 rounded-lg bg-gray-50 border border-gray-100 p-1 ${
          disabled ? 'opacity-40 pointer-events-none' : ''
        }`}
        title="Place opening units on this rack"
      >
        <button
          type="button"
          disabled={!canDecrease}
          onClick={() => onQtyChange(clampQty(qty - 1))}
          className="h-7 w-7 shrink-0 rounded-md border border-gray-200 bg-white text-gray-700 text-sm font-semibold hover:bg-gray-100 disabled:opacity-30"
          aria-label="Decrease allocate qty"
        >
          −
        </button>
        {editing ? (
          <input
            autoFocus
            type="text"
            inputMode="numeric"
            className="flex-1 min-w-0 h-7 mx-1 text-center text-sm font-bold font-mono tabular-nums border border-emerald-300 rounded-md bg-white outline-none"
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitDraft();
              }
              if (e.key === 'Escape') {
                setDraft(String(qty));
                setEditing(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(String(qty));
              setEditing(true);
            }}
            className="flex-1 min-w-0 h-7 text-center text-sm font-bold font-mono tabular-nums text-gray-900 rounded-md hover:bg-white/80"
            title="Tap to type allocate qty"
          >
            {qty}
          </button>
        )}
        <button
          type="button"
          disabled={!canIncrease}
          onClick={() => onQtyChange(clampQty(qty + 1))}
          className="h-7 w-7 shrink-0 rounded-md border border-gray-200 bg-white text-gray-700 text-sm font-semibold hover:bg-gray-100 disabled:opacity-30"
          aria-label="Increase allocate qty"
        >
          +
        </button>
      </div>

      <div className="flex items-end justify-between gap-1">
        <div className="min-w-0">
          <p className="text-[8px] font-bold uppercase tracking-wider text-sky-600 leading-none">
            Stored stock
          </p>
          <p className="text-[11px] font-bold tabular-nums text-gray-900 mt-0.5 truncate leading-tight">
            {currentStock}{' '}
            <span className="font-medium text-gray-400">{stockUnit}</span>
          </p>
        </div>
        <span
          className={`shrink-0 text-[10px] font-semibold ${
            hasStoredStock ? 'text-emerald-600' : 'text-gray-400'
          }`}
        >
          {hasStoredStock ? 'Active' : 'Empty slot'}
        </span>
      </div>
    </div>
  );
}
