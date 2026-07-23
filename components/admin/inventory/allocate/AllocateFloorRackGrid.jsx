'use client';

import { useEffect } from 'react';
import useSWR from 'swr';
import { Loader2 } from 'lucide-react';
import { fetchCascadeRacks } from '@/lib/client/locationCascadeApi';
import { cascadeRacksSwrKey } from '@/lib/client/cascadeRacksSwrKey';
import { writeStoredId, LAST_FLOOR_KEY } from './allocateHelpers';
import RackAllocateCard from './RackAllocateCard';

/**
 * Racks for one expanded floor.
 * Prefetched via LocationCascadePicker; qty from Stock snapshot with light refresh.
 */
export default function AllocateFloorRackGrid({
  floor,
  branchId,
  branchCode,
  branchName,
  allocatedByRackId,
  remaining,
  stockUnit,
  disabled,
  onQtyChange,
  swrKeyPrefix = 'allocate',
}) {
  useEffect(() => {
    if (floor?._id) writeStoredId(LAST_FLOOR_KEY, floor._id);
  }, [floor?._id]);

  const floorId = floor?._id ? String(floor._id) : '';
  /**
   * Structure from cascade (shared location index). totalQty from Stock snapshot.
   * Do not auto-refresh every few seconds — that raced cold/warm payloads and
   * made rack cards appear/disappear on the same floor.
   */
  const { data: rackData, isLoading } = useSWR(
    cascadeRacksSwrKey(swrKeyPrefix, floorId),
    () => fetchCascadeRacks(floorId),
    {
      revalidateOnMount: true,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60_000,
      keepPreviousData: true,
    }
  );
  const racks = rackData?.racks || [];

  if (!rackData && isLoading) {
    return (
      <p className="text-xs text-gray-500 flex items-center gap-1.5 px-1 py-2">
        <Loader2 size={12} className="animate-spin" />
        Loading racks…
      </p>
    );
  }

  if (!racks.length) {
    return <p className="text-[11px] text-gray-500 px-1 py-1">No racks on this floor.</p>;
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(7.75rem,1fr))] gap-2">
      {racks.map((rack) => {
        const rackId = String(rack._id);
        const allocatedQty = allocatedByRackId.get(rackId) || 0;
        const rowMax = remaining + allocatedQty;
        /**
         * Stored stock = sellable units of every SKU already on this rack
         * (Stock snapshot totalQty), not qty of the product being allocated.
         */
        const currentStock = Number(rack.totalQty) || 0;
        return (
          <RackAllocateCard
            key={rackId}
            rack={rack}
            floor={floor}
            branchCode={branchCode}
            branchName={branchName}
            allocatedQty={allocatedQty}
            rowMax={rowMax}
            currentStock={currentStock}
            stockUnit={stockUnit}
            disabled={disabled}
            onQtyChange={(next) => onQtyChange(rack, floor, next, { branchId, branchCode })}
          />
        );
      })}
    </div>
  );
}
