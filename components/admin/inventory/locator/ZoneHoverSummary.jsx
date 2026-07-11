'use client';

import { memo } from 'react';

function ZoneHoverSummary({ zone, summary, zoom }) {
  if (!summary) return null;

  const s = summary;
  const scale = Math.min(1.1, Math.max(0.85, 1 / (zoom || 1)));

  return (
    <div
      className="absolute left-1/2 bottom-full z-50 pointer-events-none mb-2"
      style={{
        transform: `translateX(-50%) scale(${scale})`,
        transformOrigin: 'bottom center',
      }}
    >
      <div className="bg-gray-900/95 text-white text-xs rounded-lg px-3 py-2.5 shadow-xl min-w-[200px] border border-gray-700">
        <p className="font-bold text-sm mb-1.5">{zone.name || zone.code || 'Zone'}</p>
        <ul className="space-y-0.5 text-gray-200">
          <li>
            <strong className="text-white">{s.rackCount ?? 0}</strong> racks
          </li>
          <li>
            <strong className="text-white">{s.distinctProductCount ?? 0}</strong> products
          </li>
          <li>
            <strong className="text-white">{(s.totalQty ?? 0).toLocaleString()}</strong> total units
          </li>
          {s.utilisationPercent != null && (
            <li className="text-sky-300">{s.utilisationPercent}% capacity used</li>
          )}
          {(s.rackStatusCounts?.low > 0 || s.rackStatusCounts?.empty > 0) && (
            <li className="text-[10px] text-gray-400 pt-1 border-t border-gray-700 mt-1">
              {s.rackStatusCounts.low > 0 && `${s.rackStatusCounts.low} low stock`}
              {s.rackStatusCounts.low > 0 && s.rackStatusCounts.empty > 0 && ' · '}
              {s.rackStatusCounts.empty > 0 && `${s.rackStatusCounts.empty} empty`}
            </li>
          )}
          {(s.stockStatusQty?.hold > 0 || s.stockStatusQty?.scrap > 0) && (
            <li className="text-[10px] text-gray-400">
              {s.stockStatusQty.hold > 0 && `${s.stockStatusQty.hold} on hold`}
              {s.stockStatusQty.hold > 0 && s.stockStatusQty.scrap > 0 && ' · '}
              {s.stockStatusQty.scrap > 0 && `${s.stockStatusQty.scrap} scrap`}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

export default memo(ZoneHoverSummary);
