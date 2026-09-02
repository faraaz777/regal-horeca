'use client';

/**
 * In-app confirm dialog for sales floor actions.
 * Replaces browser confirm() for submit / close tab / end session.
 */
export default function SalesConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmTone = 'primary',
  busy = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  const confirmClass =
    confirmTone === 'danger'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : 'bg-primary hover:opacity-90 text-white';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel?.();
      }}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-gray-200 overflow-hidden"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sales-confirm-title"
      >
        <div className="px-5 pt-5 pb-3">
          <h3 id="sales-confirm-title" className="text-base font-semibold text-gray-900">
            {title}
          </h3>
          {message && <p className="text-sm text-gray-600 mt-2 leading-relaxed">{message}</p>}
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-5 py-4 bg-gray-50 border-t border-gray-100">
          {cancelLabel !== null && (
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="min-h-[48px] px-5 py-3 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-white disabled:opacity-50"
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`min-h-[48px] px-5 py-3 text-sm font-semibold rounded-lg disabled:opacity-50 ${confirmClass}`}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
