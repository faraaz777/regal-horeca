'use client';

import { Plus, Minus, ArrowLeftRight, Settings } from 'lucide-react';

export const TAB_LABELS = {
  add: 'Add',
  minus: 'Minus',
  transfer: 'Transfer',
  rules: 'Rules',
};

const MOVEMENT_TABS = ['add', 'minus', 'transfer'];

export const ALL_TABS = [...MOVEMENT_TABS, 'rules'];

/**
 * Chrome-style tab accents — strip tint + active text/icon color.
 * Active tab is white and flush with the panel below (browser-tab language).
 * Strip colors are solid so the curved shoulder trick composites cleanly.
 */
export const TAB_CHROME = {
  add: {
    strip: 'bg-[#e6f0ea]',
    activeText: 'text-emerald-800',
    iconWrap: 'bg-emerald-600 text-white',
    idleIcon: 'bg-emerald-200/90 text-emerald-800',
  },
  minus: {
    strip: 'bg-[#f3ebe0]',
    activeText: 'text-amber-900',
    iconWrap: 'bg-amber-600 text-white',
    idleIcon: 'bg-amber-200/90 text-amber-900',
  },
  transfer: {
    strip: 'bg-[#e4eef6]',
    activeText: 'text-sky-900',
    iconWrap: 'bg-sky-600 text-white',
    idleIcon: 'bg-sky-200/90 text-sky-900',
  },
  rules: {
    strip: 'bg-[#e8eaed]',
    activeText: 'text-slate-800',
    iconWrap: 'bg-slate-700 text-white',
    idleIcon: 'bg-slate-300 text-slate-700',
  },
};

export const TAB_ICONS = {
  add: Plus,
  minus: Minus,
  transfer: ArrowLeftRight,
  rules: Settings,
};

/**
 * Browser-style movement tabs — active tab is a white “sheet” with curved shoulders.
 */
export default function ChromeMovementTabs({ activeTab, onSelect }) {
  const chrome = TAB_CHROME[activeTab] || TAB_CHROME.add;

  return (
    <div className={`px-2 pt-2 ${chrome.strip}`}>
      <div className="flex items-end gap-0.5" role="tablist" aria-label="Stock movement">
        {ALL_TABS.map((key) => {
          const Icon = TAB_ICONS[key];
          const isActive = activeTab === key;
          const tone = TAB_CHROME[key];
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(key)}
              className={`relative flex-1 min-w-0 flex items-center justify-center gap-1.5 px-1.5 sm:px-2.5 pt-2.5 pb-2.5 text-sm font-semibold transition-colors ${
                isActive
                  ? `z-10 -mb-px bg-white rounded-t-[12px] ${tone.activeText}`
                  : 'mb-0.5 text-gray-500 hover:text-gray-800 rounded-t-lg hover:bg-white/45'
              }`}
            >
              {isActive ? (
                <>
                  <span
                    aria-hidden
                    className={`pointer-events-none absolute bottom-0 -left-2 h-2 w-2 rounded-br-lg ${chrome.strip}`}
                    style={{ boxShadow: '2px 2px 0 2px #fff' }}
                  />
                  <span
                    aria-hidden
                    className={`pointer-events-none absolute bottom-0 -right-2 h-2 w-2 rounded-bl-lg ${chrome.strip}`}
                    style={{ boxShadow: '-2px 2px 0 2px #fff' }}
                  />
                </>
              ) : null}
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full shrink-0 ${
                  isActive ? tone.iconWrap : tone.idleIcon
                }`}
              >
                <Icon size={12} strokeWidth={2.5} />
              </span>
              <span className="truncate">{TAB_LABELS[key]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
