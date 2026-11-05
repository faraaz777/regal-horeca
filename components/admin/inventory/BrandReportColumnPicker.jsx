'use client';

import { useEffect, useRef, useState } from 'react';
import { Columns3 } from 'lucide-react';
import {
  BRAND_REPORT_DEFAULT_COLUMN_IDS,
  BRAND_REPORT_TOGGLE_COLUMNS,
} from '@/lib/shared/brandReportColumns';

/**
 * Turns report fields on or off. Product stays fixed.
 * The same ids are sent to Excel and the PDF preview.
 */
export default function BrandReportColumnPicker({ columns, onChange }) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const selected = new Set(columns);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) {
      if (next.size <= 1) return;
      next.delete(id);
    } else {
      next.add(id);
    }
    onChange(BRAND_REPORT_TOGGLE_COLUMNS.map((column) => column.id).filter((item) => next.has(item)));
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700"
      >
        <Columns3 size={14} />
        Columns
        <span className="text-gray-400">{columns.length}/{BRAND_REPORT_TOGGLE_COLUMNS.length}</span>
      </button>
      {open ? (
        <div className="absolute right-0 z-40 mt-1 w-56 overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-gray-200">
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
            <p className="text-xs font-semibold text-gray-700">Visible columns</p>
            <button
              type="button"
              onClick={() => onChange([...BRAND_REPORT_DEFAULT_COLUMN_IDS])}
              className="text-[11px] font-medium text-emerald-700"
            >
              Show all
            </button>
          </div>
          <ul className="max-h-72 overflow-y-auto py-1">
            {BRAND_REPORT_TOGGLE_COLUMNS.map((column) => {
              const checked = selected.has(column.id);
              return (
                <li key={column.id}>
                  <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(column.id)}
                      className="h-3.5 w-3.5 accent-gray-900"
                    />
                    {column.excelHeader}
                  </label>
                </li>
              );
            })}
          </ul>
          <p className="border-t border-gray-100 px-3 py-2 text-[11px] text-gray-400">
            Product stays. Excel and PDF use the same set.
          </p>
        </div>
      ) : null}
    </div>
  );
}
