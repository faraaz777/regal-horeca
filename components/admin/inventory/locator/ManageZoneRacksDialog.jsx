'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { Loader2, Search, X } from 'lucide-react';
import {
  assignRacksToZone,
  fetchZoneRackOptions,
  moveRackToZone,
  removeRacksFromZone,
} from '@/lib/client/zoneRackApi';
import RackAllocationStatusBadge from '@/components/admin/inventory/locator/RackAllocationStatusBadge';
import ZoneCapacityIndicator from '@/components/admin/inventory/locator/ZoneCapacityIndicator';
import { formatRackDisplayName } from '@/lib/shared/locationDisplay';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'available', label: 'Available' },
  { id: 'assigned_here', label: 'Assigned' },
  { id: 'assigned_elsewhere', label: 'Other zones' },
];

const UNDO_TOAST_MS = 10000;

export default function ManageZoneRacksDialog({
  open,
  onClose,
  floorId,
  zone,
  layoutVersion,
  floorLabel,
  canEdit,
  onUpdated,
}) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState(null);
  const undoingRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelected(new Set());
      setStatusFilter('all');
      setRemoveConfirm(null);
    }
  }, [open]);

  const swrKey =
    open && floorId && zone?.id
      ? `zone-racks-${floorId}-${zone.id}-${debouncedSearch}-${statusFilter}`
      : null;

  const { data, isLoading, mutate } = useSWR(
    swrKey,
    () =>
      fetchZoneRackOptions(floorId, zone.id, {
        q: debouncedSearch,
        status: statusFilter,
        limit: 100,
      }),
    { revalidateOnFocus: false }
  );

  const items = data?.items || [];
  const summary = zone?.summary;

  const selectedItems = useMemo(
    () => items.filter((i) => selected.has(i.rackId)),
    [items, selected]
  );

  const toggleSelect = (rackId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rackId)) next.delete(rackId);
      else next.add(rackId);
      return next;
    });
  };

  const refreshAfterChange = useCallback(async () => {
    await mutate();
    onUpdated?.();
  }, [mutate, onUpdated]);

  const handleUndoRemove = useCallback(
    async ({ rackIds, zoneId, zoneName, versionAfterRemove, count }) => {
      if (undoingRef.current) return;
      undoingRef.current = true;
      try {
        await assignRacksToZone(floorId, zoneId, {
          rackIds,
          layoutVersion: versionAfterRemove,
        });
        toast.success(
          count === 1
            ? `Restored rack to ${zoneName}`
            : `Restored ${count} racks to ${zoneName}`
        );
        await refreshAfterChange();
      } catch (err) {
        toast.error(err.message || 'Undo failed — reassign the rack from Manage racks');
      } finally {
        undoingRef.current = false;
      }
    },
    [floorId, refreshAfterChange]
  );

  const showRemovedToast = useCallback(
    ({ rackIds, zoneId, zoneName, versionAfterRemove, count }) => {
      toast(
        (t) => (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-800">
              {count === 1
                ? `Removed rack from ${zoneName}`
                : `Removed ${count} racks from ${zoneName}`}
            </span>
            <button
              type="button"
              className="shrink-0 text-sm font-bold text-emerald-700 hover:text-emerald-800 underline underline-offset-2"
              onClick={() => {
                toast.dismiss(t.id);
                void handleUndoRemove({
                  rackIds,
                  zoneId,
                  zoneName,
                  versionAfterRemove,
                  count,
                });
              }}
            >
              Undo
            </button>
          </div>
        ),
        { duration: UNDO_TOAST_MS, position: 'top-center' }
      );
    },
    [handleUndoRemove]
  );

  const handleAssign = async () => {
    const toAssign = selectedItems.filter((i) => i.allocationStatus === 'available');
    if (!toAssign.length) {
      toast.error('Select available racks to assign');
      return;
    }
    setBusy(true);
    try {
      await assignRacksToZone(floorId, zone.id, {
        rackIds: toAssign.map((i) => i.rackId),
        layoutVersion,
      });
      toast.success(`Assigned ${toAssign.length} rack(s)`);
      setSelected(new Set());
      await refreshAfterChange();
    } catch (err) {
      toast.error(err.message || 'Assign failed');
    } finally {
      setBusy(false);
    }
  };

  const handleMove = async () => {
    const toMove = selectedItems.filter((i) => i.allocationStatus === 'assigned_elsewhere');
    if (toMove.length !== 1) {
      toast.error('Select one rack from another zone to move');
      return;
    }
    const item = toMove[0];
    const ok = window.confirm(
      `Rack ${item.code} is currently assigned to ${item.assignedZone?.name || 'another zone'}.\n\nMove it to ${zone.name}?`
    );
    if (!ok) return;

    setBusy(true);
    try {
      await moveRackToZone(floorId, zone.id, {
        rackId: item.rackId,
        fromZoneId: item.assignedZone.id,
        layoutVersion,
      });
      toast.success(`Moved ${item.code} to ${zone.name}`);
      setSelected(new Set());
      await refreshAfterChange();
    } catch (err) {
      toast.error(err.message || 'Move failed');
    } finally {
      setBusy(false);
    }
  };

  const requestRemove = () => {
    const toRemove = selectedItems.filter((i) => i.allocationStatus === 'assigned_here');
    if (!toRemove.length) {
      toast.error('Select racks assigned to this zone');
      return;
    }
    const totalUnits = toRemove.reduce((s, i) => s + (i.totalQty || 0), 0);
    setRemoveConfirm({ items: toRemove, totalUnits });
  };

  const confirmRemove = async () => {
    if (!removeConfirm?.items?.length) return;
    const toRemove = removeConfirm.items;
    const rackIds = toRemove.map((i) => i.rackId);
    const zoneId = zone.id;
    const zoneName = zone.name;
    const versionAtRemove = layoutVersion;

    setBusy(true);
    try {
      await removeRacksFromZone(floorId, zoneId, {
        rackIds,
        layoutVersion: versionAtRemove,
      });
      setRemoveConfirm(null);
      setSelected(new Set());
      await refreshAfterChange();
      // remove increments layout version once — undo must use that next version
      showRemovedToast({
        rackIds,
        zoneId,
        zoneName,
        versionAfterRemove: versionAtRemove + 1,
        count: rackIds.length,
      });
    } catch (err) {
      toast.error(err.message || 'Remove failed');
    } finally {
      setBusy(false);
    }
  };

  if (!open || !zone) return null;

  const hasAvailable = selectedItems.some((i) => i.allocationStatus === 'available');
  const hasElsewhere = selectedItems.some((i) => i.allocationStatus === 'assigned_elsewhere');
  const hasHere = selectedItems.some((i) => i.allocationStatus === 'assigned_here');

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/45">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden relative">
        <div className="flex items-start justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-sm font-bold text-gray-900">
              {zone.name} — Manage racks
            </h2>
            {zone.code && <p className="text-[10px] text-gray-500 font-mono mt-0.5">{zone.code}</p>}
          </div>
          <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="px-4 py-3 bg-slate-50 border-b border-gray-100 shrink-0 space-y-2">
          <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-600">
            <span>
              <strong className="text-gray-900">{summary?.rackCount ?? 0}</strong> assigned racks
            </span>
            <span>
              <strong className="text-gray-900">{(summary?.totalQty ?? 0).toLocaleString()}</strong> total units
            </span>
            <span>
              <strong className="text-gray-900">{summary?.distinctProductCount ?? 0}</strong> products
            </span>
            <ZoneCapacityIndicator utilisationPercent={summary?.utilisationPercent} />
          </div>
        </div>

        <div className="px-4 py-2 border-b border-gray-100 shrink-0 space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search racks by name, code, product, SKU…"
              className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`px-2 py-1 text-[10px] font-semibold rounded-md ${
                  statusFilter === f.id
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <ul className="flex-1 overflow-y-auto px-4 py-2 space-y-1 min-h-0">
          {isLoading && (
            <li className="py-8 text-center text-gray-400">
              <Loader2 className="animate-spin inline-block" size={20} />
            </li>
          )}
          {!isLoading && !items.length && (
            <li className="py-8 text-center text-xs text-gray-400">No racks match your search</li>
          )}
          {items.map((item) => (
            <li key={item.rackId}>
              <label
                className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer ${
                  selected.has(item.rackId)
                    ? 'border-emerald-400 bg-emerald-50/50'
                    : 'border-gray-100 hover:bg-gray-50'
                } ${!canEdit || item.allocationStatus === 'inactive' ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <input
                  type="checkbox"
                  disabled={!canEdit || item.allocationStatus === 'inactive'}
                  checked={selected.has(item.rackId)}
                  onChange={() => toggleSelect(item.rackId)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold font-mono text-gray-900">
                      {formatRackDisplayName(item)}
                    </span>
                    {item.code && item.name && item.code !== item.name && (
                      <span className="text-[10px] text-gray-500 font-mono">{item.code}</span>
                    )}
                    <RackAllocationStatusBadge
                      status={item.allocationStatus}
                      assignedZoneName={item.assignedZone?.name}
                    />
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {floorLabel || 'Floor'} · {item.totalQty} items
                    {item.distinctProductCount > 0 && ` · ${item.distinctProductCount} products`}
                  </p>
                </div>
              </label>
            </li>
          ))}
        </ul>

        {canEdit && (
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              disabled={busy || !hasAvailable}
              onClick={handleAssign}
              className="px-3 py-1.5 text-xs font-bold rounded-md bg-emerald-600 text-white disabled:opacity-40"
            >
              Assign selected
            </button>
            <button
              type="button"
              disabled={busy || !hasElsewhere}
              onClick={handleMove}
              className="px-3 py-1.5 text-xs font-bold rounded-md bg-blue-600 text-white disabled:opacity-40"
            >
              Move to this zone
            </button>
            <button
              type="button"
              disabled={busy || !hasHere}
              onClick={requestRemove}
              className="px-3 py-1.5 text-xs font-bold rounded-md border border-red-200 text-red-700 disabled:opacity-40"
            >
              Remove from zone
            </button>
          </div>
        )}

        {removeConfirm && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
            <div
              role="alertdialog"
              aria-labelledby="remove-racks-title"
              aria-describedby="remove-racks-desc"
              className="bg-white rounded-xl shadow-xl w-full max-w-sm p-4 space-y-3"
            >
              <h3 id="remove-racks-title" className="text-sm font-bold text-gray-900">
                Remove from zone?
              </h3>
              <div id="remove-racks-desc" className="text-xs text-gray-600 space-y-2">
                <p>
                  Remove{' '}
                  <strong>
                    {removeConfirm.items.length === 1
                      ? formatRackDisplayName(removeConfirm.items[0])
                      : `${removeConfirm.items.length} racks`}
                  </strong>{' '}
                  from <strong>{zone.name}</strong>?
                </p>
                {removeConfirm.totalUnits > 0 && (
                  <p className="rounded-md bg-amber-50 border border-amber-100 px-2.5 py-2 text-amber-900">
                    These racks hold {removeConfirm.totalUnits.toLocaleString()} units. Stock is not
                    moved or deleted — only the zone placement is cleared.
                  </p>
                )}
                <p className="text-gray-500">You can undo this right after removing.</p>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setRemoveConfirm(null)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={confirmRemove}
                  className="px-3 py-1.5 text-xs font-bold rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 inline-flex items-center gap-1.5"
                >
                  {busy && <Loader2 size={12} className="animate-spin" />}
                  Yes, remove
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
