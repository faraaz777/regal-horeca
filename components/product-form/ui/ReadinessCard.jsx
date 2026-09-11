'use client';

/**
 * Catalog quality vs save-gate, split on purpose:
 * API still only requires title + hero. Brand/category/SKU are "ready to publish" hints.
 */
export default function ReadinessCard({ items, canSave, catalogReadyCount, catalogReadyTotal }) {
  return (
    <aside className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">Readiness</h3>
      <p className="mt-1 text-xs text-gray-500">
        Required to save: {canSave ? 'ready' : 'title + hero image'}
      </p>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{
            width: `${catalogReadyTotal ? Math.round((catalogReadyCount / catalogReadyTotal) * 100) : 0}%`,
          }}
        />
      </div>
      <p className="mt-1 text-[11px] text-gray-400">
        Catalog-ready {catalogReadyCount}/{catalogReadyTotal}
      </p>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-2 text-sm">
            <span
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${
                item.done ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}
              aria-hidden
            >
              {item.done ? '✓' : '–'}
            </span>
            <span className={item.done ? 'text-gray-800' : 'text-gray-500'}>
              {item.label}
              {item.hint ? (
                <span className="block text-[11px] text-gray-400">{item.hint}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
