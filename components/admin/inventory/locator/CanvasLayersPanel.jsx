'use client';

import { useMemo, useState } from 'react';
import { Eye, EyeOff, Lock, Unlock } from 'lucide-react';
import { formatRackDisplayName } from '@/lib/shared/locationDisplay';

export default function CanvasLayersPanel({
  backgroundImage,
  zones,
  racks,
  unplacedRacks,
  selectedZoneId,
  selectedRackIds,
  onSelectZone,
  onSelectRack,
  onToggleZoneHidden,
  onToggleZoneLocked,
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const filteredZones = useMemo(
    () => (zones || []).filter((z) => !q || z.name?.toLowerCase().includes(q) || z.code?.toLowerCase().includes(q)),
    [zones, q]
  );

  const filteredRacks = useMemo(
    () =>
      (racks || []).filter(
        (r) => !q || r.code?.toLowerCase().includes(q) || r.name?.toLowerCase().includes(q)
      ),
    [racks, q]
  );

  return (
    <div className="space-y-2">
      <input
        type="search"
        placeholder="Search zones or racks…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md"
      />

      <section>
        <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Background</p>
        <p className="text-xs text-gray-600 px-1">
          {backgroundImage?.url ? 'Floor plan uploaded' : 'No floor plan'}
        </p>
      </section>

      <section>
        <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Zones ({filteredZones.length})</p>
        <ul className="space-y-0.5 max-h-32 overflow-y-auto">
          {filteredZones.map((z) => (
            <li key={z.id}>
              <div
                className={`w-full flex items-center gap-1 px-1.5 py-1 text-xs rounded ${
                  selectedZoneId === z.id ? 'bg-blue-50 text-blue-900' : 'hover:bg-gray-50 text-gray-700'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectZone?.(z.id)}
                  className="truncate flex-1 text-left"
                >
                  {z.name}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleZoneHidden?.(z.id)}
                  className="p-0.5 text-gray-400 hover:text-gray-600"
                >
                  {z.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleZoneLocked?.(z.id)}
                  className="p-0.5 text-gray-400 hover:text-gray-600"
                >
                  {z.locked ? <Lock size={12} /> : <Unlock size={12} />}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Racks ({filteredRacks.length})</p>
        <ul className="space-y-0.5 max-h-32 overflow-y-auto">
          {filteredRacks.map((r) => (
            <li key={r._id}>
              <button
                type="button"
                onClick={() => onSelectRack?.(r._id)}
                className={`w-full px-1.5 py-1 text-xs rounded text-left truncate ${
                  selectedRackIds?.has?.(r._id) ? 'bg-emerald-50 text-emerald-900' : 'hover:bg-gray-50 text-gray-700'
                }`}
              >
                {formatRackDisplayName(r)}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">
          Unplaced ({unplacedRacks?.length || 0})
        </p>
      </section>
    </div>
  );
}
