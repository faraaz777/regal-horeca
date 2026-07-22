'use client';

import { AlertTriangle } from 'lucide-react';

/**
 * Soft planning guard — max stock is a warning threshold, not a hard block.
 * Caller proceeds with the inventory action after the user confirms override.
 */
export default function MaxStockWarnDialog({
  isOpen,
  onCancel,
  onContinue,
  currentQty = 0,
  afterQty = 0,
  maxStock = 0,
  stockUnit = 'units',
  continuing = false,
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-[1px]"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !continuing) onCancel?.();
      }}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-amber-200 overflow-hidden"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="max-stock-warn-title"
      >
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-700 shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div className="min-w-0">
              <h3 id="max-stock-warn-title" className="text-base font-bold text-gray-900">
                Exceeds max stock
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                This action will put stock above the configured maximum. Max stock is a planning
                limit — you can continue if intentional.
              </p>
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-3 gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 text-center">
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Current</dt>
              <dd className="text-lg font-bold tabular-nums text-gray-900 mt-0.5">
                {currentQty}{' '}
                <span className="text-xs font-medium text-gray-400">{stockUnit}</span>
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wide text-gray-500">After</dt>
              <dd className="text-lg font-bold tabular-nums text-amber-700 mt-0.5">
                {afterQty}{' '}
                <span className="text-xs font-medium text-amber-500">{stockUnit}</span>
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Maximum</dt>
              <dd className="text-lg font-bold tabular-nums text-gray-900 mt-0.5">
                {maxStock}{' '}
                <span className="text-xs font-medium text-gray-400">{stockUnit}</span>
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 bg-gray-50 border-t border-gray-100">
          <button
            type="button"
            onClick={onCancel}
            disabled={continuing}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onContinue}
            disabled={continuing}
            className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
