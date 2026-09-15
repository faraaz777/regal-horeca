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
  const hasBody = children != null && children !== false;

  return (
    <section
      className={`bg-white border border-gray-200 rounded-xl shadow-sm ${
        compact ? 'p-4' : 'p-5 sm:p-6'
      } ${className}`}
    >
      {title ? (
        <header
          className={
            hasBody
              ? `border-b border-gray-100 ${compact ? 'mb-3 pb-2' : 'mb-5 pb-3'}`
              : ''
          }
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
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
              <div className="w-full shrink-0 sm:w-auto sm:max-w-[min(100%,28rem)]">{headerAction}</div>
            ) : null}
          </div>
        </header>
      ) : null}
      {hasBody ? <div className={compact ? 'space-y-3' : 'space-y-4'}>{children}</div> : null}
    </section>
  );
}
