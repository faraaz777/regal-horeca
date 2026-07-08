'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { Loader2 } from 'lucide-react';
import {
  fetchCascadeBranches,
  fetchCascadeFloors,
  fetchCascadeRacks,
  resolveCascadeLocation,
} from '@/lib/client/locationCascadeApi';

const EMPTY_SELECTION = {
  branchId: null,
  floorId: null,
  rackId: null,
  locationId: null,
  displayPath: '',
};

function CascadeField({ label, required, loading, emptyMessage, children }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {loading ? (
        <p className="text-xs text-gray-500 flex items-center gap-1.5 py-2">
          <Loader2 size={12} className="animate-spin" />
          Loading…
        </p>
      ) : emptyMessage ? (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          {emptyMessage}
        </p>
      ) : (
        children
      )}
    </div>
  );
}

const selectClass =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:bg-gray-50 disabled:text-gray-400';

/**
 * @param {import('@/lib/shared/locationTypes').LocationSelectorProps} props
 */
export default function LocationSelector({
  selectedBranchId = null,
  selectedFloorId = null,
  selectedRackId = null,
  onChange,
  required = false,
  disabled = false,
  mode = 'edit',
  layout = 'vertical',
  allowedLocationIds,
  className = '',
}) {
  const [branchId, setBranchId] = useState(selectedBranchId || '');
  const [floorId, setFloorId] = useState(selectedFloorId || '');
  const [rackId, setRackId] = useState(selectedRackId || '');

  const { data: branchData, isLoading: branchesLoading } = useSWR(
    'cascade-branches',
    fetchCascadeBranches,
    { revalidateOnFocus: false }
  );

  const { data: floorData, isLoading: floorsLoading } = useSWR(
    branchId ? ['cascade-floors', branchId] : null,
    () => fetchCascadeFloors(branchId),
    { revalidateOnFocus: false }
  );

  const allowedKey = allowedLocationIds?.length
    ? allowedLocationIds.slice().sort().join(',')
    : '';

  const { data: rackData, isLoading: racksLoading } = useSWR(
    floorId ? ['cascade-racks', floorId, allowedKey] : null,
    () => fetchCascadeRacks(floorId, allowedLocationIds || []),
    { revalidateOnFocus: false }
  );

  const branches = branchData?.branches || [];
  const floors = floorData?.floors || [];
  const racks = rackData?.racks || [];

  const emitChange = useCallback(
    (next) => {
      onChange?.({
        branchId: next.branchId || null,
        floorId: next.floorId || null,
        rackId: next.rackId || null,
        locationId: next.locationId || next.rackId || null,
        displayPath: next.displayPath || '',
      });
    },
    [onChange]
  );

  useEffect(() => {
    if (!selectedBranchId && !selectedFloorId && !selectedRackId) return;
    setBranchId(selectedBranchId || '');
    setFloorId(selectedFloorId || '');
    setRackId(selectedRackId || '');
  }, [selectedBranchId, selectedFloorId, selectedRackId]);

  useEffect(() => {
    const leafId = selectedRackId;
    if (!leafId || branchId) return;
    let cancelled = false;
    resolveCascadeLocation(leafId)
      .then((res) => {
        if (cancelled || !res?.selection) return;
        setBranchId(res.selection.branchId || '');
        setFloorId(res.selection.floorId || '');
        setRackId(res.selection.rackId || '');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedRackId, branchId]);

  const handleBranchChange = (value) => {
    setBranchId(value);
    setFloorId('');
    setRackId('');
    emitChange({ ...EMPTY_SELECTION, branchId: value || null });
  };

  const handleFloorChange = (value) => {
    setFloorId(value);
    setRackId('');
    emitChange({
      ...EMPTY_SELECTION,
      branchId: branchId || null,
      floorId: value || null,
    });
  };

  const handleRackChange = (value) => {
    setRackId(value);
    const rack = racks.find((r) => String(r._id) === String(value));
    emitChange({
      branchId: branchId || null,
      floorId: floorId || null,
      rackId: value || null,
      locationId: value || null,
      displayPath: rack?.displayPath || '',
    });
  };

  const floorEmpty =
    branchId && !floorsLoading && floors.length === 0
      ? 'No floors found for this branch'
      : null;

  const rackEmpty =
    floorId && !racksLoading && racks.length === 0
      ? allowedLocationIds?.length
        ? 'No racks with available stock on this floor'
        : 'No racks found for this floor'
      : null;

  const showOptional = mode === 'filter' && !required;

  const selectedDisplay = useMemo(() => {
    if (!rackId) return '';
    const rack = racks.find((r) => String(r._id) === String(rackId));
    return rack?.displayPath || '';
  }, [rackId, racks]);

  const isHorizontal = layout === 'horizontal';
  const containerClass = isHorizontal
    ? `grid grid-cols-1 sm:grid-cols-3 gap-3 ${className}`
    : `space-y-3 ${className}`;

  return (
    <div className={containerClass}>
      <CascadeField
        label="Branch"
        required={required && !showOptional}
        loading={branchesLoading}
        emptyMessage={!branchesLoading && branches.length === 0 ? 'No branches configured' : null}
      >
        <select
          className={selectClass}
          value={branchId}
          disabled={disabled}
          onChange={(e) => handleBranchChange(e.target.value)}
        >
          <option value="">{showOptional ? 'All branches' : 'Select branch…'}</option>
          {branches.map((b) => (
            <option key={b._id} value={b._id}>
              {b.name || b.code}
            </option>
          ))}
        </select>
      </CascadeField>

      {(isHorizontal || branchId) && (
        <CascadeField
          label="Floor"
          required={required && !showOptional}
          loading={branchId ? floorsLoading : false}
          emptyMessage={branchId ? floorEmpty : null}
        >
          <select
            className={selectClass}
            value={floorId}
            disabled={disabled || !branchId || !!floorEmpty}
            onChange={(e) => handleFloorChange(e.target.value)}
          >
            <option value="">{showOptional ? 'All floors' : 'Select floor…'}</option>
            {floors.map((f) => (
              <option key={f._id} value={f._id}>
                {f.name || f.code}
              </option>
            ))}
          </select>
        </CascadeField>
      )}

      {(isHorizontal || floorId) && (
        <CascadeField
          label="Rack"
          required={required && !showOptional}
          loading={floorId ? racksLoading : false}
          emptyMessage={floorId ? rackEmpty : null}
        >
          <select
            className={selectClass}
            value={rackId}
            disabled={disabled || !floorId || !!rackEmpty}
            onChange={(e) => handleRackChange(e.target.value)}
          >
            <option value="">{showOptional ? 'All racks' : 'Select rack…'}</option>
            {racks.map((r) => (
              <option key={r._id} value={r._id}>
                {r.displayPath || r.name || r.code}
              </option>
            ))}
          </select>
        </CascadeField>
      )}

      {!isHorizontal && selectedDisplay && mode === 'edit' && (
        <p className="text-[11px] text-gray-500 font-mono truncate sm:col-span-3" title={selectedDisplay}>
          {selectedDisplay}
        </p>
      )}
    </div>
  );
}
