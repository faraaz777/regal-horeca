'use client';

const CHIP_TONES = {
  emerald: {
    selected: 'border-emerald-400 bg-emerald-600 text-white',
    idle: 'border-emerald-200 bg-white text-emerald-900 hover:border-emerald-300 hover:bg-emerald-50',
  },
  amber: {
    selected: 'border-amber-400 bg-amber-600 text-white',
    idle: 'border-amber-200 bg-white text-amber-950 hover:border-amber-300 hover:bg-amber-50',
  },
  sky: {
    selected: 'border-sky-400 bg-sky-600 text-white',
    idle: 'border-sky-200 bg-white text-sky-950 hover:border-sky-300 hover:bg-sky-50',
  },
};

export default function ReasonChipRow({ options, labels, value, onChange, tone = 'amber' }) {
  const styles = CHIP_TONES[tone] || CHIP_TONES.amber;
  const cols =
    options.length <= 2
      ? 'grid-cols-2'
      : options.length === 3
        ? 'grid-cols-3'
        : 'grid-cols-2 sm:grid-cols-4';

  return (
    <div className={`grid ${cols} gap-2`}>
      {options.map((reason) => {
        const isSelected = value === reason;
        return (
          <button
            key={reason}
            type="button"
            onClick={() => onChange(reason)}
            className={`min-h-[44px] px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors leading-tight ${
              isSelected ? styles.selected : styles.idle
            }`}
          >
            {labels[reason] || reason}
          </button>
        );
      })}
    </div>
  );
}
