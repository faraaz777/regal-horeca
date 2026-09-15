'use client';

import { PRODUCT_FORM_STEPS } from '@/components/product-form/constants';

/**
 * Horizontal wizard progress.
 * Active = black capsule (admin primary). Connectors fill for completed progress.
 * All steps stay clickable so operators can jump freely.
 */
export default function ProductFormStepper({ currentStep, onStepChange }) {
  const currentIndex = PRODUCT_FORM_STEPS.findIndex((s) => s.id === currentStep);
  const lastIndex = PRODUCT_FORM_STEPS.length - 1;

  return (
    <nav aria-label="Product form steps" className="w-full">
      <ol className="flex w-full items-center">
        {PRODUCT_FORM_STEPS.map((step, index) => {
          const isActive = step.id === currentStep;
          const isDone = index < currentIndex;
          const connectorFilled = index < currentIndex;
          const isLast = index === lastIndex;

          return (
            <li
              key={step.id}
              className={`flex items-center ${isLast ? 'shrink-0' : 'min-w-0 flex-1'}`}
            >
              <button
                type="button"
                onClick={() => onStepChange(step.id)}
                aria-current={isActive ? 'step' : undefined}
                className={`group relative z-[1] flex shrink-0 items-center gap-2 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 ${
                  isActive
                    ? 'bg-neutral-900 py-1.5 pl-2 pr-4 text-white shadow-sm sm:pr-5'
                    : isDone
                      ? 'border-2 border-neutral-900 bg-white py-1.5 pl-1.5 pr-3.5 text-neutral-900 hover:bg-neutral-50'
                      : 'bg-transparent py-1.5 pl-0.5 pr-2 text-neutral-500 hover:text-neutral-800'
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums ${
                    isActive
                      ? 'bg-white text-neutral-900'
                      : isDone
                        ? 'bg-neutral-900 text-white'
                        : 'bg-neutral-200 text-neutral-600 group-hover:bg-neutral-300'
                  }`}
                >
                  {isDone ? (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path
                        d="M2.5 6.2 4.8 8.5 9.5 3.5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </span>
                <span
                  className={`truncate text-xs font-semibold tracking-tight sm:text-[13px] ${
                    isActive ? 'text-white' : isDone ? 'text-neutral-900' : 'text-neutral-500'
                  }`}
                >
                  {step.label}
                </span>
              </button>

              {!isLast ? (
                <div
                  className="mx-2 h-[2px] min-w-[10px] flex-1 rounded-full sm:mx-3"
                  style={{ background: connectorFilled ? '#171717' : '#E5E7EB' }}
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
