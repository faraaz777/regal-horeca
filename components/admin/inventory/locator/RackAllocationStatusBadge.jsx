'use client';

const STATUS_CONFIG = {
  available: { label: 'Available', className: 'bg-emerald-100 text-emerald-800' },
  assigned_here: { label: 'Assigned here', className: 'bg-blue-100 text-blue-800' },
  assigned_elsewhere: { label: 'Assigned elsewhere', className: 'bg-amber-100 text-amber-800' },
  inactive: { label: 'Inactive', className: 'bg-gray-200 text-gray-600' },
  locked: { label: 'Locked', className: 'bg-slate-200 text-slate-700' },
};

export default function RackAllocationStatusBadge({ status, assignedZoneName }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.available;
  const label =
    status === 'assigned_elsewhere' && assignedZoneName
      ? `Zone ${assignedZoneName}`
      : cfg.label;

  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${cfg.className}`}>
      {label}
    </span>
  );
}
