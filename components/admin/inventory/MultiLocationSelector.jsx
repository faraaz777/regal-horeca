'use client';

import { useCallback, useState } from 'react';
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

/**
 * @param {{
 *   value?: import('@/lib/shared/locationTypes').LocationOpeningLine[];
 *   onChange: (locations: import('@/lib/shared/locationTypes').LocationOpeningLine[]) => void;
 *   required?: boolean;
 *   disabled?: boolean;
 * }} props
 */
export default function MultiLocationSelector({
  value = [],
  onChange,
  required = false,
  disabled = false,
}) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [draftQty, setDraftQty] = useState('');
  const [selectorKey, setSelectorKey] = useState(0);

  const handleDraftChange = useCallback((selection) => {
    setDraft(selection);
  }, []);

  const addLocation = useCallback(() => {
    const check = validateLocationSelectionClient(draft);
    if (!check.valid) {
      toast.error(check.error || 'Select branch, floor, and rack');
      return;
    }
    const qty = Number(draftQty);
    if (!qty || qty < 1) {
      toast.error('Enter a valid quantity for this location');
      return;
    }
    if (value.some((loc) => String(loc.locationId) === String(draft.locationId))) {
      toast.error('This location is already added');
      return;
    }
    onChange([...value, { ...draft, qty }]);
    setDraft(EMPTY_DRAFT);
    setDraftQty('');
    setSelectorKey((k) => k + 1);
  }, [draft, draftQty, onChange, value]);

  const removeLocation = useCallback(
    (locationId) => {
      onChange(value.filter((loc) => String(loc.locationId) !== String(locationId)));
    },
    [onChange, value]
  );

  const updateLocationQty = useCallback(
    (locationId, qty) => {
      onChange(
        value.map((loc) =>
          String(loc.locationId) === String(locationId) ? { ...loc, qty } : loc
        )
      );
    },
    [onChange, value]
  );

  return (
    <div className="space-y-3">
      <LocationSelector
        key={selectorKey}
        layout="horizontal"
        selectedBranchId={draft.branchId}
        selectedFloorId={draft.floorId}
        selectedRackId={draft.rackId}
        onChange={handleDraftChange}
        required={required}
        disabled={disabled}
      />

      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="sm:w-36">
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Qty for this location
            <span className="text-red-500 ml-0.5">*</span>
          </label>
          <input
            type="number"
            min="1"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            value={draftQty}
            disabled={disabled}
            placeholder="e.g. 10"
            onChange={(e) => setDraftQty(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={addLocation}
          disabled={disabled}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-50"
        >
          <Plus size={14} />
          Add location
        </button>
      </div>

      {required && value.length === 0 && (
        <p className="text-[11px] text-gray-500">Add at least one location with quantity</p>
      )}

      {value.length > 0 && (
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">
                <th className="px-3 py-2">Location</th>
                <th className="px-3 py-2 w-28">Opening qty</th>
                <th className="px-3 py-2 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {value.map((loc) => (
                <tr key={loc.locationId} className="bg-white">
                  <td className="px-3 py-2 text-xs text-gray-800 font-mono truncate max-w-[240px]" title={loc.displayPath}>
                    {loc.displayPath || '—'}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="1"
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
