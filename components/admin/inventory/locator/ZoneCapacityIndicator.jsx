'use client';

export default function ZoneCapacityIndicator({ utilisationPercent }) {
  if (utilisationPercent == null) {
    return (
      <span className="text-[10px] text-gray-500">
        Capacity: <strong className="text-gray-700">—</strong>
      </span>
    );
  }

  const color =
    utilisationPercent >= 90
      ? 'text-red-600'
      : utilisationPercent >= 70
        ? 'text-amber-600'
        : 'text-emerald-600';

  return (
    <span className={`text-[10px] ${color}`}>
      Utilisation: <strong>{utilisationPercent}%</strong>
    </span>
  );
}
