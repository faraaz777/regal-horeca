'use client';

import { useMemo } from 'react';
import { X, Settings2, Loader2 } from 'lucide-react';
import { getRackPresenceStyle } from '@/lib/client/locatorUtils';
import { formatRackDisplayName } from '@/lib/shared/locationDisplay';

function StatBadge({ label, value, className = 'bg-slate-100 text-slate-800' }) {
  return (
    <span className={`px-2 py-1 rounded-full text-[10px] font-semibold ${className}`}>
      {value} {label}
    </span>
  );
}

export default function ZoneDetailDrawer({
  zone,
  floorLabel,
  branchLabel,
  racks = [],
  canEdit = false,
  editMode = false,
  onClose,
  onManageRacks,
  onOpenRack,
  onChange,
  onDelete,
  onSave,
  saving = false,
}) {
  const summary = zone?.summary;
  const zoneRacks = useMemo(
    () => racks.filter((r) => r.position?.zoneId === zone?.id),
    [racks, zone?.id]
  );

  if (!zone) return null;

  const rackCount = summary?.rackCount ?? zoneRacks.length;
  const totalQty = summary?.totalQty ?? zoneRacks.reduce((s, r) => s + (r.totalQty || 0), 0);
  const statusCounts = summary?.rackStatusCounts || {};

  const field = (label, children) => (
    <label className="block">
      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );

  const inputCls =
    'mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30';

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} aria-hidden />
      <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Zone detail</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Location</p>
            <p className="text-sm font-semibold text-gray-900 mt-1">
              {branchLabel} › {floorLabel} › {zone.name}
            </p>
            {zone.code && <p className="text-xs text-gray-500 font-mono mt-0.5">{zone.code}</p>}
            {zone.description && (
              <p className="text-xs text-gray-600 mt-2">{zone.description}</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
              <p className="text-[10px] text-gray-500 uppercase font-semibold">Racks</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">{rackCount}</p>
            </div>
            <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
              <p className="text-[10px] text-gray-500 uppercase font-semibold">Total units</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">{totalQty.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
              <p className="text-[10px] text-gray-500 uppercase font-semibold">Products</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">
                {summary?.distinctProductCount ?? '—'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(statusCounts.hasStock || 0) > 0 && (
              <StatBadge label="with stock" value={statusCounts.hasStock} className="bg-emerald-100 text-emerald-800" />
            )}
            {(statusCounts.empty || 0) > 0 && (
              <StatBadge label="empty" value={statusCounts.empty} className="bg-gray-200 text-gray-700" />
            )}
          </div>

          {(summary?.stockStatusQty?.sellable > 0) && (
            <div className="text-xs text-gray-600 space-y-1">
              <p>
                Sellable:{' '}
                <strong>{summary.stockStatusQty.sellable.toLocaleString()}</strong>
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => onManageRacks?.(zone.id)}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            <Settings2 size={16} />
            Manage racks
          </button>

          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">
              Racks in zone ({zoneRacks.length})
            </p>
            {zoneRacks.length === 0 ? (
              <p className="text-sm text-gray-400">No racks assigned to this zone yet</p>
            ) : (
              <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                {zoneRacks.map((rack) => {
                  const statusStyle = getRackPresenceStyle(rack);
                  const skus = Number(rack.productCount ?? rack.distinctProductCount) || 0;
                  const qty = Number(rack.sellableQty ?? rack.totalQty) || 0;
                  return (
                    <li key={rack._id}>
                      <button
                        type="button"
                        onClick={() => onOpenRack?.(rack._id)}
                        className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-mono font-semibold text-gray-900">
                            {formatRackDisplayName(rack)}
                          </p>
                          <span
                            className={`shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${statusStyle.fill} ${statusStyle.text}`}
                          >
                            {statusStyle.label}
                          </span>
                        </div>
                        {rack.code && rack.name && rack.code !== rack.name && (
                          <p className="text-xs text-gray-500 font-mono truncate mt-0.5">{rack.code}</p>
                        )}
                        <p className="text-xs text-gray-600 mt-1">
                          {skus > 0
                            ? `${skus} SKU${skus === 1 ? '' : 's'} · ${qty.toLocaleString()} pcs`
                            : 'Empty'}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {canEdit && editMode && (
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Edit zone</p>
              {field(
                'Name',
                <input
                  className={inputCls}
                  value={zone.name || ''}
                  onChange={(e) => onChange?.({ ...zone, name: e.target.value })}
                />
              )}
              <div className="grid grid-cols-2 gap-2">
                {field(
                  'Code',
                  <input
                    className={inputCls}
                    value={zone.code || ''}
                    onChange={(e) => onChange?.({ ...zone, code: e.target.value })}
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
                    onChange={(e) => onChange?.({ ...zone, opacity: Number(e.target.value) })}
                  />
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <label className="inline-flex items-center gap-1.5 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={!!zone.locked}
                    onChange={(e) => onChange?.({ ...zone, locked: e.target.checked })}
                  />
                  Locked
                </label>
                <label className="inline-flex items-center gap-1.5 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={!!zone.hidden}
                    onChange={(e) => onChange?.({ ...zone, hidden: e.target.checked })}
                  />
                  Hidden
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onSave}
                  disabled={saving}
                  className="flex-1 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white disabled:opacity-50 inline-flex items-center justify-center gap-1"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  Save zone
                </button>
                <button
                  type="button"
                  onClick={() => onDelete?.(zone)}
                  className="px-3 py-2 text-xs font-semibold rounded-lg border border-red-200 text-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
