'use client';

import { PRODUCT_FORM_STEPS } from '@/components/product-form/constants';

/**
 * Horizontal wizard progress. Clicking a completed/current step jumps there;
 * future steps stay reachable so operators can fill Media before Selling if they want.
 */
export default function ProductFormStepper({ currentStep, onStepChange }) {
  const currentIndex = PRODUCT_FORM_STEPS.findIndex((s) => s.id === currentStep);

  return (
    <nav aria-label="Product form steps" className="w-full">
      <ol className="flex items-center gap-1 sm:gap-2">
        {PRODUCT_FORM_STEPS.map((step, index) => {
          const isActive = step.id === currentStep;
          const isDone = index < currentIndex;
          return (
            <li key={step.id} className="flex flex-1 items-center min-w-0">
              <button
                type="button"
                onClick={() => onStepChange(step.id)}
                className={`flex w-full items-center justify-center gap-2 rounded-full px-2 sm:px-3 py-2 text-xs sm:text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isActive
                    ? 'bg-primary text-white shadow-sm'
                    : isDone
                      ? 'bg-primary/10 text-primary'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                aria-current={isActive ? 'step' : undefined}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] ${
                    isActive ? 'bg-white/20' : isDone ? 'bg-primary text-white' : 'bg-white text-gray-500'
                  }`}
                >
                  {index + 1}
                </span>
                <span className="truncate hidden xs:inline sm:inline">{step.label}</span>
              </button>
              {index < PRODUCT_FORM_STEPS.length - 1 ? (
                <span className="mx-1 hidden sm:block h-px w-3 bg-gray-200 shrink-0" aria-hidden />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
