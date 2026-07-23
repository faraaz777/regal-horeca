'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR, { preload } from 'swr';
import { Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import {
  fetchCascadeBranches,
  fetchCascadeFloors,
  fetchCascadeRacks,
} from '@/lib/client/locationCascadeApi';
import { cascadeRacksSwrKey } from '@/lib/client/cascadeRacksSwrKey';

/**
 * Branch/floor accent styles — Transfer TO keeps amber selected branch chips
 * while emerald Add uses green selection borders.
 */
const ACCENT_STYLES = {
  emerald: {
    branchSelected: 'border-emerald-500 bg-emerald-50',
    badgeB: 'bg-emerald-700',
    changeLink: 'text-emerald-800',
    floorExpanded: 'border-emerald-300 bg-emerald-50/30',
  },
  sky: {
    branchSelected: 'border-gray-900 bg-amber-100',
    badgeB: 'bg-sky-600',
    changeLink: 'text-sky-800',
    floorExpanded: 'border-sky-300 bg-sky-50/30',
  },
};

/**
 * Nested Branch › Floor picker. Caller renders racks per expanded floor.
 */
export default function LocationCascadePicker({
  accent = 'emerald',
  swrKeyPrefix,
  enabled = true,
  defaultBranchId,
  defaultFloorId,
  forcePickingBranch,
  onBranchChange,
  renderFloorRacks,
}) {
  const styles = ACCENT_STYLES[accent] || ACCENT_STYLES.emerald;

  const [branchId, setBranchId] = useState(defaultBranchId ? String(defaultBranchId) : '');
  const [expandedFloors, setExpandedFloors] = useState(() =>
    defaultFloorId ? new Set([String(defaultFloorId)]) : new Set()
  );
  const [pickingBranch, setPickingBranch] = useState(
    forcePickingBranch ?? !defaultBranchId
  );

  useEffect(() => {
    if (defaultBranchId) {
      setBranchId(String(defaultBranchId));
      setPickingBranch(false);
    } else if (forcePickingBranch !== undefined) {
      setPickingBranch(forcePickingBranch);
    } else {
      setPickingBranch(true);
    }
    if (defaultFloorId) {
      setExpandedFloors(new Set([String(defaultFloorId)]));
    }
  }, [defaultBranchId, defaultFloorId, forcePickingBranch]);

  const { data: branchData, isLoading: branchesLoading } = useSWR(
    enabled ? `cascade-branches-${swrKeyPrefix}` : null,
    fetchCascadeBranches,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  const { data: floorData, isLoading: floorsLoading } = useSWR(
    enabled && branchId ? [`cascade-floors-${swrKeyPrefix}`, branchId] : null,
    () => fetchCascadeFloors(branchId),
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );

  const branches = useMemo(() => branchData?.branches || [], [branchData]);
  const floors = useMemo(() => floorData?.floors || [], [floorData]);
  const selectedBranch = branches.find((b) => String(b._id) === String(branchId));

  const pickBranch = (id) => {
    const nextId = String(id);
    setBranchId(nextId);
    setPickingBranch(false);
    // Expand nothing yet — floors effect opens first / default floor once loaded
    setExpandedFloors(new Set());
    onBranchChange?.(nextId);
  };

  /**
   * When a branch is active and floors arrive, expand one floor only
   * (defaultFloorId or the first floor) so racks load without a wall of cards.
   */
  useEffect(() => {
    if (pickingBranch || !branchId || !floors.length) return;
    setExpandedFloors((prev) => {
      if (prev.size > 0) {
        const stillValid = [...prev].some((id) =>
          floors.some((f) => String(f._id) === String(id))
        );
        if (stillValid) return prev;
      }
      if (
        defaultFloorId &&
        floors.some((f) => String(f._id) === String(defaultFloorId))
      ) {
        return new Set([String(defaultFloorId)]);
      }
      return new Set([String(floors[0]._id)]);
    });
  }, [pickingBranch, branchId, floors, defaultFloorId]);

  /**
   * Prefetch racks per floor after the branch is chosen.
   * Server single-flights the location index so parallel prefetches stay consistent.
   */
  useEffect(() => {
    if (pickingBranch || !floors.length) return;
    for (const floor of floors) {
      const fid = String(floor._id);
      const key = cascadeRacksSwrKey(swrKeyPrefix, fid);
      if (key) {
        preload(key, () => fetchCascadeRacks(fid));
      }
    }
  }, [pickingBranch, floors, swrKeyPrefix]);

  const toggleFloor = (floorId) => {
    setExpandedFloors((prev) => {
      const next = new Set(prev);
      if (next.has(floorId)) next.delete(floorId);
      else next.add(floorId);
      return next;
    });
  };

  if (pickingBranch || !branchId) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-2 space-y-2">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
          Select branch
        </p>
        {branchesLoading ? (
          <Loader2 size={14} className="animate-spin text-gray-400" />
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {branches.map((b) => (
              <button
                key={b._id}
                type="button"
                onClick={() => pickBranch(b._id)}
                className={`px-2.5 py-1.5 rounded-md border text-left transition-colors ${
                  String(branchId) === String(b._id)
                    ? styles.branchSelected
                    : 'border-gray-200 bg-gray-50 hover:bg-white hover:border-gray-400'
                }`}
              >
                <p className="text-[10px] font-bold font-mono text-gray-900">
                  {b.code || b._id}
                </p>
                <p className="text-[9px] text-gray-500 truncate max-w-[7rem]">
                  {b.name || b.code}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-2.5 py-2 border-b border-gray-100 bg-gray-50/80">
        <div
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${styles.badgeB} text-white text-[9px] font-bold`}
        >
          B
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold font-mono text-gray-900 truncate">
            {selectedBranch?.code || branchId}
          </p>
          <p className="text-[9px] text-gray-500 truncate">
            {selectedBranch?.name || selectedBranch?.code || 'Branch'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPickingBranch(true)}
          className={`text-[10px] font-semibold hover:underline shrink-0 ${styles.changeLink}`}
        >
          Change
        </button>
      </div>

      <div className="p-2 space-y-1.5">
        {floorsLoading ? (
          <p className="text-xs text-gray-500 flex items-center gap-1.5 py-2">
            <Loader2 size={12} className="animate-spin" />
            Loading floors…
          </p>
        ) : floors.length === 0 ? (
          <p className="text-[11px] text-gray-500 py-1">No floors in this branch.</p>
        ) : (
          floors.map((floor) => {
            const fid = String(floor._id);
            const isExpanded = expandedFloors.has(fid);
            return (
              <div
                key={fid}
                className={`rounded-md border overflow-hidden ${
                  isExpanded ? styles.floorExpanded : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-center gap-1.5 px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => toggleFloor(fid)}
                    className="shrink-0 text-gray-400 hover:text-gray-600 p-0.5"
                    aria-label={isExpanded ? 'Collapse floor' : 'Expand floor'}
                  >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-amber-500 text-white text-[9px] font-bold">
                    F
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleFloor(fid)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="text-[10px] font-bold font-mono text-gray-900 truncate">
                      {floor.code || fid}
                    </p>
                    <p className="text-[9px] text-gray-500 truncate">
                      {floor.name || floor.code || 'Floor'}
                    </p>
                  </button>
                </div>
                {isExpanded && (
                  <div className="px-2 pb-2 pt-1 border-t border-gray-100">
                    {renderFloorRacks?.(floor, {
                      branchId,
                      branchCode: selectedBranch?.code || '',
                      branchName: selectedBranch?.name || '',
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
