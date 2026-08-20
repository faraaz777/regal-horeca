'use client';

import MovementQtyStepper from '@/components/admin/inventory/movement/MovementQtyStepper';

/**
 * Rack confirmation shown before fulfilling a stock request.
 *
 * These numbers are NOT available stock. Approving the request already took
 * the pieces out, so this panel shows where that reservation currently sits.
 * The supervisor changes it only when the goods were physically pulled from a
 * different rack than approve picked — the stock is never removed a second
 * time. That distinction is why this does not reuse the Minus tab's rack list,
 * where the same-looking numbers mean "free to take".
 */
export function assignedQty(perRack) {
  return Object.values(perRack || {}).reduce((sum, qty) => sum + (Number(qty) || 0), 0);
}

/**
 * A line is ready to fulfil when its racks add up to the approved quantity.
 *
 * The exception is a line with nothing reserved against it — legacy requests
 * approved before reservations were recorded. Those carry no rack information
 * to confirm, so the server picks the rack and the line must not be blocked.
 */
export function isLineBalanced(line, perRack) {
  const assigned = assignedQty(perRack);
  if (assigned === 0 && line.reserved.length === 0) return true;
  return assigned === line.approvedQty;
}

export default function FulfilRackPanel({ plan, allocations, onChange, onReset }) {
  if (!plan?.length) return null;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
        <p className="text-xs font-semibold text-amber-900">
          Confirm which racks these came from
        </p>
        <p className="text-[11px] leading-snug text-amber-800 mt-0.5">
          These pieces left stock when you approved. Only change a rack if you
          actually pulled from somewhere else — nothing is deducted twice.
        </p>
      </div>

      {plan.map((line) => {
        const perRack = allocations?.[line.lineId] || {};
        const assigned = assignedQty(perRack);
        const balanced = isLineBalanced(line, perRack);
        const changed = line.reserved.some(
          (r) => (Number(perRack[r.locationId]) || 0) !== r.qty
        );

        return (
          <div
            key={line.lineId}
            className="rounded-lg border border-gray-200 bg-white p-3 space-y-2.5"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 flex-1 text-sm font-medium text-gray-900">
                {line.productTitle}
              </p>
              <span
                className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-bold tabular-nums ${
                  balanced
                    ? 'bg-green-100 text-green-900'
                    : 'bg-red-100 text-red-900'
                }`}
              >
                {assigned} of {line.approvedQty}
              </span>
            </div>

            {line.racks.length === 0 ? (
              <p className="rounded border border-amber-100 bg-amber-50 px-2 py-2 text-xs text-amber-900">
                No rack holds this product right now. Fulfilling will record the
                sale without a rack correction.
              </p>
            ) : (
              <div className="space-y-1.5">
                {line.racks.map((rack) => {
                  const qty = Number(perRack[rack.locationId]) || 0;
                  return (
                    <div
                      key={rack.locationId}
                      className={`flex items-center justify-between gap-3 rounded-lg border px-2.5 py-2 ${
                        qty > 0
                          ? 'border-amber-300 bg-amber-50/50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="min-w-0 truncate leading-tight">
                          <span className="font-mono text-[13px] font-bold tracking-tight text-gray-900">
                            {rack.locationCode || rack.locationName || 'Rack'}
                          </span>
                          {rack.locationName &&
                          rack.locationName !== rack.locationCode ? (
                            <span className="ml-2 text-[12px] text-gray-500">
                              {rack.locationName}
                            </span>
                          ) : null}
                        </p>
                        <p
                          className="mt-0.5 truncate font-mono text-[10px] leading-none text-gray-400"
                          title={rack.locationCodePath}
                        >
                          {rack.locationCodePath}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        {rack.reservedQty > 0 ? (
                          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                            reserved {rack.reservedQty}
                          </p>
                        ) : null}
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 tabular-nums">
                          {rack.available} on rack
                        </p>
                      </div>

                      <MovementQtyStepper
                        value={qty}
                        max={rack.maxQty}
                        onChange={(next) => onChange(line.lineId, rack.locationId, next)}
                        accent="amber"
                        size="md"
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {!balanced ? (
              <p className="text-[11px] font-medium text-red-700">
                Assign exactly {line.approvedQty} across the racks before fulfilling.
              </p>
            ) : null}

            {changed ? (
              <button
                type="button"
                onClick={() => onReset(line.lineId)}
                className="text-[11px] font-semibold text-gray-500 hover:text-gray-800 hover:underline"
              >
                Reset to what was reserved
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
