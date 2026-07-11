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
import { formatRackDisplayName } from '@/lib/shared/locationDisplay';
import SearchableSelect from '@/components/admin/inventory/SearchableSelect';
import {
  toBranchOptions,
  toFloorOptions,
  toRackOptions,
} from '@/lib/client/locationSelectOptions';

const EMPTY_SELECTION = {
  branchId: null,
  floorId: null,
  rackId: null,
  locationId: null,
  displayPath: '',
};

function CascadeField({ label, required, loading, emptyMessage, labelClassName, children }) {
  return (
    <div>
      <label
        className={
          labelClassName ||
          'block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1'
        }
      >
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

const inputClass =
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
  labelClassName = '',
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
      displayPath: formatRackDisplayName(rack),
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

  const branchOptions = useMemo(() => toBranchOptions(branches), [branches]);
  const floorOptions = useMemo(() => toFloorOptions(floors), [floors]);
  const rackOptions = useMemo(() => toRackOptions(racks), [racks]);

  const branchEmptyOption = showOptional
    ? { value: '', label: 'All branches', searchText: 'all branches' }
    : null;
  const floorEmptyOption = showOptional
    ? { value: '', label: 'All floors', searchText: 'all floors' }
    : null;
  const rackEmptyOption = showOptional
    ? { value: '', label: 'All racks', searchText: 'all racks' }
    : null;

  const selectedDisplay = useMemo(() => {
    if (!rackId) return '';
    const rack = racks.find((r) => String(r._id) === String(rackId));
    return formatRackDisplayName(rack);
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
        labelClassName={labelClassName || undefined}
      >
        <SearchableSelect
          options={branchOptions}
          value={branchId}
          disabled={disabled}
          placeholder={showOptional ? 'Search branches…' : 'Search branch…'}
          emptyOption={branchEmptyOption}
          inputClassName={inputClass}
          onChange={handleBranchChange}
        />
      </CascadeField>

      {(isHorizontal || branchId) && (
        <CascadeField
          label="Floor"
          required={required && !showOptional}
          loading={branchId ? floorsLoading : false}
          emptyMessage={branchId ? floorEmpty : null}
          labelClassName={labelClassName || undefined}
        >
          <SearchableSelect
            options={floorOptions}
            value={floorId}
            disabled={disabled || !branchId || !!floorEmpty}
            placeholder={showOptional ? 'Search floors…' : 'Search floor…'}
            emptyOption={floorEmptyOption}
            inputClassName={inputClass}
            onChange={handleFloorChange}
          />
        </CascadeField>
      )}

      {(isHorizontal || floorId) && (
        <CascadeField
          label="Rack"
          required={required && !showOptional}
          loading={floorId ? racksLoading : false}
          emptyMessage={floorId ? rackEmpty : null}
          labelClassName={labelClassName || undefined}
        >
          <SearchableSelect
            options={rackOptions}
            value={rackId}
            disabled={disabled || !floorId || !!rackEmpty}
            placeholder={showOptional ? 'Search racks…' : 'Search rack…'}
            emptyOption={rackEmptyOption}
            inputClassName={inputClass}
            onChange={handleRackChange}
          />
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
