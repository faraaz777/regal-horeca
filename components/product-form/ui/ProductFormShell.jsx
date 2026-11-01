'use client';

import { PRODUCT_FORM_STEPS } from '@/components/product-form/constants';
import { useProductForm } from '@/components/product-form/ProductFormContext';
import ProductFormStepper from '@/components/product-form/ui/ProductFormStepper';
import ReadinessCard from '@/components/product-form/ui/ReadinessCard';
import ProductIdentitySection from '@/components/product-form/sections/ProductIdentitySection';
import ProductSellingSection from '@/components/product-form/sections/ProductSellingSection';
import ProductMediaSection from '@/components/product-form/sections/ProductMediaSection';
import ProductContentSection from '@/components/product-form/sections/ProductContentSection';

const STEP_COMPONENTS = {
  product: ProductIdentitySection,
  selling: ProductSellingSection,
  media: ProductMediaSection,
  content: ProductContentSection,
};

const CONTINUE_LABEL = {
  product: 'Continue to Selling',
  selling: 'Continue to Media',
  media: 'Continue to Content',
};

/**
 * Layout shell: sticky stepper + main column + sticky readiness/actions rail.
 * Primary actions live in the right rail so operators never hunt a footer bar.
 */
export default function ProductFormShell() {
  const {
    currentStep,
    setCurrentStep,
    formData,
    variantRows,
    variantWorkflowEnabled,
    hasVariantsChoice,
    isUploading,
    isSubmitting,
    error,
    handleSubmit,
    onCancel,
    isChildProduct,
    enableLocalDraft,
    handleLocalDraftFieldComplete,
  } = useProductForm();

  const StepBody = STEP_COMPONENTS[currentStep] || ProductIdentitySection;
  const stepIndex = PRODUCT_FORM_STEPS.findIndex((s) => s.id === currentStep);
  const isLast = stepIndex === PRODUCT_FORM_STEPS.length - 1;

  const hasTitle = Boolean(String(formData.title || '').trim());
  const hasHero = Boolean(formData.heroImage);
  const hasBrandName = Boolean(String(formData.brand || '').trim());
  const hasCategory = Boolean(formData.categoryId);
  const hasSkuPath =
    isChildProduct ||
    (hasVariantsChoice === true && (variantRows || []).length > 0) ||
    (hasVariantsChoice === false && String(formData.sku || '').trim()) ||
    hasVariantsChoice === null;

  const missingRequired = [
    !hasTitle ? 'name' : null,
    !hasHero ? 'hero image' : null,
    !isChildProduct && !hasBrandName ? 'brand' : null,
    !isChildProduct && !hasCategory ? 'department' : null,
  ].filter(Boolean);
  const canSave = missingRequired.length === 0;
  const readinessItems = [
    { id: 'title', label: 'Product name', done: hasTitle },
    {
      id: 'brand',
      label: 'Brand',
      done: hasBrandName,
      hint: isChildProduct ? 'From the parent' : undefined,
    },
    {
      id: 'category',
      label: 'Category',
      done: hasCategory,
      hint: isChildProduct ? 'From the parent' : 'Department required',
    },
    { id: 'hero', label: 'Hero image', done: hasHero },
    {
      id: 'sell',
      label: variantWorkflowEnabled ? 'Default child SKU' : 'Selling type',
      done:
        hasVariantsChoice !== null &&
        (hasVariantsChoice === false ||
          ((variantRows || []).length > 0 && (variantRows || []).some((row) => row.isDefault))),
      hint: variantWorkflowEnabled ? 'Def radio in Variant SKUs' : 'Catalog-ready',
    },
  ];
  const catalogReadyCount = [hasTitle, hasBrandName, hasCategory, hasHero, hasSkuPath && hasVariantsChoice !== null].filter(
    Boolean
  ).length;

  const busy = isUploading || isSubmitting;
  const saveLabel = isUploading ? 'Uploading…' : isSubmitting ? 'Saving…' : 'Save product';

  const goNext = () => {
    const next = PRODUCT_FORM_STEPS[stepIndex + 1];
    if (next) setCurrentStep(next.id);
  };
  const goBack = () => {
    const prev = PRODUCT_FORM_STEPS[stepIndex - 1];
    if (prev) setCurrentStep(prev.id);
  };

  return (
    <div className="flex flex-col">
      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <form
        id="product-form"
        onSubmit={handleSubmit}
        onBlurCapture={enableLocalDraft ? handleLocalDraftFieldComplete : undefined}
        className="flex flex-col gap-6"
      >
        <div className="sticky top-0 z-30 -mx-1 border-b border-gray-200/80 bg-gray-100/95 px-2 py-3.5 backdrop-blur sm:px-3">
          <ProductFormStepper currentStep={currentStep} onStepChange={setCurrentStep} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0">
            <StepBody />
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start space-y-4">
            <ReadinessCard
              items={readinessItems}
              canSave={canSave}
              requiredLabel={missingRequired.join(' + ')}
              catalogReadyCount={catalogReadyCount}
              catalogReadyTotal={5}
            />

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-2">
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saveLabel}
              </button>
              {!isLast ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="w-full rounded-lg border border-primary bg-white px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/5"
                >
                  {CONTINUE_LABEL[currentStep] || 'Continue'}
                </button>
              ) : null}
              {stepIndex > 0 ? (
                <button
                  type="button"
                  onClick={goBack}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Back
                </button>
              ) : null}
              <button
                type="button"
                onClick={onCancel}
                className="w-full rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-200"
              >
                Cancel
              </button>
              <p className="text-[11px] text-gray-400">
                Save stays available on every step.{' '}
                {isChildProduct
                  ? 'Name and hero image are required.'
                  : 'Name, hero image, brand, and a department are required.'}
              </p>
            </div>
          </aside>
        </div>
      </form>
    </div>
  );
}
