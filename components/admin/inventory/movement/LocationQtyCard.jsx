'use client';

import MovementQtyStepper from './MovementQtyStepper';

/**
 * Compact rack row: code + name, path under — on-hand lives in its own
 * middle “stat” so it doesn’t compete with the path or the stepper.
 */
export default function LocationQtyCard({
  code,
  name,
  codePath,
  onHand,
  qty,
  max,
  onQtyChange,
  accent = 'amber',
  badge,
  actionLabel,
  showMax,
}) {
  const exceeds = max != null && qty > max;
  const borderTone =
    accent === 'emerald'
      ? exceeds
        ? 'border-red-300 bg-red-50'
        : qty > 0
          ? 'border-emerald-300 bg-emerald-50/40'
          : 'border-gray-200 bg-white'
      : exceeds
        ? 'border-red-300 bg-red-50'
        : qty > 0
          ? 'border-amber-300 bg-amber-50/50'
          : 'border-gray-200 bg-white';

  const showName = Boolean(name && name !== code);
  const showPath = Boolean(codePath && codePath !== '—');
  const onHandTone =
    accent === 'emerald'
      ? 'bg-emerald-50 border-emerald-100 text-emerald-950'
      : 'bg-amber-50 border-amber-100 text-amber-950';

  return (
    <div className={`rounded-xl border-2 px-3 py-2.5 ${borderTone}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <p className="min-w-0 truncate leading-tight">
              <span className="text-[15px] font-bold font-mono tracking-tight text-gray-900">
                {code}
              </span>
              {showName ? (
                <span className="text-[13px] font-medium text-gray-500 ml-2">{name}</span>
              ) : null}
            </p>
            {badge}
          </div>
          {showPath ? (
            <p
              className="text-[11px] text-gray-400 font-mono truncate leading-none mt-1"
              title={codePath}
            >
              {codePath}
            </p>
          ) : null}
        </div>

        <div
          className={`shrink-0 flex flex-col items-center justify-center min-w-[3.5rem] px-2.5 py-1.5 rounded-xl border ${onHandTone}`}
          title={`${onHand} on hand at this rack`}
        >
          <span className="text-lg font-bold font-mono tabular-nums leading-none tracking-tight">
            {onHand}
          </span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mt-1 leading-none">
            on hand
          </span>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          {actionLabel ? (
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
              {actionLabel}
            </span>
          ) : null}
          <MovementQtyStepper
            value={qty}
            max={max}
            onChange={onQtyChange}
            accent={accent}
            size="lg"
          />
          {showMax && max > 0 && qty < max ? (
            <button
              type="button"
              onClick={() => onQtyChange(max)}
              className="text-[11px] font-semibold text-amber-800 hover:underline"
            >
              All {max}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
