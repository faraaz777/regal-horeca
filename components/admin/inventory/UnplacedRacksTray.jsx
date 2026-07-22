'use client';

import { getRackStatusStyle } from '@/lib/client/locatorUtils';
import { formatRackDisplayName } from '@/lib/shared/locationDisplay';

export default function UnplacedRacksTray({ racks, onRackClick }) {
  if (!racks.length) {
    return (
      <div className="text-xs text-gray-400 italic px-2 py-4 text-center">
        All racks on this floor are assigned to zones.
      </div>
    );
  }

  return (
    <>
      <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1.5 mb-2">
        Unallocated racks — assign via a zone&apos;s <strong>Manage racks</strong> action.
      </p>
      <ul className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
        {racks.map((rack) => {
          const statusStyle = getRackStatusStyle(rack.stockStatus);
          return (
            <li
              key={rack._id}
              className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-2 py-2"
            >
              <button
                type="button"
                onClick={() => onRackClick?.(rack._id)}
                className="flex-1 text-left min-w-0"
              >
                <p className="text-xs font-mono font-semibold text-gray-800 truncate">
                  {formatRackDisplayName(rack)}
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {rack.sellableQty ?? rack.totalQty ?? 0} sellable
                </p>
              </button>
              <span
                className={`shrink-0 px-1.5 py-px rounded-full text-[9px] font-semibold ${statusStyle.fill} ${statusStyle.text}`}
              >
                {statusStyle.label}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
