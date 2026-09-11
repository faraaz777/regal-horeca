'use client';

import { useId, useState } from 'react';

export default function FormAccordion({ title, description, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span>
          <span className="block text-sm font-semibold text-gray-900">{title}</span>
          {description ? (
            <span className="mt-0.5 block text-xs text-gray-500">{description}</span>
          ) : null}
        </span>
        <span className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div id={panelId} className="border-t border-gray-100 px-5 py-4">
          {children}
        </div>
      ) : null}
    </div>
  );
}
