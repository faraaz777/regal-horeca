'use client';

import LocationQtyCard from './LocationQtyCard';
import {
  shortLocationLabel,
  locationRackCode,
  locationRackName,
  locationCodePath,
} from '@/lib/client/inventory/locationLabels';

const MODE_CONFIG = {
  minus: {
    accent: 'amber',
    actionLabel: 'Remove',
    showMax: true,
    emptyMessage: 'No stock at any location.',
    emptyClass: 'text-sm text-amber-900 bg-amber-50 border border-amber-100 rounded-xl px-3 py-3',
  },
  add: {
    accent: 'emerald',
    actionLabel: 'Add',
    showMax: false,
    emptyMessage: 'No locations yet — add stock to a new rack below.',
    emptyClass: 'text-sm text-emerald-900 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-3',
  },
};

export default function LocationQtyList({ mode, rows, quantities, onQuantityChange }) {
  const config = MODE_CONFIG[mode] || MODE_CONFIG.minus;

  if (!rows?.length) {
    return <p className={config.emptyClass}>{config.emptyMessage}</p>;
  }

  return (
    <div className="space-y-2.5">
      {rows.map((row) => {
        const locId = String(row.locationId);
        const onHand = row.qty || 0;
        const qty = quantities[locId] ?? 0;
        const code = locationRackCode(row) || shortLocationLabel(row) || 'Rack';
        const name = locationRackName(row);
        const codePath = locationCodePath(row);

        return (
          <LocationQtyCard
            key={locId}
            code={code}
            name={name}
            codePath={codePath}
            onHand={onHand}
            qty={qty}
            max={mode === 'minus' ? onHand : undefined}
            onQtyChange={(next) => onQuantityChange(locId, next)}
            accent={config.accent}
            actionLabel={config.actionLabel}
            showMax={config.showMax}
            badge={
              mode === 'add' && row.isNew ? (
                <span className="shrink-0 inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                  New
                </span>
              ) : null
            }
          />
        );
      })}
    </div>
  );
}
