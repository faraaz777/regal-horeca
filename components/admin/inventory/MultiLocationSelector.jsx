'use client';

import { useCallback, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import LocationSelector from '@/components/admin/inventory/LocationSelector';
import { validateLocationSelectionClient } from '@/lib/client/locationCascadeApi';

const EMPTY_DRAFT = {
  branchId: null,
  floorId: null,
  rackId: null,
  locationId: null,
  displayPath: '',
};

function parsePositiveInt(value) {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? 0 : n;
}

function clampRackQty(rawValue, rowQty, remaining, openingQty) {
  const parsed = parsePositiveInt(rawValue);
  if (parsed < 0) return 0;
  const maxForRow = remaining + (Number(rowQty) || 0);
  return Math.min(parsed, maxForRow, openingQty);
}

/**
 * @param {{
 *   value?: import('@/lib/shared/locationTypes').LocationOpeningLine[];
 *   onChange: (locations: import('@/lib/shared/locationTypes').LocationOpeningLine[]) => void;
 *   openingQty?: number | string;
 *   required?: boolean;
 *   disabled?: boolean;
 * }} props
 */
export default function MultiLocationSelector({
  value = [],
  onChange,
  openingQty = '',
  required = false,
  disabled = false,
}) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [draftQty, setDraftQty] = useState('');
  const [selectorKey, setSelectorKey] = useState(0);

  const openingQtyNum = parsePositiveInt(openingQty);
  const allocatedTotal = useMemo(
    () => value.reduce((sum, loc) => sum + (Number(loc.qty) || 0), 0),
    [value]
  );
  const remaining = openingQtyNum - allocatedTotal;
  const poolReady = openingQtyNum > 0;
  const rackSectionDisabled = disabled || !poolReady;

  const handleDraftChange = useCallback((selection) => {
    setDraft(selection);
  }, []);

  const addLocation = useCallback(() => {
    if (!poolReady) {
      toast.error('Enter opening quantity first');
      return;
    }
    if (remaining <= 0) {
      toast.error('All units are already allocated');
      return;
    }

    const check = validateLocationSelectionClient(draft);
    if (!check.valid) {
      toast.error(check.error || 'Select branch, floor, and rack');
      return;
    }

    const requested = parsePositiveInt(draftQty);
    if (requested < 1) {
      toast.error(`Enter 1–${remaining} for this rack`);
      return;
    }

    const qty = Math.min(requested, remaining);
    if (value.some((loc) => String(loc.locationId) === String(draft.locationId))) {
      toast.error('This location is already added');
      return;
    }

    onChange([...value, { ...draft, qty }]);
    setDraft(EMPTY_DRAFT);
    setDraftQty('');
    setSelectorKey((k) => k + 1);
  }, [draft, draftQty, onChange, poolReady, remaining, value]);

  const removeLocation = useCallback(
    (locationId) => {
      onChange(value.filter((loc) => String(loc.locationId) !== String(locationId)));
    },
    [onChange, value]
  );

  const updateLocationQty = useCallback(
    (locationId, rawValue) => {
      if (!poolReady) return;

      onChange(
        value.map((loc) => {
          if (String(loc.locationId) !== String(locationId)) return loc;
          const qty = clampRackQty(rawValue, loc.qty, remaining, openingQtyNum);
          return { ...loc, qty: qty || '' };
        })
      );
    },
    [onChange, openingQtyNum, poolReady, remaining, value]
  );

  return (
    <div className="space-y-3">
      {!poolReady && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          Enter the opening quantity above before assigning stock to racks.
        </p>
      )}

      <div className={rackSectionDisabled ? 'opacity-60 pointer-events-none' : ''}>
        <LocationSelector
          key={selectorKey}
          layout="horizontal"
          selectedBranchId={draft.branchId}
          selectedFloorId={draft.floorId}
          selectedRackId={draft.rackId}
          onChange={handleDraftChange}
          required={required}
          disabled={rackSectionDisabled}
        />

        <div className="flex flex-col sm:flex-row sm:items-end gap-3 mt-3">
          <div className="sm:w-36">
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Qty for this rack
              <span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              type="number"
              min="1"
              max={poolReady ? Math.max(remaining, 1) : undefined}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              value={draftQty}
              disabled={rackSectionDisabled}
              placeholder={poolReady ? `max ${remaining}` : '—'}
              onChange={(e) => {
                const next = parsePositiveInt(e.target.value);
                if (!e.target.value) {
                  setDraftQty('');
                  return;
                }
                if (poolReady && next > remaining) {
                  setDraftQty(String(remaining));
                  return;
                }
                setDraftQty(e.target.value);
              }}
            />
            {poolReady && remaining > 0 && (
              <p className="text-[10px] text-gray-400 mt-0.5">Up to {remaining} remaining</p>
            )}
          </div>
          <button
            type="button"
            onClick={addLocation}
            disabled={rackSectionDisabled || remaining <= 0}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-50"
          >
            <Plus size={14} />
            Add rack
          </button>
        </div>
      </div>

      {required && poolReady && value.length === 0 && (
        <p className="text-[11px] text-gray-500">Allocate stock to at least one rack</p>
      )}

      {value.length > 0 && (
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">
                <th className="px-3 py-2">Location</th>
                <th className="px-3 py-2 w-28">Allocated qty</th>
                <th className="px-3 py-2 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {value.map((loc) => {
                const rowMax = remaining + (Number(loc.qty) || 0);
                return (
                  <tr key={loc.locationId} className="bg-white">
                    <td
                      className="px-3 py-2 text-xs text-gray-800 font-mono truncate max-w-[240px]"
                      title={loc.displayPath}
                    >
                      {loc.displayPath || '—'}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        max={rowMax}
                        className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md"
                        value={loc.qty}
                        disabled={disabled}
                        onChange={(e) => updateLocationQty(loc.locationId, e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeLocation(loc.locationId)}
                        disabled={disabled}
                        className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                        aria-label="Remove location"
                      >
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
