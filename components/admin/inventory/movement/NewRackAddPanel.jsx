'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { Loader2, Plus } from 'lucide-react';
import { fetchCascadeRacks } from '@/lib/client/locationCascadeApi';
import { locationRackCode, locationRackName } from '@/lib/client/inventory/locationLabels';
import LocationCascadePicker from './LocationCascadePicker';

function NewRackFloorRacks({ floorId, occupiedLocationIds, onPickRack }) {
  const occupiedSet = useMemo(
    () => new Set((occupiedLocationIds || []).map(String)),
    [occupiedLocationIds]
  );

  const { data: rackData, isLoading } = useSWR(
    floorId ? ['cascade-racks-add', floorId] : null,
    () => fetchCascadeRacks(floorId),
    { revalidateOnFocus: false }
  );

  const racks = useMemo(() => {
    const list = rackData?.racks || [];
    return list.filter((rack) => !occupiedSet.has(String(rack._id)));
  }, [rackData, occupiedSet]);

  if (isLoading) {
    return (
      <p className="text-xs text-gray-500 flex items-center gap-1.5 px-1 py-2">
        <Loader2 size={12} className="animate-spin" />
        Loading racks…
      </p>
    );
  }

  if (!racks.length) {
    return (
      <p className="text-[11px] text-emerald-900 px-1 py-1">
        No free racks on this floor — try another floor.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {racks.map((rack) => {
        const code = locationRackCode(rack) || String(rack._id).slice(-4);
        const name = locationRackName(rack);
        return (
          <button
            key={rack._id}
            type="button"
            onClick={() => onPickRack(rack)}
            title={`${code}${name !== code ? ` · ${name}` : ''} — tap to add`}
            className="rounded-md border border-emerald-200 bg-white text-left transition-colors min-w-[3.5rem] max-w-[5rem] px-1.5 py-1.5 hover:border-emerald-400 hover:bg-emerald-50"
          >
            <p className="text-[10px] font-bold font-mono leading-none truncate text-gray-900">
              {code}
            </p>
            <p className="text-[9px] mt-0.5 truncate leading-tight text-gray-500">{name}</p>
            <p className="text-[9px] mt-0.5 leading-none text-emerald-700 font-medium">+1</p>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Add → New rack: nested branch / floor / rack cards (same pattern as Transfer TO).
 * Tap a rack to add it to the list with qty 1; adjust on the list above.
 */
export default function NewRackAddPanel({
  defaultBranchId,
  defaultFloorId,
  occupiedLocationIds,
  defaultOpen = false,
  onAdd,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [branchId, setBranchId] = useState(defaultBranchId ? String(defaultBranchId) : '');

  useEffect(() => {
    setOpen(defaultOpen);
  }, [defaultOpen]);

  useEffect(() => {
    if (defaultBranchId) {
      setBranchId(String(defaultBranchId));
    }
  }, [defaultBranchId]);

  const pickRack = (rack, floor, branchIdForRack) => {
    const code = locationRackCode(rack);
    const name = locationRackName(rack);
    onAdd(
      {
        locationId: String(rack._id),
        locationPath: rack.displayPath || name || code || String(rack._id),
        locationCode: code,
        locationName: name,
        locationCodePath: '',
        branchId: branchIdForRack || branchId || null,
        floorId: String(floor._id),
        rackId: String(rack._id),
        qty: 0,
        isNew: true,
      },
      1
    );
  };

  return (
    <div className="rounded-lg border border-dashed border-emerald-300 bg-emerald-50/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-xs font-semibold text-emerald-900 hover:bg-emerald-50/80 rounded-lg transition-colors"
      >
        <span className="inline-flex items-center gap-1.5">
          <Plus size={14} />
          New rack
        </span>
        <span className="text-gray-400">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 pt-2 space-y-2 border-t border-emerald-200/60">
          <p className="text-[10px] text-gray-500">
            Tap a rack to add it to the list (qty 1). Adjust quantity above.
          </p>

          <LocationCascadePicker
            accent="emerald"
            swrKeyPrefix="add"
            enabled={open}
            defaultBranchId={defaultBranchId}
            defaultFloorId={defaultFloorId}
            onBranchChange={(id) => setBranchId(id)}
            renderFloorRacks={(floor, ctx) => (
              <NewRackFloorRacks
                floorId={String(floor._id)}
                occupiedLocationIds={occupiedLocationIds}
                onPickRack={(rack) => pickRack(rack, floor, ctx?.branchId)}
              />
            )}
          />
        </div>
      )}
    </div>
  );
}
