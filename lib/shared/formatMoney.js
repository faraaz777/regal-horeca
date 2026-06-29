/** Format paise as INR display string. */
export function formatPaise(paise) {
  const n = Number(paise) || 0;
  return `₹${(n / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function stockStatusClass(status) {
  if (status === 'in_stock') return 'text-emerald-700 bg-emerald-50';
  if (status === 'low') return 'text-amber-700 bg-amber-50';
  return 'text-red-700 bg-red-50';
}
