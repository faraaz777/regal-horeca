'use client';

import { countRacksInZone } from '@/lib/client/zoneUtils';

export default function ZonePropertiesPanel({
  zone,
  racks,
  onChange,
  onDelete,
  onManageRacks,
  canEdit,
}) {
  if (!zone) {
    return (
      <div className="text-xs text-gray-400 py-8 text-center">
        Click a zone to view details and manage its racks
      </div>
    );
  }

  const summary = zone.summary;
  const rackCount = summary?.rackCount ?? countRacksInZone(zone.id, racks);
  const totalQty = summary?.totalQty ?? racks
    .filter((r) => r.position?.zoneId === zone.id)
    .reduce((sum, r) => sum + (r.totalQty || 0), 0);

  const field = (label, children) => (
    <label className="block">
      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );

  const inputCls = 'mt-0.5 w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide">Zone properties</h3>
        {canEdit && (
          <button
            type="button"
            onClick={() => onDelete?.(zone)}
            className="text-[10px] font-semibold text-red-600 hover:text-red-700"
          >
            Delete
          </button>
        )}
      </div>

      <div className="rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-2 text-xs text-gray-700 space-y-1">
        <p>
          <strong>{rackCount}</strong> racks · <strong>{totalQty.toLocaleString()}</strong> units
        </p>
        {summary?.distinctProductCount != null && (
          <p className="text-[10px] text-gray-500">{summary.distinctProductCount} distinct products</p>
        )}
        <button
          type="button"
          onClick={() => onManageRacks?.(zone.id)}
          className="mt-2 w-full py-2 text-[10px] font-bold rounded-md bg-blue-600 text-white hover:bg-blue-700"
        >
          Manage racks
        </button>
      </div>

      {canEdit && (
        <>
          {field(
            'Name',
            <input
              className={inputCls}
              value={zone.name || ''}
              onChange={(e) => onChange({ ...zone, name: e.target.value })}
            />
          )}

          <div className="grid grid-cols-2 gap-2">
            {field(
              'Code',
              <input
                className={inputCls}
                value={zone.code || ''}
                onChange={(e) => onChange({ ...zone, code: e.target.value })}
              />
            )}
            {field(
              'Opacity',
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                className={inputCls}
                value={zone.opacity ?? 1}
                onChange={(e) => onChange({ ...zone, opacity: Number(e.target.value) })}
              />
            )}
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            <label className="inline-flex items-center gap-1.5 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={!!zone.locked}
                onChange={(e) => onChange({ ...zone, locked: e.target.checked })}
              />
              Locked
            </label>
            <label className="inline-flex items-center gap-1.5 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={!!zone.hidden}
                onChange={(e) => onChange({ ...zone, hidden: e.target.checked })}
              />
              Hidden
            </label>
          </div>
        </>
      )}
    </div>
  );
}
