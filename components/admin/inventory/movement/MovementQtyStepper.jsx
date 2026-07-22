'use client';

import { useEffect, useState } from 'react';

export default function MovementQtyStepper({
  value,
  max,
  onChange,
  accent = 'amber',
  size = 'md',
  fullWidth = false,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const focusRing = accent === 'emerald' ? 'focus:ring-emerald-400' : 'focus:ring-amber-400';
  const hoverBg = accent === 'emerald' ? 'hover:bg-emerald-50' : 'hover:bg-amber-50';

  const sizeMap = {
    sm: {
      btn: 'w-6 h-7 text-xs',
      mid: fullWidth ? 'flex-1 min-w-0 h-7 text-xs' : 'w-7 h-7 text-xs',
      radius: 'rounded-lg',
      btnRadius: 'rounded-l-md',
      btnRadiusR: 'rounded-r-md',
    },
    md: {
      btn: 'w-7 h-8 text-sm',
      mid: fullWidth ? 'flex-1 min-w-0 h-8 text-sm' : 'w-9 h-8 text-sm',
      radius: 'rounded-xl',
      btnRadius: 'rounded-l-[10px]',
      btnRadiusR: 'rounded-r-[10px]',
    },
    lg: {
      btn: 'w-11 h-11 text-lg',
      mid: fullWidth ? 'flex-1 min-w-0 h-11 text-base' : 'w-12 h-11 text-base',
      radius: 'rounded-xl',
      btnRadius: 'rounded-l-[10px]',
      btnRadiusR: 'rounded-r-[10px]',
    },
  };
  const s = sizeMap[size] || sizeMap.md;
  const isLg = size === 'lg';

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  const clamp = (n) => {
    let next = Math.max(0, n);
    if (max != null && max >= 0) next = Math.min(max, next);
    return next;
  };

  const commit = () => {
    const parsed = parseInt(draft, 10);
    const next = clamp(Number.isNaN(parsed) ? 0 : parsed);
    onChange(next);
    setDraft(String(next));
  };

  const canIncrease = max == null || value < max;

  return (
    <div
      className={`${fullWidth ? 'flex w-full' : 'inline-flex'} items-center ${s.radius} border-2 border-gray-200 bg-gray-50 shrink-0 ${
        isLg ? 'shadow-sm' : ''
      }`}
    >
      <button
        type="button"
        disabled={value <= 0}
        onClick={() => onChange(Math.max(0, value - 1))}
        className={`${s.btn} font-semibold text-gray-700 disabled:opacity-30 hover:bg-gray-100 ${s.btnRadius}`}
        aria-label="Decrease quantity"
      >
        −
      </button>
      {editing ? (
        <input
          autoFocus
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          className={`${s.mid} text-center font-mono tabular-nums border-x-2 border-gray-200 bg-white outline-none focus:ring-2 ${focusRing}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
          onBlur={() => {
            commit();
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commit();
              setEditing(false);
              e.preventDefault();
            }
            if (e.key === 'Escape') {
              setDraft(String(value));
              setEditing(false);
            }
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(String(value));
            setEditing(true);
          }}
          className={`${s.mid} font-mono tabular-nums border-x-2 border-gray-200 bg-white ${hoverBg}`}
          title="Tap to type quantity"
        >
          {value}
        </button>
      )}
      <button
        type="button"
        disabled={!canIncrease}
        onClick={() => onChange(clamp(value + 1))}
        className={`${s.btn} font-semibold text-gray-700 disabled:opacity-30 hover:bg-gray-100 ${s.btnRadiusR}`}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}
