'use client';

/**
 * Shared card wrapper for product-form sections.
 * Defined outside the form so inputs do not remount (and lose focus) on each keystroke.
 * Optional headerAction sits on the title row so controls do not add a second header band.
 */
export default function FormCard({
  title,
  description,
  headerAction = null,
  children,
  className = '',
  compact = false,
}) {
  return (
    <section
      className={`bg-white border border-gray-200 rounded-xl shadow-sm ${
        compact ? 'p-4' : 'p-5 sm:p-6'
      } ${className}`}
    >
      {title ? (
        <header className={`border-b border-gray-100 ${compact ? 'mb-3 pb-2' : 'mb-5 pb-3'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3
                className={`font-semibold text-gray-900 ${
                  compact ? 'text-base' : 'text-base sm:text-lg'
                }`}
              >
                {title}
              </h3>
              {description ? (
                <p className={`text-gray-500 ${compact ? 'mt-0.5 text-xs' : 'mt-1 text-sm'}`}>
                  {description}
                </p>
              ) : null}
            </div>
            {headerAction ? (
              <div className="shrink-0 self-center">{headerAction}</div>
            ) : null}
          </div>
        </header>
      ) : null}
      <div className={compact ? 'space-y-3' : 'space-y-4'}>{children}</div>
    </section>
  );
}
