/**
 * Product Form
 *
 * Wizard shell over the existing parent/child save contract.
 * Sections consume ProductFormContext; this file owns state, validation,
 * barcode checks, and the payload built for POST/PUT + saveProductChildren.
 */

'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useAppContext } from '@/context/AppContext';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import {
  findDuplicateBarcodesInRows,
  validateVariantBarcodesAgainstCatalog,
} from '@/lib/utils/validateVariantBarcodes';
import { stripChildVariantOwnedFields } from '@/lib/shared/childVariantPayload';
import {
  parseOptionValues,
  getVariantCombinationKey,
  buildVariantCombinations,
  ensureBlankRowVariantFieldSelection,
  inferVariantFieldSelection,
  buildVariantBuilderInputsFromRows,
  validateVariantRowsAgainstAxes,
} from '@/lib/shared/variantMatrix';
import {
  convertSpecsToJson as serializeSpecificationsJson,
  parseSpecificationsJson,
} from '@/lib/shared/specificationsJson';
import {
  buildProductAddDraft,
  isMeaningfulProductDraft,
  saveProductAddDraft,
  clearProductAddDraft,
} from '@/lib/client/productFormDraft';
import { adminFetch } from '@/lib/client/adminFetch';
import {
  getTextLength,
  plainTextToHtml,
  sanitizeNumberInput,
  generatePersistedVariantId,
  resolveVariantRowImages,
} from '@/components/product-form/lib/formatters';
import {
  AVAILABLE_COLORS,
  ensureOneDefaultColorVariant,
  resolveColorDisplay,
} from '@/components/product-form/lib/colors';
import { uploadProductFile } from '@/components/product-form/lib/uploadProductFile';
import {
  generateTags as generateProductTags,
  mergeProductTags,
  normalizeTag,
} from '@/components/product-form/lib/generateProductTags';
import { getCategoryAncestry, getBrandAncestry } from '@/components/product-form/lib/taxonomyAncestry';
import { ProductFormProvider } from '@/components/product-form/ProductFormContext';
import ProductFormShell from '@/components/product-form/ui/ProductFormShell';

/**
 * Commercial default is the child SKU (Def).
 * Always keep exactly one default row whenever the matrix is non-empty.
 */
function ensureOneDefaultVariantRow(rows = []) {
  const list = Array.isArray(rows) ? rows.map((row) => ({ ...row })) : [];
  if (list.length === 0) return list;
  const firstDefaultIndex = list.findIndex((row) => row.isDefault);
  const keepIndex = firstDefaultIndex >= 0 ? firstDefaultIndex : 0;
  return list.map((row, index) => ({
    ...row,
    isDefault: index === keepIndex,
  }));
}

export default function ProductForm({
  product,
  allProducts = [],
  onSave,
  onCancel,
  onCategoryChange,
  onVariantsOnlyChange,
  onOpenParent,
  initialView = 'full',
  saving = false,
  /** Add-product only: localStorage draft on blur + variant changes. */
  enableLocalDraft = false,
  /** Draft payload restored by the Add page (auto-restore on reload). */
  initialLocalDraft = null,
}) {
  const { categories, brands, businessTypes } = useAppContext();
  
  const [formData, setFormData] = useState({
    title: '',
    brand: '',
    manufacturer: '',
    sku: '',
    barcode: '',
    hsnCode: '',
    brandCategoryId: '',
    brandCategoryIds: [],
    categoryId: '',
    categoryIds: [],
    summary: '',
    description: '',
    usageAndCare: '',
    whyBuyFrom: '',
    price: 0,
    priceBySize: [],
    originalPrice: null,
    unit: '',
    gstPercent: 0,
    mrp: 0,
    sellingPrice: 0,
    discountPercent: 0,
    marginPrice: 0,
    businessTypeSlugs: [],
    heroImage: '',
    gallery: [],
    specifications: [],
    faqs: [],
    testimonials: [],
    detailPhotos: [],
    relatedProductIds: [],
    frequentlyOrderedTogetherProductIds: [],
    featured: false,
    tags: [],
    tagsInput: '',
    status: 'In Stock',
    sizeChartUrl: '',
    brochureUrl: '',
    blogUrl: '',
    colorVariants: [],
    filters: [{ key: 'Material', values: [] }, { key: 'Size', values: [] }],
    availableSizes: '', // Optional field for comma-separated sizes
  });

  const [isUploading, setIsUploading] = useState(false);
  const [currentStep, setCurrentStep] = useState(() =>
    initialView === 'variants' ? 'selling' : 'product'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categorySelection, setCategorySelection] = useState({});
  const [additionalCategorySelections, setAdditionalCategorySelections] = useState([]);
  const [brandSelection, setBrandSelection] = useState({});
  const [additionalBrandSelections, setAdditionalBrandSelections] = useState([]);
  const [brandSuggestions, setBrandSuggestions] = useState([]);
  const [showBrandSuggestions, setShowBrandSuggestions] = useState(false);
  const [brandInputFocused, setBrandInputFocused] = useState(false);
  const brandInputRef = useRef(null);
  const brandSuggestionsRef = useRef(null);
  const [error, setError] = useState('');
  const initializedProductIdRef = useRef(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [customColorHex, setCustomColorHex] = useState('#000000');
  const [customColorName, setCustomColorName] = useState('');
  const [generatedTagsPreview, setGeneratedTagsPreview] = useState([]);
  const [showTagsPreview, setShowTagsPreview] = useState(false);
  const autoTagDebounceRef = useRef(null);
  const [relatedProductsSearchQuery, setRelatedProductsSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [variantFieldSelection, setVariantFieldSelection] = useState({
    size: false,
    color: false,
    weight: false,
    unitCount: false,
  });
  const [variantBuilderInputs, setVariantBuilderInputs] = useState({
    size: '',
    color: '',
    weight: '',
    unitCount: '',
  });
  const [variantDraftValue, setVariantDraftValue] = useState({
    size: '',
    color: '',
    weight: '',
    unitCount: '',
  });
  const [variantRows, setVariantRows] = useState([]);
  const [selectedVariantRowIndex, setSelectedVariantRowIndex] = useState(null);
  /** null = not chosen yet (new product); true/false = variant vs standalone workflow. */
  const [hasVariantsChoice, setHasVariantsChoice] = useState(null);
  const [recentlyDeletedVariantRow, setRecentlyDeletedVariantRow] = useState(null);
  /** Child product ids loaded with this parent — used to soft-delete rows removed from the table. */
  const initialChildIdsRef = useRef([]);
  const isCreatingMultipleVariants = (variantRows || []).length > 0;
  const selectedVariantFieldCount = Object.values(variantFieldSelection).filter(Boolean).length;
  const isExistingProductRecord = Boolean(product?._id || product?.id);

  /** Child variant rows are edited as a single SKU; only parents/standalones host the variant matrix. */
  const isChildProduct = useMemo(() => product?.productType === 'child', [product?.productType]);

  const variantWorkflowEnabled = !isChildProduct && hasVariantsChoice === true;
  const showStandaloneCommerceFields = !isChildProduct && hasVariantsChoice === false;
  const awaitingVariantChoice = !isChildProduct && !isExistingProductRecord && hasVariantsChoice === null;

  const [bulkVariantInputs, setBulkVariantInputs] = useState({
    name: '',
    unit: '',
    sku: '',
    barcode: '',
    hsnCode: '',
    gstPercent: '',
    mrp: '',
    sellingPrice: '',
    discountPercent: '',
    marginPrice: '',
    /** '' = skip on Apply | 'yes' = all in catalog | 'no' = all off */
    showInCatalog: '',
  });

  /**
   * Add-product local draft (Strategy A).
   * Blur → persist. Variant section changes → persist immediately.
   * beforeunload warns while meaningful work exists and leave is not allowed.
   */
  const localDraftAppliedRef = useRef(false);
  const suppressLocalDraftWriteRef = useRef(false);
  const allowLeaveWithoutWarningRef = useRef(false);
  const localDraftStateRef = useRef({});
  const [localDraftRestored, setLocalDraftRestored] = useState(false);

  localDraftStateRef.current = {
    formData,
    variantRows,
    variantFieldSelection,
    variantBuilderInputs,
    variantDraftValue,
    hasVariantsChoice,
    currentStep,
    bulkVariantInputs,
  };

  const persistLocalDraft = () => {
    if (!enableLocalDraft || suppressLocalDraftWriteRef.current) return;
    const result = saveProductAddDraft(localDraftStateRef.current);
    if (!result.ok && result.error === 'QuotaExceededError') {
      toast.error('Local draft could not be saved — browser storage is full.');
    }
  };

  const handleLocalDraftFieldComplete = (event) => {
    if (!enableLocalDraft) return;
    const target = event?.target;
    if (!target || typeof target.tagName !== 'string') return;
    const tag = target.tagName.toUpperCase();
    const isTextField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    const isRichText = Boolean(target.isContentEditable);
    if (!isTextField && !isRichText) return;
    // Ignore pure focus shifts inside the same control group without a completed edit.
    if (target.type === 'button' || target.type === 'submit' || target.type === 'file') return;
    persistLocalDraft();
  };

  // Auto-restore draft once on Add (initialLocalDraft from the page).
  useEffect(() => {
    if (!enableLocalDraft || localDraftAppliedRef.current) return;
    if (!initialLocalDraft || typeof initialLocalDraft !== 'object') return;

    suppressLocalDraftWriteRef.current = true;
    localDraftAppliedRef.current = true;

    const draftForm = initialLocalDraft.formData || {};
    setFormData((prev) => ({
      ...prev,
      ...draftForm,
      colorVariants: ensureOneDefaultColorVariant(draftForm.colorVariants || []),
      gallery: Array.isArray(draftForm.gallery) ? draftForm.gallery : [],
      specifications: Array.isArray(draftForm.specifications) ? draftForm.specifications : [],
      faqs: Array.isArray(draftForm.faqs) ? draftForm.faqs : [],
      filters: Array.isArray(draftForm.filters) && draftForm.filters.length > 0
        ? draftForm.filters
        : prev.filters,
    }));

    const restoredRows = Array.isArray(initialLocalDraft.variantRows)
      ? initialLocalDraft.variantRows.map((row) => ({
          ...row,
          _rowId: row?._rowId || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        }))
      : [];
    setVariantRows(ensureOneDefaultVariantRow(restoredRows));

    if (initialLocalDraft.variantFieldSelection) {
      setVariantFieldSelection({
        size: false,
        color: false,
        weight: false,
        unitCount: false,
        ...initialLocalDraft.variantFieldSelection,
      });
    }
    if (initialLocalDraft.variantBuilderInputs) {
      setVariantBuilderInputs({
        size: '',
        color: '',
        weight: '',
        unitCount: '',
        ...initialLocalDraft.variantBuilderInputs,
      });
    }
    if (initialLocalDraft.variantDraftValue) {
      setVariantDraftValue({
        size: '',
        color: '',
        weight: '',
        unitCount: '',
        ...initialLocalDraft.variantDraftValue,
      });
    }
    if (initialLocalDraft.bulkVariantInputs) {
      setBulkVariantInputs((prev) => ({ ...prev, ...initialLocalDraft.bulkVariantInputs }));
    }
    if (initialLocalDraft.hasVariantsChoice === true || initialLocalDraft.hasVariantsChoice === false) {
      setHasVariantsChoice(initialLocalDraft.hasVariantsChoice);
    }
    if (initialLocalDraft.currentStep) {
      setCurrentStep(initialLocalDraft.currentStep);
    }

    setLocalDraftRestored(true);
    // Allow writes on the next tick after React commits restored state.
    queueMicrotask(() => {
      suppressLocalDraftWriteRef.current = false;
    });
  }, [enableLocalDraft, initialLocalDraft]);

  // Rebuild category/brand pickers after draft restore once taxonomy is loaded.
  useEffect(() => {
    if (!enableLocalDraft || !localDraftRestored) return;
    if (!categories?.length && !brands?.length) return;

    const categoryId = formData.categoryId;
    if (categoryId && categories.length > 0) {
      setCategorySelection(getCategoryAncestry(categoryId, categories));
    }
    const categoryIds = Array.isArray(formData.categoryIds) ? formData.categoryIds : [];
    if (categoryIds.length > 0 && categories.length > 0) {
      setAdditionalCategorySelections(
        categoryIds.map((cid) => getCategoryAncestry(cid?._id || cid, categories))
      );
    }
    const brandCategoryId = formData.brandCategoryId;
    if (brandCategoryId && brands.length > 0) {
      setBrandSelection(getBrandAncestry(brandCategoryId, brands));
    }
    const brandCategoryIds = Array.isArray(formData.brandCategoryIds) ? formData.brandCategoryIds : [];
    if (brandCategoryIds.length > 0 && brands.length > 0) {
      setAdditionalBrandSelections(
        brandCategoryIds.map((bid) => getBrandAncestry(bid?._id || bid, brands))
      );
    }
    // Only when taxonomy arrives after restore — not on every formData keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableLocalDraft, localDraftRestored, categories, brands]);

  // Variant section: persist everything on any change (not only blur).
  useEffect(() => {
    if (!enableLocalDraft || suppressLocalDraftWriteRef.current) return;
    if (!localDraftAppliedRef.current && initialLocalDraft) return;
    persistLocalDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enableLocalDraft,
    variantRows,
    variantFieldSelection,
    variantBuilderInputs,
    variantDraftValue,
    hasVariantsChoice,
    bulkVariantInputs,
    formData.colorVariants,
  ]);

  // Also persist when media URLs land (upload complete is not a blur).
  useEffect(() => {
    if (!enableLocalDraft || suppressLocalDraftWriteRef.current) return;
    if (!formData.heroImage && !(formData.gallery || []).length) return;
    persistLocalDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableLocalDraft, formData.heroImage, formData.gallery, formData.detailPhotos]);

  // Browser leave / reload / close-tab warning (not in-app route changes).
  useEffect(() => {
    if (!enableLocalDraft) return;

    const onBeforeUnload = (event) => {
      if (allowLeaveWithoutWarningRef.current) return;
      const snapshot = buildProductAddDraft(localDraftStateRef.current);
      if (!isMeaningfulProductDraft(snapshot)) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [enableLocalDraft]);

  /** Sellable colour for this child row (parent Variants → Colour column), not marketing swatches. */
  const childAssignedColorName = useMemo(() => {
    if (!isChildProduct) return '';
    return String(
      product?.variationAttributes?.color ?? formData?.variationAttributes?.color ?? ''
    ).trim();
  }, [
    isChildProduct,
    product?.variationAttributes?.color,
    formData?.variationAttributes?.color,
  ]);

  const childAssignedColorDisplay = useMemo(
    () =>
      resolveColorDisplay(
        product?.variationAttributes?.colorDetails ||
          product?.variationAttributes ||
          formData?.variationAttributes?.colorDetails ||
          formData?.variationAttributes ||
          childAssignedColorName,
        formData.colorVariants
      ),
    [
      childAssignedColorName,
      formData.colorVariants,
      product?.variationAttributes,
      formData?.variationAttributes,
    ]
  );

  const childAssignedColorIsPredefined = useMemo(() => {
    if (!childAssignedColorName) return false;
    return AVAILABLE_COLORS.some(
      (c) => c.name.toLowerCase() === childAssignedColorName.toLowerCase()
    );
  }, [childAssignedColorName]);

  useEffect(() => {
    if (isChildProduct) return;
    /**
     * Add-product local draft owns the variant yes/no choice on restore.
     * Skipping here avoids overwriting the restored value with null.
     */
    if (enableLocalDraft && initialLocalDraft && !(product?._id || product?.id)) {
      return;
    }
    const productId = product?._id || product?.id;
    if (productId) {
      const isParent = product?.productType === 'parent';
      const hasChildren = Array.isArray(product?.children) && product.children.length > 0;
      const hasEmbeddedVariants = Array.isArray(product?.variants) && product.variants.length > 0;
      setHasVariantsChoice(isParent || hasChildren || hasEmbeddedVariants);
      return;
    }
    if (product) {
      const isParent = product?.productType === 'parent';
      const hasEmbeddedVariants = Array.isArray(product?.variants) && product.variants.length > 0;
      setHasVariantsChoice(isParent || hasEmbeddedVariants);
      return;
    }
    setHasVariantsChoice(null);
  }, [isChildProduct, product, enableLocalDraft, initialLocalDraft]);

  useEffect(() => {
    if (typeof onVariantsOnlyChange === 'function') {
      onVariantsOnlyChange(currentStep === 'selling' && variantWorkflowEnabled);
    }
  }, [currentStep, variantWorkflowEnabled, onVariantsOnlyChange]);

  useEffect(() => {
    // Parent SKU/Barcode should stay empty when variant-level SKU/Barcode are used.
    if (!isCreatingMultipleVariants) return;
    setFormData((prev) => {
      if (!prev?.sku && !prev?.barcode) return prev;
      return {
        ...prev,
        sku: '',
        barcode: '',
      };
    });
  }, [isCreatingMultipleVariants]);

  useEffect(() => {
    if (product?.productType === 'child') {
      initialChildIdsRef.current = [];
      setVariantRows([]);
      setVariantFieldSelection({ size: false, color: false, weight: false, unitCount: false });
      return;
    }

    /**
     * Do not clear the SKU table when Add is hydrating from a local draft
     * (product is null / has no children).
     */
    if (enableLocalDraft && initialLocalDraft && !(product?._id || product?.id)) {
      return;
    }

    // New parent/child variants take precedence over legacy embedded variants.
    // Only active (non–soft-deleted) children belong in the edit table.
    const allChildren = Array.isArray(product?.children) ? product.children : null;
    const activeChildren = allChildren
      ? allChildren.filter((child) => !child?.deletedAt)
      : null;
    const legacyVariants = Array.isArray(product?.variants) ? product.variants : [];
    const isParentCarrier = product?.productType === 'parent';

    let incomingVariants = [];
    if (activeChildren && activeChildren.length > 0) {
      incomingVariants = activeChildren.map((child) => {
        const attrs = child.variationAttributes || {};
        const colorName = attrs.color || '';
        const colorHex = attrs.colorHex || attrs.colorDetails?.colorHex || '';
        const colorSwatch = attrs.colorSwatch || attrs.colorDetails?.swatch || '';
        const colorDetails = attrs.colorDetails || (colorName ? { colorName, colorHex, swatch: colorSwatch } : null);
        return {
          variantId: '',
          name: child.title,
          size: attrs.size || '',
          unit: attrs.unit || '',
          color: colorName,
          colorHex,
          colorSwatch,
          colorDetails,
          unitCount: attrs.unitCount || '',
          weight: attrs.weight || '',
          isDefault: String(product?.defaultChildProductId || '') === String(child._id || ''),
          showInCatalog:
            child.showInCatalog === true ||
            (child.showInCatalog == null && child.visibleOnClient !== false),
          images: Array.isArray(child.gallery) ? child.gallery.filter(Boolean) : [],
          sku: child.sku || '',
          barcode: child.barcode || '',
          hsnCode: child.hsnCode || '',
          gstPercent: Number(child.gstPercent || 0),
          mrp: Number(child.mrp || 0),
          sellingPrice: Number(child.sellingPrice || child.price || 0),
          discountPercent: Number(child.discountPercent || 0),
          marginPrice: Number(child.marginPrice || 0),
          price: Number(child.sellingPrice || child.price || 0),
          _childProductId: child._id || null,
          _legacyParentVariantId: child.legacyParentVariantId || '',
        };
      });
    } else if (!isParentCarrier && legacyVariants.length > 0) {
      // Standalone products still using embedded variants only (not migrated to children).
      incomingVariants = legacyVariants;
    }

    if (incomingVariants.length === 0) {
      initialChildIdsRef.current = [];
      setVariantRows([]);
      return;
    }

    const normalized = incomingVariants.map((variant) => {
      const colorName = String(variant?.color || '').trim();
      const resolvedColor = resolveColorDisplay(
        variant?.colorDetails || (variant?.colorHex ? { colorName, colorHex: variant.colorHex, swatch: variant.colorSwatch } : colorName),
        formData.colorVariants || product?.colorVariants
      );
      const colorHex = String(variant?.colorHex || resolvedColor?.colorHex || '').trim();
      const colorSwatch = String(variant?.colorSwatch || resolvedColor?.swatch || '').trim();
      const colorDetails = variant?.colorDetails || (colorName ? {
        colorName,
        colorHex,
        swatch: colorSwatch,
      } : null);

      return {
        _rowId: createVariantRowId(),
        variantId: String(variant?.variantId || '').trim() || generatePersistedVariantId(),
        name: String(variant?.name || '').trim() || String(product?.title || ''),
        size: String(variant?.size || '').trim(),
        unit: String(variant?.unit || '').trim(),
        color: colorName,
        colorHex,
        colorSwatch,
        colorDetails,
        unitCount: String(variant?.unitCount || '').trim(),
        weight: String(variant?.weight || '').trim(),
        isDefault: Boolean(variant?.isDefault),
        showInCatalog: variant?.showInCatalog === true,
        images: Array.isArray(variant?.images) ? variant.images.filter(Boolean) : [],
        sku: String(variant?.sku || '').trim(),
        barcode: String(variant?.barcode || '').trim(),
        hsnCode: String(variant?.hsnCode || '').trim(),
        gstPercent: Number(variant?.gstPercent || 0),
        mrp: Number(variant?.mrp || 0),
        sellingPrice: Number(variant?.sellingPrice || variant?.price || 0),
        discountPercent: Number(variant?.discountPercent || 0),
        marginPrice: Number(variant?.marginPrice || 0),
        price: Number(variant?.sellingPrice || variant?.price || 0),
        // Persist child product id when hydrating from `product.children` so callers
        // can issue PATCH/DELETE against the existing variant rather than recreating it.
        _childProductId: variant?._childProductId || null,
        _legacyParentVariantId: variant?._legacyParentVariantId || '',
      };
    });

    initialChildIdsRef.current = normalized
      .map((row) => row._childProductId)
      .filter(Boolean)
      .map((id) => String(id));

    setVariantRows(ensureOneDefaultVariantRow(normalized));

    /**
     * Prefer saved variationTheme so Size/Colour columns stay visible even when
     * rows were left blank; fall back to non-empty row attributes.
     * Also restore chip values so Generate can rebuild the matrix on edit.
     */
    setVariantFieldSelection(
      inferVariantFieldSelection({
        rows: normalized,
        variationTheme: product?.variationTheme,
      })
    );
    setVariantBuilderInputs(buildVariantBuilderInputsFromRows(normalized));
  }, [product, enableLocalDraft, initialLocalDraft]);

  // Price-by-size helpers
  const addPriceBySizeRow = () => {
    const next = [...(formData.priceBySize || []), { price: '', size: '', unit: '' }];
    setFormData((prev) => ({ ...prev, priceBySize: next }));
  };

  const removePriceBySizeRow = (index) => {
    const next = (formData.priceBySize || []).filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, priceBySize: next }));
  };

  const handlePriceBySizeChange = (index, field, value) => {
    const next = (formData.priceBySize || []).map((row, i) =>
      i === index ? { ...row, [field]: value } : row
    );
    setFormData((prev) => ({ ...prev, priceBySize: next }));
  };

  const handleVariantFieldToggle = (field) => {
    setVariantFieldSelection((prev) => {
      if (prev[field]) {
        setError('');
        return {
          ...prev,
          [field]: false,
        };
      }

      const selectedCount = Object.values(prev).filter(Boolean).length;
      if (selectedCount >= 2) {
        setError('You can select only 2 variant fields at a time.');
        return prev;
      }

      setError('');
      return {
        ...prev,
        [field]: true,
      };
    });
  };

  const addVariantOptionValue = (field) => {
    const nextValue = String(variantDraftValue[field] || '').trim();
    if (!nextValue) return;

    const existing = parseOptionValues(variantBuilderInputs[field]);
    const exists = existing.some((value) => value.toLowerCase() === nextValue.toLowerCase());
    const nextList = exists ? existing : [...existing, nextValue];

    setVariantBuilderInputs((prev) => ({
      ...prev,
      [field]: nextList.join(', '),
    }));
    setVariantDraftValue((prev) => ({
      ...prev,
      [field]: '',
    }));
  };

  const removeVariantOptionValue = (field, valueToRemove) => {
    const nextList = parseOptionValues(variantBuilderInputs[field]).filter(
      (value) => value.toLowerCase() !== String(valueToRemove || '').trim().toLowerCase()
    );
    setVariantBuilderInputs((prev) => ({
      ...prev,
      [field]: nextList.join(', '),
    }));
  };

  const renderVariantOptionValueChips = (field) => {
    const values = parseOptionValues(variantBuilderInputs[field]);
    if (values.length === 0) {
      return <p className="mt-2 text-xs text-gray-400">No values yet — add one above.</p>;
    }
    return (
      <ul className="mt-2 flex list-none flex-wrap gap-1.5">
        {values.map((value) => (
          <li
            key={`${field}-${value}`}
            className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs font-medium text-gray-800"
          >
            <span>{value}</span>
            <button
              type="button"
              onClick={() => removeVariantOptionValue(field, value)}
              className="inline-flex h-4 w-4 items-center justify-center rounded text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
              title={`Remove ${value}`}
              aria-label={`Remove ${value}`}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    );
  };

  /** Colour names from parent colorVariants — source of truth for the variant matrix. */
  const fullFormColorNames = useMemo(
    () =>
      (formData.colorVariants || [])
        .map((v) => String(v?.colorName || '').trim())
        .filter(Boolean),
    [formData.colorVariants]
  );

  /** Color options for variant rows:
   * - When parent product has selected colours, STRICTLY show only those parent colours
   *   (plus any existing saved row colours so existing data is never hidden).
   * - Only if NO parent colours have been chosen at all, fall back to the 17 predefined colours.
   */
  const variantTableColorOptions = useMemo(() => {
    const seen = new Set();
    const out = [];
    const parentColors = formData.colorVariants || [];
    const hasParentColors = parentColors.length > 0;

    const add = (colorObjOrName, isParent = false) => {
      const rawName =
        typeof colorObjOrName === 'string'
          ? colorObjOrName
          : colorObjOrName?.colorName || colorObjOrName?.name;
      const label = String(rawName || '').trim();
      if (!label) return;
      const key = label.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);

      const resolved = resolveColorDisplay(
        typeof colorObjOrName === 'object' ? colorObjOrName : label,
        formData.colorVariants
      );

      out.push({
        name: resolved?.colorName || label,
        hex: resolved?.colorHex || '#CCCCCC',
        swatch: resolved?.swatch || '',
        isParentColor:
          isParent ||
          parentColors.some(
            (cv) => String(cv?.colorName || '').trim().toLowerCase() === key
          ),
      });
    };

    // 1. Parent selected colors first (including custom colors)
    parentColors.forEach((cv) => add(cv, true));

    // 2. Existing row colors (ensures legacy/saved variants don't lose their selected option)
    (variantRows || []).forEach((row) => {
      if (row?.colorDetails) {
        add(row.colorDetails, false);
      } else if (row?.color) {
        add({ colorName: row.color, colorHex: row.colorHex, swatch: row.colorSwatch }, false);
      }
    });

    // 3. Fallback: ONLY include predefined catalog colors if NO parent colors were selected
    if (!hasParentColors) {
      AVAILABLE_COLORS.forEach((c) => add(c, false));
    }

    return out;
  }, [formData.colorVariants, variantRows]);

  const createVariantRowId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const createEmptyVariantRow = () => ({
    _rowId: createVariantRowId(),
    variantId: generatePersistedVariantId(),
    name: formData.title || '',
    size: '',
    unit: '',
    color: '',
    colorHex: '',
    colorSwatch: '',
    colorDetails: null,
    unitCount: '',
    weight: '',
    isDefault: false,
    showInCatalog: true,
    images: [],
    sku: '',
    barcode: '',
    hsnCode: '',
    gstPercent: 0,
    mrp: 0,
    sellingPrice: 0,
    discountPercent: 0,
    marginPrice: 0,
    price: '',
  });

  /**
   * Variant Matrix Generator
   *
   * Input examples:
   *   Size = [S, M, L]                         → 3 rows (m)
   *   Size = [S, M, L], Colour = [Black]       → 3 rows (m×n)
   *   Size = [10", 12"], Colour = [Black, Gold] → 6 rows (m×n)
   *
   * Cartesian product of 1–2 selected axes. Matching existing rows are kept.
   */
  const handleGenerateVariantRows = () => {
    const dimensions = [];

    if (variantFieldSelection.size) {
      const values = parseOptionValues(variantBuilderInputs.size);
      if (values.length === 0) {
        setError('Please enter at least one Size value.');
        return;
      }
      dimensions.push({ key: 'size', values });
    }

    if (variantFieldSelection.color) {
      const values = fullFormColorNames;
      if (values.length === 0) {
        setError(
          'Select colours in the Colours section above before generating colour variants.'
        );
        return;
      }
      dimensions.push({ key: 'color', values });
    }

    if (variantFieldSelection.weight) {
      const values = parseOptionValues(variantBuilderInputs.weight);
      if (values.length === 0) {
        setError('Please enter at least one Weight value.');
        return;
      }
      dimensions.push({ key: 'weight', values });
    }

    if (variantFieldSelection.unitCount) {
      const values = parseOptionValues(variantBuilderInputs.unitCount);
      if (values.length === 0) {
        setError('Please enter at least one Unit Count value.');
        return;
      }
      dimensions.push({ key: 'unitCount', values });
    }

    if (dimensions.length === 0) {
      setError('Please tick at least one variant field to generate variants.');
      return;
    }

    if (dimensions.length > 2) {
      setError('You can generate variants from at most 2 axes at a time.');
      return;
    }

    let combos;
    try {
      combos = buildVariantCombinations(dimensions);
    } catch (err) {
      setError(err?.message || 'Unable to build the variant matrix.');
      return;
    }

    if (combos.length === 0) {
      setError('Add at least one value for each selected axis before generating.');
      return;
    }

    const existingByKey = new Map((variantRows || []).map((row) => [getVariantCombinationKey(row), row]));

    const nextRows = combos.map((combo) => {
      const key = getVariantCombinationKey(combo);
      const existing = existingByKey.get(key);
      if (existing) {
        const vid = String(existing.variantId || '').trim();
        return vid ? existing : { ...existing, variantId: generatePersistedVariantId() };
      }

      const colorName = combo.color || '';
      const colorDisplay = resolveColorDisplay(colorName, formData.colorVariants);

      return {
        ...createEmptyVariantRow(),
        size: combo.size || '',
        unit: '',
        color: colorName,
        colorHex: colorDisplay?.colorHex || '',
        colorSwatch: colorDisplay?.swatch || '',
        colorDetails: colorDisplay
          ? {
              colorName: colorDisplay.colorName,
              colorHex: colorDisplay.colorHex,
              swatch: colorDisplay.swatch || '',
            }
          : null,
        unitCount: combo.unitCount || '',
        weight: combo.weight || '',
      };
    });

    setError('');
    setVariantRows(ensureOneDefaultVariantRow(nextRows));
  };

  const handleVariantRowChange = (index, field, value) => {
    setVariantRows((prev) =>
      prev.map((row, rowIndex) => {
        if (rowIndex !== index) return row;

        if (field === 'color') {
          const colorName = String(value || '').trim();
          const colorDisplay = resolveColorDisplay(colorName, formData.colorVariants);
          return {
            ...row,
            color: colorName,
            colorHex: colorDisplay?.colorHex || '',
            colorSwatch: colorDisplay?.swatch || '',
            colorDetails: colorDisplay
              ? {
                  colorName: colorDisplay.colorName,
                  colorHex: colorDisplay.colorHex,
                  swatch: colorDisplay.swatch || '',
                }
              : null,
          };
        }

        const normalizedValue = ['mrp', 'sellingPrice', 'marginPrice'].includes(field)
          ? sanitizeNumberInput(value)
          : value;
        const nextRow = { ...row, [field]: normalizedValue };

        // Auto-calculate discount when MRP/Selling Price changes.
        if (field === 'mrp' || field === 'sellingPrice') {
          const mrpValue = Number(nextRow.mrp || 0);
          const sellingValue = Number(nextRow.sellingPrice || 0);
          if (Number.isFinite(mrpValue) && mrpValue > 0 && Number.isFinite(sellingValue)) {
            const rawDiscount = ((mrpValue - sellingValue) / mrpValue) * 100;
            const normalizedDiscount = Math.max(0, rawDiscount);
            nextRow.discountPercent = Number(normalizedDiscount.toFixed(2));
          } else {
            nextRow.discountPercent = 0;
          }
        }

        return nextRow;
      })
    );
  };

  const handleBulkVariantInputChange = (field, value) => {
    const normalizedValue = ['mrp', 'sellingPrice', 'marginPrice'].includes(field)
      ? sanitizeNumberInput(value)
      : value;
    setBulkVariantInputs((prev) => ({ ...prev, [field]: normalizedValue }));
  };

  const handleApplyBulkInputs = () => {
    const targetFields = ['name', 'unit', 'sku', 'barcode', 'hsnCode', 'gstPercent', 'mrp', 'sellingPrice', 'discountPercent', 'marginPrice'];
    const fieldsToApply = targetFields.filter((field) => {
      const value = bulkVariantInputs[field];
      return String(value ?? '').trim() !== '';
    });
    const catalogBulk = bulkVariantInputs.showInCatalog;
    const applyCatalog = catalogBulk === 'yes' || catalogBulk === 'no';
    const catalogValue = catalogBulk === 'yes';

    if (fieldsToApply.length === 0 && !applyCatalog) {
      toast.error('Enter at least one Apply value or choose a catalog option first.');
      return;
    }

    const isFieldEmptyForRow = (row, key) => {
      const raw = row?.[key];
      if (raw === null || raw === undefined) return true;
      if (typeof raw === 'number') return raw === 0;
      return String(raw).trim() === '';
    };

    const willOverwriteFields = (variantRows || []).some((row) =>
      fieldsToApply.some((field) => !isFieldEmptyForRow(row, field))
    );
    const willOverwriteCatalog =
      applyCatalog &&
      (variantRows || []).some((row) => row.showInCatalog !== catalogValue);

    if (willOverwriteFields || willOverwriteCatalog) {
      const proceed = window.confirm(
        'Some variant fields already have values. Apply will overwrite them for all rows. Continue?'
      );
      if (!proceed) return;
    }

    setVariantRows((prev) =>
      prev.map((row) => {
        const nextRow = { ...row };
        fieldsToApply.forEach((field) => {
          const rawValue = bulkVariantInputs[field];
          const normalizedValue = ['mrp', 'sellingPrice', 'marginPrice'].includes(field)
            ? sanitizeNumberInput(rawValue)
            : rawValue;
          nextRow[field] = normalizedValue;
        });

        if (applyCatalog) {
          nextRow.showInCatalog = catalogValue;
        }

        if (fieldsToApply.includes('mrp') || fieldsToApply.includes('sellingPrice')) {
          const mrpValue = Number(nextRow.mrp || 0);
          const sellingValue = Number(nextRow.sellingPrice || 0);
          if (Number.isFinite(mrpValue) && mrpValue > 0 && Number.isFinite(sellingValue)) {
            const rawDiscount = ((mrpValue - sellingValue) / mrpValue) * 100;
            const normalizedDiscount = Math.max(0, rawDiscount);
            nextRow.discountPercent = Number(normalizedDiscount.toFixed(2));
          } else {
            nextRow.discountPercent = 0;
          }
        }
        return nextRow;
      })
    );

    if (applyCatalog) {
      toast.success(
        catalogValue ? 'All variants set to show in catalog' : 'Catalog listing turned off for all variants'
      );
    }
  };

  const handleSetDefaultVariantRow = (index) => {
    setVariantRows((prev) =>
      prev.map((row, rowIndex) => ({
        ...row,
        isDefault: rowIndex === index,
      }))
    );
  };

  const handleVariantRowImageUpload = async (e, index) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setError('');
    try {
      const uploadPromises = Array.from(files).map((file) => uploadProductFile(file));
      const uploadedUrls = await Promise.all(uploadPromises);
      setVariantRows((prev) =>
        prev.map((row, rowIndex) =>
          rowIndex === index
            ? { ...row, images: [...(row.images || []), ...uploadedUrls] }
            : row
        )
      );
    } catch (error) {
      console.error('Variant image upload failed', error);
      setError(`Variant image upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveVariantRowImage = (rowIndex, imageIndex) => {
    setVariantRows((prev) =>
      prev.map((row, idx) =>
        idx === rowIndex
          ? { ...row, images: (row.images || []).filter((_, i) => i !== imageIndex) }
          : row
      )
    );
  };

  const getVariantPricingErrors = (row) => {
    const mrp = Number(row?.mrp || 0);
    const sellingPrice = Number(row?.sellingPrice || 0);
    const marginPrice = Number(row?.marginPrice || 0);
    const discountPercent = Number(row?.discountPercent || 0);

    return {
      sellingPrice: Number.isFinite(sellingPrice) && Number.isFinite(mrp) && sellingPrice > mrp,
      marginPrice: Number.isFinite(marginPrice) && Number.isFinite(sellingPrice) && marginPrice > sellingPrice,
      discountPercent: Number.isFinite(discountPercent) && discountPercent >= 100,
    };
  };

  const getStandalonePricingErrors = () => getVariantPricingErrors(formData);

  const handleStandalonePricingChange = (field, value) => {
    setFormData((prev) => {
      const normalizedValue = ['mrp', 'sellingPrice', 'marginPrice'].includes(field)
        ? sanitizeNumberInput(value)
        : value;
      const next = { ...prev, [field]: normalizedValue };

      if (field === 'mrp' || field === 'sellingPrice') {
        const mrpValue = Number(next.mrp || 0);
        const sellingValue = Number(next.sellingPrice || 0);
        if (Number.isFinite(mrpValue) && mrpValue > 0 && Number.isFinite(sellingValue)) {
          const rawDiscount = ((mrpValue - sellingValue) / mrpValue) * 100;
          next.discountPercent = Number(Math.max(0, rawDiscount).toFixed(2));
        } else {
          next.discountPercent = 0;
        }
        next.price = Number(next.sellingPrice || 0);
      }

      return next;
    });
  };

  const handleChooseProductVariantMode = (usesVariants) => {
    setHasVariantsChoice(usesVariants);
    setError('');
    if (!usesVariants) {
      setVariantRows([]);
    }
    setCurrentStep('selling');
  };

  /**
   * Blank rows still need Size/Colour (or whatever axes are active) editors in
   * the table. If no axis is ticked yet, default to Size + Colour so those
   * mandatory columns appear immediately.
   */
  const handleAddSingleVariantRow = () => {
    setVariantFieldSelection((prev) => ensureBlankRowVariantFieldSelection(prev));
    setVariantRows((prev) => ensureOneDefaultVariantRow([...prev, createEmptyVariantRow()]));
    setError('');
  };

  /**
   * Wipe axes, chip values, and SKU rows so the operator can rebuild the matrix
   * from scratch. Linked child products are soft-deleted on the next save
   * (same orphan path as deleting rows individually).
   */
  const handleClearVariantBuilder = () => {
    const rowCount = (variantRows || []).length;
    const linkedChildren = (variantRows || []).filter((row) => row?._childProductId).length;
    const hasAxesOrValues =
      selectedVariantFieldCount > 0 ||
      Object.values(variantBuilderInputs || {}).some((v) => String(v || '').trim()) ||
      Object.values(variantDraftValue || {}).some((v) => String(v || '').trim());

    if (rowCount === 0 && !hasAxesOrValues) {
      setError('');
      return;
    }

    const childWarning =
      linkedChildren > 0
        ? `\n\n${linkedChildren} linked child SKU(s) will move to trash on save.`
        : '';

    const confirmed = window.confirm(
      rowCount > 0
        ? `Clear variant attributes and remove all ${rowCount} row(s)?${childWarning}\n\nYou can rebuild with Generate or Add blank row.`
        : 'Clear selected axes and attribute values?'
    );
    if (!confirmed) return;

    setVariantFieldSelection({ size: false, color: false, weight: false, unitCount: false });
    setVariantBuilderInputs({ size: '', color: '', weight: '', unitCount: '' });
    setVariantDraftValue({ size: '', color: '', weight: '', unitCount: '' });
    setVariantRows([]);
    setSelectedVariantRowIndex(null);
    setError('');
  };

  const formatVariantRowSummary = (row) => {
    const parts = [row?.size, row?.color, row?.weight, row?.unitCount]
      .map((v) => String(v || '').trim())
      .filter(Boolean);
    const attrs = parts.join(' / ');
    const name = String(row?.name || '').trim();
    const sku = String(row?.sku || '').trim();
    if (name && attrs) return `${name} (${attrs})`;
    if (name) return name;
    if (attrs) return attrs;
    if (sku) return `SKU ${sku}`;
    return 'Unnamed variant';
  };

  const buildVariantDeleteConfirmMessage = (row) => {
    const childId = row?._childProductId ? String(row._childProductId) : null;
    const summary = formatVariantRowSummary(row);
    const skuLine = row?.sku ? `SKU: ${row.sku}\n` : '';

    if (childId) {
      return (
        'WARNING: A child product exists for this variant row.\n\n' +
        `Variant: ${summary}\n` +
        skuLine +
        `Child product ID: ${childId}\n\n` +
        'Deleting will:\n' +
        '• Remove this row from the Variants table\n' +
        '• Move the linked child product to trash (same as deleting the child product)\n\n' +
        'This cannot be undone from the variant table.\n\n' +
        'Continue?'
      );
    }

    return (
      'Remove this variant row?\n\n' +
      `Variant: ${summary}\n` +
      skuLine +
      'No child product is linked yet — only this unsaved row will be removed. You can use Undo.\n\n' +
      'Continue?'
    );
  };

  const handleDeleteVariantRow = async (index) => {
    const rowToDelete = variantRows[index];
    if (!rowToDelete) return;

    const childId = rowToDelete._childProductId
      ? String(rowToDelete._childProductId)
      : null;

    if (!window.confirm(buildVariantDeleteConfirmMessage(rowToDelete))) return;

    let variantWasAlreadyInTrash = false;

    if (childId) {
      try {
        const res = await adminFetch(`/api/admin/products/children/${childId}`, {
          method: 'DELETE',
        });
        const body = await res.json().catch(() => ({}));
        variantWasAlreadyInTrash =
          body.alreadyDeleted === true ||
          (res.status === 400 &&
            String(body.error || '').toLowerCase().includes('already deleted'));

        if (!res.ok && !variantWasAlreadyInTrash) {
          throw new Error(body.error || 'Failed to delete variant');
        }

        initialChildIdsRef.current = initialChildIdsRef.current.filter(
          (id) => String(id) !== childId
        );
      } catch (err) {
        toast.error(err?.message || 'Failed to delete variant');
        return;
      }
    }

    setVariantRows((prev) =>
      ensureOneDefaultVariantRow(prev.filter((_, rowIndex) => rowIndex !== index))
    );
    // Only offer undo for unsaved rows — persisted children are already soft-deleted in the API.
    if (!childId) {
      setRecentlyDeletedVariantRow({ row: rowToDelete, index });
    } else {
      setRecentlyDeletedVariantRow(null);
      toast.success(
        variantWasAlreadyInTrash
          ? 'Variant was already in trash — removed from this list'
          : 'Variant row removed and linked child product moved to trash'
      );
    }
    setSelectedVariantRowIndex((prev) => {
      if (prev === null) return null;
      if (prev === index) return null;
      return prev > index ? prev - 1 : prev;
    });
  };

  const handleUndoDeleteVariantRow = () => {
    if (!recentlyDeletedVariantRow) return;
    const { row, index } = recentlyDeletedVariantRow;
    setVariantRows((prev) => {
      const next = [...prev];
      const safeIndex = Math.max(0, Math.min(index, next.length));
      next.splice(safeIndex, 0, row);
      return ensureOneDefaultVariantRow(next);
    });
    setRecentlyDeletedVariantRow(null);
  };
  
  // Debounce search query to avoid too many API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(relatedProductsSearchQuery);
    }, 300); // 300ms debounce
    
    return () => clearTimeout(timer);
  }, [relatedProductsSearchQuery]);
  
  // Fetch products from API when searching (searches ALL products, not just 200)
  const searchProductsUrl = debouncedSearchQuery.trim() 
    ? `/api/products?search=${encodeURIComponent(debouncedSearchQuery.trim())}&limit=500`
    : null;
  
  const { data: searchProductsData } = useSWR(
    searchProductsUrl,
    (url) => fetch(url).then(res => res.json()),
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000, // Cache for 5 seconds
    }
  );
  
  const searchedProducts = searchProductsData?.products || [];
  
  // AI generation state
  const [aiLoading, setAiLoading] = useState({ summary: false, description: false });
  const [aiCooldown, setAiCooldown] = useState({ summary: false, description: false });
  
  // Drag and drop state for specifications
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const lastAiCallRef = useRef({ summary: 0, description: 0 });
  
  // Specifications JSON mode state
  const [specJsonMode, setSpecJsonMode] = useState(false);
  const [specJsonInput, setSpecJsonInput] = useState('');
  const [specJsonError, setSpecJsonError] = useState('');
  const [specJsonAppliedAt, setSpecJsonAppliedAt] = useState(0);
  const specJsonDebounceRef = useRef(null);
  
  // Reset color picker state when opening
  const handleOpenColorPicker = () => {
    setCustomColorHex('#000000');
    setCustomColorName('');
    setError('');
    setShowColorPicker(true);
  };

  /**
   * Handle auto-generate tags button click.
   * Merges into existing tags — never wipes manual entries.
   */
  const handleAutoGenerateTags = () => {
    const generatedTags = generateProductTags(formData, categories, brands, businessTypes, {
      variantRows,
      variantBuilderInputs,
    });

    const existingTags = formData.tagsInput
      ? formData.tagsInput.split(',').map((t) => normalizeTag(t)).filter(Boolean)
      : [];

    const allTags = mergeProductTags(existingTags, generatedTags);

    setFormData((prev) => ({
      ...prev,
      tagsInput: allTags.join(', '),
    }));

    setGeneratedTagsPreview(generatedTags);
    setShowTagsPreview(true);

    setTimeout(() => {
      setShowTagsPreview(false);
    }, 5000);
  };

  /**
   * Handle AI description generation/enhancement
   */
  const handleAIGenerate = async (field) => {
    // Check cooldown (2 seconds between calls)
    const now = Date.now();
    const lastCall = lastAiCallRef.current[field] || 0;
    const timeSinceLastCall = now - lastCall;
    
    if (timeSinceLastCall < 2000) {
      const remaining = Math.ceil((2000 - timeSinceLastCall) / 1000);
      setError(`Please wait ${remaining} second${remaining > 1 ? 's' : ''} before generating again.`);
      setTimeout(() => setError(''), 3000);
      return;
    }

    // Validate minimum product data
    if (!formData.title || formData.title.trim().length < 3) {
      setError('Please enter a product title first (at least 3 characters).');
      setTimeout(() => setError(''), 3000);
      return;
    }

    // Determine mode: generate if empty/minimal, enhance if substantial text exists
    const currentText = field === 'summary' ? formData.summary : formData.description;
    const hasSubstantialText = getTextLength(currentText) > 20;
    const mode = hasSubstantialText ? 'enhance' : 'generate';

    // Set loading state
    setAiLoading(prev => ({ ...prev, [field]: true }));
    setError('');
    lastAiCallRef.current[field] = now;

    try {
      // Prepare product data for API
      const productDataForAI = {
        title: formData.title,
        brand: formData.brand || '',
        categoryId: formData.categoryId || '',
        brandCategoryId: formData.brandCategoryId || '',
        sku: formData.sku || '',
        specifications: formData.specifications || [],
        filters: formData.filters || [],
        tags: formData.tagsInput 
          ? formData.tagsInput.split(',').map(t => t.trim()).filter(Boolean)
          : (formData.tags || []),
        businessTypeSlugs: formData.businessTypeSlugs || [],
      };

      // Call AI API
      const response = await fetch('/api/ai/generate-description', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          field,
          mode,
          productData: productDataForAI,
          existingText: currentText || '',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate description');
      }

      if (!data.success || !data.text) {
        throw new Error('AI returned empty response');
      }

      // Update form data with generated text (convert plain text to simple HTML)
      const html = plainTextToHtml(data.text);
      setFormData(prev => ({
        ...prev,
        [field]: html,
      }));

      // Set cooldown state
      setAiCooldown(prev => ({ ...prev, [field]: true }));
      setTimeout(() => {
        setAiCooldown(prev => ({ ...prev, [field]: false }));
      }, 2000);

    } catch (error) {
      console.error('AI generation error:', error);
      setError(error.message || 'Failed to generate description. Please try again.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setAiLoading(prev => ({ ...prev, [field]: false }));
    }
  };

  /**
   * Auto-trigger tag generation on field changes (debounced)
   * Only updates if tags are empty or minimal (non-intrusive)
   */
  useEffect(() => {
    // Clear previous debounce timer
    if (autoTagDebounceRef.current) {
      clearTimeout(autoTagDebounceRef.current);
    }
    
    // Don't auto-generate tags for duplicate products - user must click "Auto-Generate Tags" button
    const isDuplicateProduct = product && !product._id && !product.id;
    if (isDuplicateProduct) return;
    
    // Don't auto-generate if user is manually editing tags or preview is shown
    if (showTagsPreview) return;
    
    // Check if user has manually added substantial tags
    const existingTags = formData.tagsInput 
      ? formData.tagsInput.split(',').map(t => normalizeTag(t)).filter(Boolean)
      : [];
    
    // If user has added 3+ tags manually, don't auto-trigger
    if (existingTags.length >= 3) return;
    
    // Debounce auto-generation by 3 seconds (longer delay to be less intrusive)
    autoTagDebounceRef.current = setTimeout(() => {
      // Only auto-generate if form has substantial data
      if (formData.title && formData.title.trim().length > 3) {
        const generatedTags = generateProductTags(formData, categories, brands, businessTypes, {
          variantRows,
          variantBuilderInputs,
        });
        if (generatedTags.length > 0) {
          // Re-check existing tags (user might have edited in the meantime)
          const currentTags = formData.tagsInput
            ? formData.tagsInput.split(',').map((t) => normalizeTag(t)).filter(Boolean)
            : [];

          // Only update if tags input is still empty or minimal
          if (currentTags.length <= 2) {
            const allTags = mergeProductTags(currentTags, generatedTags);
            setFormData((prev) => ({
              ...prev,
              tagsInput: allTags.join(', '),
            }));
          }
        }
      }
    }, 3000);
    
    return () => {
      if (autoTagDebounceRef.current) {
        clearTimeout(autoTagDebounceRef.current);
      }
    };
  }, [
    formData.title,
    formData.brand,
    formData.sku,
    formData.categoryId,
    formData.categoryIds,
    formData.brandCategoryId,
    formData.brandCategoryIds,
    formData.filters,
    formData.specifications,
    formData.colorVariants,
    formData.businessTypeSlugs,
    formData.featured,
    formData.tagsInput, // Include to check if user manually edited
    formData.priceBySize,
    formData.variationAttributes,
    variantRows,
    variantBuilderInputs,
    categories,
    brands,
    businessTypes,
    showTagsPreview,
    product // Include to check if product is a duplicate
  ]);


  // Initialize form data when product is provided (edit mode) - only once per product
  useEffect(() => {
    const currentProductId = product?._id || product?.id;
    // For duplicate products without ID, use a hash of the product data to track initialization
    const productKey = currentProductId || (product ? JSON.stringify(product).substring(0, 100) : null);
    
    if (product && initializedProductIdRef.current !== productKey) {
      const categoryId = product.categoryId?._id || product.categoryId;
      const categoryIds = product.categoryIds || [];
      const brandCategoryId = product.brandCategoryId?._id || product.brandCategoryId;
      const brandCategoryIds = product.brandCategoryIds || [];
      
      // Convert old filter format to new format if needed
      let filters = product.filters || [];
      if (Array.isArray(filters) && filters.length === 0) {
        // If empty array, initialize with defaults
        filters = [{ key: 'Material', values: [] }, { key: 'Size', values: [] }];
      } else if (!Array.isArray(filters)) {
        // Convert old format {material: [], color: [], usage: []} to new format
        filters = [];
        if (product.filters?.material && product.filters.material.length > 0) {
          filters.push({ key: 'Material', values: product.filters.material });
        }
        if (product.filters?.size && product.filters.size.length > 0) {
          filters.push({ key: 'Size', values: product.filters.size });
        }
        // Add any other filters
        Object.keys(product.filters || {}).forEach(key => {
          if (key !== 'material' && key !== 'size' && key !== 'color' && key !== 'usage' && product.filters[key]?.length > 0) {
            filters.push({ key: key.charAt(0).toUpperCase() + key.slice(1), values: product.filters[key] });
          }
        });
        // If no filters found, use defaults
        if (filters.length === 0) {
          filters = [{ key: 'Material', values: [] }, { key: 'Size', values: [] }];
        }
      }
      
      // Extract related product IDs - handle both populated objects and plain IDs
      const relatedProductIds = (product.relatedProductIds || []).map(rp => 
        (rp?._id || rp)?.toString()
      ).filter(Boolean);

      const frequentlyOrderedTogetherProductIds = (product.frequentlyOrderedTogetherProductIds || [])
        .map(rp => (rp?._id || rp)?.toString())
        .filter(Boolean);
      
      // Always set form data, even if categories/brands aren't loaded yet.
      // Drop children/variants from the payload — they hydrate the SKU table, not form fields.
      const productFields = { ...product };
      delete productFields.children;
      delete productFields.variants;
      setFormData({
        ...productFields,
        categoryId: categoryId?.toString() || '',
        categoryIds: categoryIds.map(cid => (cid?._id || cid)?.toString()).filter(Boolean),
        brandCategoryId: brandCategoryId?.toString() || '',
        brandCategoryIds: brandCategoryIds.map(bid => (bid?._id || bid)?.toString()).filter(Boolean),
        tagsInput: (product.tags || []).join(', '),
        filters: filters,
        availableSizes: product.availableSizes || '',
        colorVariants: ensureOneDefaultColorVariant(product.colorVariants || []),
        // Ensure these fields are properly initialized
        gallery: product.gallery || [],
        specifications: product.specifications || [],
        faqs: product.faqs || [],
        testimonials: product.testimonials || [],
        detailPhotos: product.detailPhotos || [],
        summary: product.summary || '',
        description: product.description || '',
        manufacturer: product.manufacturer || '',
        barcode: product.barcode || '',
        hsnCode: product.hsnCode || '',
        unit: String(product?.variationAttributes?.unit || '').trim(),
        gstPercent: Number(product?.gstPercent || 0),
        mrp: Number(product?.mrp || 0),
        sellingPrice: Number(product?.sellingPrice ?? product?.price ?? 0),
        discountPercent: Number(product?.discountPercent || 0),
        marginPrice: Number(product?.marginPrice || 0),
        usageAndCare: product.usageAndCare || '',
        whyBuyFrom: product.whyBuyFrom || '',
        sizeChartUrl: product.sizeChartUrl || '',
        brochureUrl: product.brochureUrl || '',
        blogUrl: product.blogUrl || '',
        businessTypeSlugs: product.businessTypeSlugs || [],
        relatedProductIds: relatedProductIds,
        frequentlyOrderedTogetherProductIds: frequentlyOrderedTogetherProductIds,
      });

      // Initialize category/brand selections only if categories/brands are loaded
      if (categoryId && categories.length > 0) {
        const ancestry = getCategoryAncestry(categoryId, categories);
        setCategorySelection(ancestry);
      }

      // Initialize additional category selections
      if (categoryIds.length > 0 && categories.length > 0) {
        const additionalSelections = categoryIds.map(cid => {
          const id = cid?._id || cid;
          return getCategoryAncestry(id, categories);
        });
        setAdditionalCategorySelections(additionalSelections);
      } else {
        setAdditionalCategorySelections([]);
      }

      if (brandCategoryId && brands.length > 0) {
        const ancestry = getBrandAncestry(brandCategoryId, brands);
        setBrandSelection(ancestry);
      }

      // Initialize additional brand selections
      if (brandCategoryIds.length > 0 && brands.length > 0) {
        const additionalSelections = brandCategoryIds.map(bid => {
          const id = bid?._id || bid;
          return getBrandAncestry(id, brands);
        });
        setAdditionalBrandSelections(additionalSelections);
      } else {
        setAdditionalBrandSelections([]);
      }
      
      initializedProductIdRef.current = productKey;
    } else if (!product) {
      // Reset when switching from edit to add mode
      initializedProductIdRef.current = null;
    }
  }, [product, categories, brands]); // depends on product, categories, and brands

  const handleCategoryChange = (level, id) => {
    const newSelection = { [level]: id };
    const levelOrder = ['department', 'category', 'subcategory', 'type'];
    const currentLevelIndex = levelOrder.indexOf(level);
    
    // Preserve parent selections
    for (let i = 0; i < currentLevelIndex; i++) {
      const parentLevel = levelOrder[i];
      if (categorySelection[parentLevel]) {
        newSelection[parentLevel] = categorySelection[parentLevel];
      }
    }
    
    setCategorySelection(newSelection);

    // Set categoryId to the most specific level selected
    // Priority: type > subcategory > category > department
    // This ensures products are assigned to the most specific category available
    let finalCategoryId = null;
    if (id) {
      // When selecting a category, set categoryId to that category
      finalCategoryId = id;
      setFormData({ ...formData, categoryId: id });
    } else {
      // If clearing a selection, find the most specific remaining level
      // Check from most specific to least specific
      const mostSpecificLevel = ['type', 'subcategory', 'category', 'department'].find(l => newSelection[l]);
      if (mostSpecificLevel) {
        finalCategoryId = newSelection[mostSpecificLevel];
        setFormData({ ...formData, categoryId: finalCategoryId });
      } else {
        finalCategoryId = null;
        setFormData({ ...formData, categoryId: '' });
      }
    }
    
    // Notify parent component of category change for dynamic product fetching
    if (onCategoryChange) {
      onCategoryChange(finalCategoryId);
    }
  };

  const getCategoriesByParent = (parentId) => {
    if (!parentId) {
      return categories.filter(c => {
        const cParent = c.parent?._id || c.parent;
        return !cParent;
      });
    }
    
    return categories.filter(c => {
      const cParent = c.parent?._id || c.parent;
      return cParent?.toString() === parentId.toString();
    });
  };

  const getBrandsByParent = (parentId) => {
    if (!parentId) {
      return brands.filter(b => {
        const bParent = b.parent?._id || b.parent;
        return !bParent;
      });
    }
    
    return brands.filter(b => {
      const bParent = b.parent?._id || b.parent;
      return bParent?.toString() === parentId.toString();
    });
  };

  const departments = categories.filter(c => c.level === 'department');
  const categoriesList = categorySelection.department ? getCategoriesByParent(categorySelection.department) : [];
  const subcategories = categorySelection.category ? getCategoriesByParent(categorySelection.category) : [];
  const types = categorySelection.subcategory ? getCategoriesByParent(categorySelection.subcategory) : [];

  const brandDepartments = brands.filter(b => b.level === 'department');
  const brandCategoriesList = brandSelection.department ? getBrandsByParent(brandSelection.department) : [];
  const brandSubcategories = brandSelection.category ? getBrandsByParent(brandSelection.category) : [];

  const handleBrandCategoryChange = (level, id) => {
    const levelOrder = ['department', 'category', 'subcategory'];
    const currentLevelIndex = levelOrder.indexOf(level);

    setBrandSelection((prevSelection) => {
      const newSelection = { [level]: id };
      for (let i = 0; i < currentLevelIndex; i++) {
        const parentLevel = levelOrder[i];
        if (prevSelection[parentLevel]) {
          newSelection[parentLevel] = prevSelection[parentLevel];
        }
      }

      const mostSpecificLevel = ['subcategory', 'category', 'department'].find(
        (l) => newSelection[l]
      );
      const brandCategoryId =
        mostSpecificLevel && newSelection[mostSpecificLevel]
          ? String(newSelection[mostSpecificLevel])
          : '';

      let brandName = '';
      if (newSelection.department) {
        const departmentBrand = brands.find((b) => {
          const bId = b._id || b.id;
          return bId?.toString() === newSelection.department.toString();
        });
        if (departmentBrand?.name) brandName = departmentBrand.name;
      }

      setFormData((prev) => ({
        ...prev,
        brandCategoryId,
        brand: brandName || prev.brand,
      }));

      return newSelection;
    });
  };

  const handleAdditionalBrandCategoryChange = (index, level, id) => {
    const newSelections = [...additionalBrandSelections];
    const newSelection = { [level]: id };
    const levelOrder = ['department', 'category', 'subcategory'];
    const currentLevelIndex = levelOrder.indexOf(level);
    
    // Preserve parent selections
    if (newSelections[index]) {
      for (let i = 0; i < currentLevelIndex; i++) {
        const parentLevel = levelOrder[i];
        if (newSelections[index][parentLevel]) {
          newSelection[parentLevel] = newSelections[index][parentLevel];
        }
      }
    }
    
    newSelections[index] = newSelection;
    setAdditionalBrandSelections(newSelections);

    // Update brandCategoryIds array
    const updatedBrandCategoryIds = newSelections.map(sel => {
      const mostSpecificLevel = ['subcategory', 'category', 'department'].find(l => sel[l]);
      return mostSpecificLevel ? sel[mostSpecificLevel] : null;
    }).filter(Boolean);

    setFormData({ ...formData, brandCategoryIds: updatedBrandCategoryIds });
  };

  const addAdditionalBrandCategory = () => {
    setAdditionalBrandSelections([...additionalBrandSelections, {}]);
  };

  const removeAdditionalBrandCategory = (index) => {
    const newSelections = additionalBrandSelections.filter((_, i) => i !== index);
    setAdditionalBrandSelections(newSelections);
    
    // Update brandCategoryIds array
    const updatedBrandCategoryIds = newSelections.map(sel => {
      const mostSpecificLevel = ['subcategory', 'category', 'department'].find(l => sel[l]);
      return mostSpecificLevel ? sel[mostSpecificLevel] : null;
    }).filter(Boolean);

    setFormData({ ...formData, brandCategoryIds: updatedBrandCategoryIds });
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const { checked } = e.target;
      setFormData({ ...formData, [name]: checked });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  // Get brand suggestions based on input
  const getBrandSuggestions = (query) => {
    if (!query || query.trim().length < 2 || !brands || brands.length === 0) {
      return [];
    }
    const queryLower = query.toLowerCase().trim();
    
    // Search in all brand levels
    const matches = brands.filter(brand => {
      const brandName = (brand.name || '').toLowerCase();
      return brandName.includes(queryLower);
    });
    
    // Prioritize departments, then categories, then subcategories
    const sorted = matches.sort((a, b) => {
      const levelOrder = { department: 0, category: 1, subcategory: 2 };
      return (levelOrder[a.level] || 99) - (levelOrder[b.level] || 99);
    });
    
    return sorted.slice(0, 5); // Limit to 5 suggestions
  };

  // Handle brand input change with autocomplete
  const handleBrandInputChange = (e) => {
    const value = e.target.value;
    // Typing invalidates a prior tree link until the operator picks a suggestion again.
    setFormData({ ...formData, brand: value, brandCategoryId: '' });
    setBrandSelection({});

    if (value.trim().length >= 2) {
      const suggestions = getBrandSuggestions(value);
      setBrandSuggestions(suggestions);
      setShowBrandSuggestions(suggestions.length > 0);
    } else {
      setBrandSuggestions([]);
      setShowBrandSuggestions(false);
    }
  };

  /**
   * Link the brand field to a tree node in one write.
   * Category/subcategory used to chain setTimeout + handleBrandCategoryChange,
   * which raced on stale brandSelection and cleared the input.
   */
  const handleBrandSuggestionSelect = (brand) => {
    const brandId = brand?._id || brand?.id;
    if (!brandId) return;

    const ancestry = getBrandAncestry(brandId, brands);
    const mostSpecificLevel = ['subcategory', 'category', 'department'].find(
      (level) => ancestry[level]
    );
    const brandCategoryId = mostSpecificLevel
      ? String(ancestry[mostSpecificLevel])
      : String(brandId);

    // Keep the catalog brand label on the department when ancestry exists
    // (matches cascade behaviour and storefront brand text).
    let brandName = String(brand.name || '').trim();
    if (ancestry.department) {
      const departmentBrand = brands.find((node) => {
        const id = node._id || node.id;
        return id?.toString() === ancestry.department.toString();
      });
      if (departmentBrand?.name) brandName = departmentBrand.name;
    }

    setBrandSelection(ancestry);
    setFormData((prev) => ({
      ...prev,
      brand: brandName,
      brandCategoryId,
    }));
    setShowBrandSuggestions(false);
    setBrandInputFocused(false);
  };

  // Auto-link brand category on form submit if brand text matches a department
  const autoLinkBrandCategory = () => {
    if (!formData.brand || !formData.brand.trim() || formData.brandCategoryId || !brands || brands.length === 0) {
      return; // Skip if no brand text, already linked, or no brands available
    }
    
    const brandText = formData.brand.trim();
    // Find exact match (case-insensitive) with brand departments
    const matchingBrand = brands.find(b => 
      b.level === 'department' && 
      b.name.toLowerCase() === brandText.toLowerCase()
    );
    
    if (matchingBrand) {
      // Auto-link if match found - update formData directly
      const brandId = matchingBrand._id || matchingBrand.id;
      setFormData(prev => ({
        ...prev,
        brandCategoryId: brandId.toString()
      }));
      // Also update brand selection for UI consistency
      setBrandSelection({ department: brandId.toString() });
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        brandInputRef.current && 
        !brandInputRef.current.contains(event.target) &&
        brandSuggestionsRef.current &&
        !brandSuggestionsRef.current.contains(event.target)
      ) {
        setShowBrandSuggestions(false);
        setBrandInputFocused(false);
      }
    };

    if (showBrandSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showBrandSuggestions]);

  const handleBusinessTypeChange = (slug) => {
    const currentSlugs = formData.businessTypeSlugs || [];
    if (currentSlugs.includes(slug)) {
      setFormData({ ...formData, businessTypeSlugs: currentSlugs.filter(s => s !== slug) });
    } else {
      setFormData({ ...formData, businessTypeSlugs: [...currentSlugs, slug] });
    }
  };

  const handleRelatedProductChange = (productId) => {
    const currentRelated = formData.relatedProductIds || [];
    const productIdStr = productId?.toString();
    if (currentRelated.some(id => id?.toString() === productIdStr)) {
      setFormData({ 
        ...formData, 
        relatedProductIds: currentRelated.filter(id => id?.toString() !== productIdStr) 
      });
    } else {
      setFormData({ ...formData, relatedProductIds: [...currentRelated, productId] });
    }
  };

  const handleFrequentlyOrderedProductChange = (productId) => {
    const current = formData.frequentlyOrderedTogetherProductIds || [];
    const productIdStr = productId?.toString();
    if (current.some(id => id?.toString() === productIdStr)) {
      setFormData({
        ...formData,
        frequentlyOrderedTogetherProductIds: current.filter(id => id?.toString() !== productIdStr),
      });
    } else {
      setFormData({ ...formData, frequentlyOrderedTogetherProductIds: [...current, productId] });
    }
  };
  
  const getSortedRelatedCandidates = useMemo(() => {
    const currentProductId = product?._id || product?.id;
    
    // LAYER 1: Category = Candidate Pool (Filter, not score)
    // Get current product's category hierarchy to determine pool
    const formCategoryId = formData.categoryId;
    const formCategory = categories.find(c => {
      const cId = c._id || c.id;
      return cId?.toString() === formCategoryId?.toString();
    });
    
    // Get current product's category ancestry (to find subcategory/type)
    const formCategoryAncestry = formCategoryId ? getCategoryAncestry(formCategoryId, categories) : {};
    const formSubcategoryId = formCategoryAncestry.subcategory;
    const formTypeId = formCategoryAncestry.type;
    
    // Filter candidates by same subcategory OR same type (creates relevant pool)
    let candidatePool = allProducts.filter(p => {
      const pid = p._id || p.id;
      // Exclude current product
      if (pid?.toString() === currentProductId?.toString()) {
        return false;
      }
      
      // If no category selected, allow all products (fallback)
      if (!formCategoryId) {
        return true;
      }
      
      const candidateCategoryId = p.categoryId?._id || p.categoryId;
      if (!candidateCategoryId) return false;
      
      const candidateCategory = categories.find(c => {
        const cId = c._id || c.id;
        return cId?.toString() === candidateCategoryId?.toString();
      });
      
      if (!candidateCategory) return false;
      
      // Get candidate's category ancestry
      const candidateAncestry = getCategoryAncestry(candidateCategoryId, categories);
      const candidateSubcategoryId = candidateAncestry.subcategory;
      const candidateTypeId = candidateAncestry.type;
      
      // Pool rule: Same subcategory OR same type
      // This creates a relevant pool (e.g., "Dough Mixers" not "Ovens")
      if (formTypeId && candidateTypeId) {
        return formTypeId.toString() === candidateTypeId.toString();
      }
      if (formSubcategoryId && candidateSubcategoryId) {
        return formSubcategoryId.toString() === candidateSubcategoryId.toString();
      }
      
      // Fallback: if no subcategory/type, allow same category level
      if (formCategory && candidateCategory) {
        return formCategory.level === candidateCategory.level && 
               formCategoryId.toString() === candidateCategoryId.toString();
      }
      
      return false;
    });
    
    // Fallback: If filtered pool is empty, show all products (except current)
    // This ensures users can still select related products even if category filter is too strict
    if (candidatePool.length === 0 && allProducts.length > 0) {
      candidatePool = allProducts.filter(p => {
        const pid = p._id || p.id;
        return pid?.toString() !== currentProductId?.toString();
      });
    }
    
    // Get current tags (normalized)
    const currentTags = formData.tagsInput 
      ? formData.tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
      : (formData.tags || []).map(t => t.toLowerCase()).filter(Boolean);

    // LAYER 2: Shared Signals = Relevance (Scoring)
    return candidatePool.map(candidate => {
      let score = 0;
      let reasons = [];

      // ≡ƒææ TAGS = PRIMARY SIGNAL (King of relationships)
      // Tags answer: "Why would someone look at THIS after seeing THAT?"
      const sharedTags = (candidate.tags || []).filter(t => 
        currentTags.includes(t.toLowerCase())
      );
      if (sharedTags.length > 0) {
        // Increased weight: 5 points per tag (was 3)
        // This makes tags the dominant signal
        score += sharedTags.length * 5;
        reasons.push(`${sharedTags.length} Shared Tag${sharedTags.length > 1 ? 's' : ''}`);
      }

      // Business Type = Secondary Signal
      // Same business usage = same context
      const sharedBusiness = (candidate.businessTypeSlugs || []).filter(s => 
        formData.businessTypeSlugs?.includes(s)
      );
      if (sharedBusiness.length > 0) {
        score += sharedBusiness.length * 2;
        if (!reasons.some(r => r.includes('Business'))) {
          reasons.push(`${sharedBusiness.length} Shared Business Type${sharedBusiness.length > 1 ? 's' : ''}`);
        }
      }

      // Category = Small Influence (Gatekeeper, not decision-maker)
      // Only give a small bonus if in same category (already filtered by pool)
      const candidateCategoryId = candidate.categoryId?._id || candidate.categoryId;
      const formCategoryId = formData.categoryId;
      if (candidateCategoryId?.toString() === formCategoryId?.toString()) {
        score += 3; // Small influence (was 10)
        if (!reasons.some(r => r.includes('Category'))) {
          reasons.push('Same Category');
        }
      }

      // Price Proximity = Nice-to-have
      // Similar price range suggests similar use case
      const currentPrice = Number(formData.price) || 0;
      if (currentPrice > 0 && candidate.price >= currentPrice * 0.7 && candidate.price <= currentPrice * 1.3) {
        score += 2;
        if (!reasons.some(r => r.includes('Price'))) {
          reasons.push('Similar Price');
        }
      }

      return {
        ...candidate,
        relevanceScore: score,
        relevanceReasons: reasons
      };
    }).sort((a, b) => {
      // LAYER 3: Manual Override = Always Wins
      // Selected products always appear first
      const aId = a._id || a.id;
      const bId = b._id || b.id;
      const aSelected = formData.relatedProductIds?.some(id => id?.toString() === aId?.toString());
      const bSelected = formData.relatedProductIds?.some(id => id?.toString() === bId?.toString());
      
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      
      // Then sort by relevance score (tags-driven)
      return b.relevanceScore - a.relevanceScore;
    });
  }, [
    allProducts, 
    product, 
    categories,
    formData.categoryId, 
    formData.tagsInput, 
    formData.businessTypeSlugs, 
    formData.price, 
    formData.relatedProductIds
  ]);

  // Get products to use for related products selection
  // When searching, use server-side search results (searches ALL products)
  // When not searching, use allProducts passed as prop
  const availableProductsForSelection = useMemo(() => {
    if (debouncedSearchQuery.trim() && searchedProducts.length > 0) {
      // When searching, use server-side search results
      // Merge with allProducts to ensure we have all products for relevance scoring
      const allProductIds = new Set(allProducts.map(p => (p._id || p.id)?.toString()));
      const searchedProductIds = new Set(searchedProducts.map(p => (p._id || p.id)?.toString()));
      
      // Combine: searched products + any products from allProducts not in search results
      const combined = [...searchedProducts];
      allProducts.forEach(p => {
        const pid = (p._id || p.id)?.toString();
        if (pid && !searchedProductIds.has(pid)) {
          combined.push(p);
        }
      });
      
      return combined;
    }
    // When not searching, use allProducts
    return allProducts;
  }, [debouncedSearchQuery, searchedProducts, allProducts]);

  // Recalculate sorted candidates with updated product list when searching
  const getSortedRelatedCandidatesWithSearch = useMemo(() => {
    const currentProductId = product?._id || product?.id;
    
    // Use availableProductsForSelection instead of allProducts
    const productsToUse = availableProductsForSelection;
    
    // LAYER 1: Category = Candidate Pool (Filter, not score)
    const formCategoryId = formData.categoryId;
    const formCategory = categories.find(c => {
      const cId = c._id || c.id;
      return cId?.toString() === formCategoryId?.toString();
    });
    
    const formCategoryAncestry = formCategoryId ? getCategoryAncestry(formCategoryId, categories) : {};
    const formSubcategoryId = formCategoryAncestry.subcategory;
    const formTypeId = formCategoryAncestry.type;
    
    // Filter candidates by same subcategory OR same type
    let candidatePool = productsToUse.filter(p => {
      const pid = p._id || p.id;
      if (pid?.toString() === currentProductId?.toString()) {
        return false;
      }
      
      if (!formCategoryId) {
        return true;
      }
      
      const candidateCategoryId = p.categoryId?._id || p.categoryId;
      if (!candidateCategoryId) return false;
      
      const candidateCategory = categories.find(c => {
        const cId = c._id || c.id;
        return cId?.toString() === candidateCategoryId?.toString();
      });
      
      if (!candidateCategory) return false;
      
      const candidateAncestry = getCategoryAncestry(candidateCategoryId, categories);
      const candidateSubcategoryId = candidateAncestry.subcategory;
      const candidateTypeId = candidateAncestry.type;
      
      if (formTypeId && candidateTypeId) {
        return formTypeId.toString() === candidateTypeId.toString();
      }
      if (formSubcategoryId && candidateSubcategoryId) {
        return formSubcategoryId.toString() === candidateSubcategoryId.toString();
      }
      
      if (formCategory && candidateCategory) {
        return formCategory.level === candidateCategory.level && 
               formCategoryId.toString() === candidateCategoryId.toString();
      }
      
      return false;
    });
    
    // Fallback: If filtered pool is empty, show all products (except current)
    if (candidatePool.length === 0 && productsToUse.length > 0) {
      candidatePool = productsToUse.filter(p => {
        const pid = p._id || p.id;
        return pid?.toString() !== currentProductId?.toString();
      });
    }
    
    // Get current tags (normalized)
    const currentTags = formData.tagsInput 
      ? formData.tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
      : (formData.tags || []).map(t => t.toLowerCase()).filter(Boolean);

    // LAYER 2: Shared Signals = Relevance (Scoring)
    return candidatePool.map(candidate => {
      let score = 0;
      let reasons = [];

      // Tags = PRIMARY SIGNAL
      const sharedTags = (candidate.tags || []).filter(t => 
        currentTags.includes(t.toLowerCase())
      );
      if (sharedTags.length > 0) {
        score += sharedTags.length * 5;
        reasons.push(`${sharedTags.length} Shared Tag${sharedTags.length > 1 ? 's' : ''}`);
      }

      // Business Type = Secondary Signal
      const sharedBusiness = (candidate.businessTypeSlugs || []).filter(s => 
        formData.businessTypeSlugs?.includes(s)
      );
      if (sharedBusiness.length > 0) {
        score += sharedBusiness.length * 2;
        if (!reasons.some(r => r.includes('Business'))) {
          reasons.push(`${sharedBusiness.length} Shared Business Type${sharedBusiness.length > 1 ? 's' : ''}`);
        }
      }

      // Category = Small Influence
      const candidateCategoryId = candidate.categoryId?._id || candidate.categoryId;
      const formCategoryIdForScore = formData.categoryId;
      if (candidateCategoryId?.toString() === formCategoryIdForScore?.toString()) {
        score += 3;
        if (!reasons.some(r => r.includes('Category'))) {
          reasons.push('Same Category');
        }
      }

      // Price Proximity
      const currentPrice = Number(formData.price) || 0;
      if (currentPrice > 0 && candidate.price >= currentPrice * 0.7 && candidate.price <= currentPrice * 1.3) {
        score += 2;
        if (!reasons.some(r => r.includes('Price'))) {
          reasons.push('Similar Price');
        }
      }

      return {
        ...candidate,
        relevanceScore: score,
        relevanceReasons: reasons
      };
    }).sort((a, b) => {
      // LAYER 3: Manual Override = Always Wins
      const aId = a._id || a.id;
      const bId = b._id || b.id;
      const aSelected = formData.relatedProductIds?.some(id => id?.toString() === aId?.toString());
      const bSelected = formData.relatedProductIds?.some(id => id?.toString() === bId?.toString());
      
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      
      // Then sort by relevance score
      return b.relevanceScore - a.relevanceScore;
    });
  }, [
    availableProductsForSelection,
    product,
    categories,
    formData.categoryId,
    formData.tagsInput,
    formData.businessTypeSlugs,
    formData.price,
    formData.relatedProductIds
  ]);

  // Filter related products candidates by search query
  // When searching: Simple direct search results (no category filtering, no relevance scoring)
  // When not searching: Use getSortedRelatedCandidates with relevance logic
  const filteredRelatedCandidates = useMemo(() => {
    if (!debouncedSearchQuery.trim()) {
      // Not searching - use original sorted candidates with relevance scoring
      return getSortedRelatedCandidates;
    }
    
    // When searching: Return simple search results without category/relevance logic
    // Just exclude the current product and sort selected products first
    const currentProductId = product?._id || product?.id;
    
    const simpleSearchResults = searchedProducts
      .filter(p => {
        const pid = p._id || p.id;
        return pid?.toString() !== currentProductId?.toString();
      })
      .map(p => ({
        ...p,
        relevanceScore: 0, // No relevance scoring for search
        relevanceReasons: [] // No match reasons for search
      }))
      .sort((a, b) => {
        // Only sort: selected products first, then alphabetical by title
        const aId = a._id || a.id;
        const bId = b._id || b.id;
        const aSelected = formData.relatedProductIds?.some(id => id?.toString() === aId?.toString());
        const bSelected = formData.relatedProductIds?.some(id => id?.toString() === bId?.toString());
        
        if (aSelected && !bSelected) return -1;
        if (!aSelected && bSelected) return 1;
        
        // Alphabetical by title
        return (a.title || '').localeCompare(b.title || '');
      });
    
    return simpleSearchResults;
  }, [debouncedSearchQuery, searchedProducts, getSortedRelatedCandidates, product, formData.relatedProductIds]);

  const handleAutoSuggestRelated = () => {
    // Use filtered candidates (respects search if active)
    const candidatesToUse = filteredRelatedCandidates.length > 0 
      ? filteredRelatedCandidates 
      : getSortedRelatedCandidates;
    
    // Filter candidates that have meaningful relationships (score > 0)
    // Prioritize tag-based matches (score >= 5 means at least 1 shared tag)
    const tagBasedMatches = candidatesToUse
      .filter(c => c.relevanceScore >= 5) // At least 1 shared tag
      .slice(0, 3); // Top 3 tag-based matches
    
    // If we have tag matches, use them
    // Otherwise, fall back to any matches with score > 0
    const topMatches = tagBasedMatches.length > 0
      ? tagBasedMatches
      : candidatesToUse
          .filter(c => c.relevanceScore > 0)
          .slice(0, 4);
    
    const matchIds = topMatches.map(c => c._id || c.id);

    if (matchIds.length > 0) {
      const newSelection = Array.from(new Set([...(formData.relatedProductIds || []), ...matchIds]));
      setFormData({ ...formData, relatedProductIds: newSelection });
    } else {
      // More helpful message
      const hasCategory = formData.categoryId;
      const hasTags = formData.tagsInput?.trim() || formData.tags?.length > 0;
      
      if (!hasCategory && !hasTags) {
        alert("Please add a Category and Tags first to generate related product suggestions.");
      } else if (!hasTags) {
        alert("Add some Tags to get better related product suggestions. Tags are the primary signal for relationships.");
      } else {
        alert("No strong matches found. Try adding more specific tags or selecting products manually.");
      }
    }
  };

  const handleImageUpload = async (e, field) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setError('');
    try {
      if (field === 'heroImage') {
        const imageUrl = await uploadProductFile(files[0]);
        setFormData({ ...formData, heroImage: imageUrl });
      } else if (field === 'detailPhotos') {
        const existing = formData.detailPhotos || [];
        const remaining = Math.max(0, 3 - existing.length);
        const picked = Array.from(files).slice(0, remaining);
        if (picked.length === 0) return;
        const uploadPromises = picked.map(file => uploadProductFile(file));
        const newImageUrls = await Promise.all(uploadPromises);
        setFormData({ ...formData, detailPhotos: [...existing, ...newImageUrls].slice(0, 3) });
      } else {
        const uploadPromises = Array.from(files).map(file => uploadProductFile(file));
        const newImageUrls = await Promise.all(uploadPromises);
        setFormData({ ...formData, gallery: [...(formData.gallery || []), ...newImageUrls] });
      }
    } catch (error) {
      console.error("Upload failed", error);
      setError(`Image upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveGalleryImage = (index) => {
    const newGallery = formData.gallery.filter((_, i) => i !== index);
    setFormData({ ...formData, gallery: newGallery });
  };

  const handleRemoveDetailPhoto = (index) => {
    const next = (formData.detailPhotos || []).filter((_, i) => i !== index);
    setFormData({ ...formData, detailPhotos: next });
  };

  const handleAttachmentUpload = async (field, file) => {
    if (!file) return;
    setIsUploading(true);
    setError('');
    try {
      const fileUrl = await uploadProductFile(file, { allowedTypes: 'document', folder: 'products/attachments' });
      setFormData((prev) => ({ ...prev, [field]: fileUrl }));
    } catch (error) {
      console.error('Attachment upload failed', error);
      setError(`Attachment upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Testimonials helpers
  const addTestimonial = () => {
    const next = [
      ...(formData.testimonials || []),
      { quote: '', authorName: '', authorRole: '', companyName: '', companyLogo: '' },
    ];
    setFormData({ ...formData, testimonials: next });
  };

  const removeTestimonial = (index) => {
    const next = (formData.testimonials || []).filter((_, i) => i !== index);
    setFormData({ ...formData, testimonials: next });
  };

  const handleTestimonialChange = (index, field, value) => {
    const next = (formData.testimonials || []).map((t, i) => (i === index ? { ...t, [field]: value } : t));
    setFormData({ ...formData, testimonials: next });
  };

  const handleTestimonialLogoUpload = async (index, file) => {
    if (!file) return;
    setIsUploading(true);
    setError('');
    try {
      const imageUrl = await uploadProductFile(file);
      const next = (formData.testimonials || []).map((t, i) =>
        i === index ? { ...t, companyLogo: imageUrl } : t
      );
      setFormData({ ...formData, testimonials: next });
    } catch (error) {
      console.error('Upload failed', error);
      setError(`Image upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleSpecChange = (index, e) => {
    const { name, value } = e.target;
    const newSpecs = [...(formData.specifications || [])];
    newSpecs[index] = { ...newSpecs[index], [name]: value };
    setFormData({ ...formData, specifications: newSpecs });
  };
  
  const addSpec = () => {
    setFormData({ 
      ...formData, 
      specifications: [...(formData.specifications || []), { label: '', value: '', unit: '' }] 
    });
  };
  
  const removeSpec = (index) => {
    setFormData({ 
      ...formData, 
      specifications: (formData.specifications || []).filter((_, i) => i !== index) 
    });
  };

  const reorderSpecs = (fromIndex, toIndex) => {
    const newSpecs = [...(formData.specifications || [])];
    const [movedSpec] = newSpecs.splice(fromIndex, 1);
    newSpecs.splice(toIndex, 0, movedSpec);
    setFormData({ ...formData, specifications: newSpecs });
  };

  const handleSpecDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleSpecDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleSpecDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleSpecDrop = (e, index) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      reorderSpecs(draggedIndex, index);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleSpecDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  /**
   * Convert specifications array to JSON string
   */
  const convertSpecsToJson = () => serializeSpecificationsJson(formData.specifications || []);

  /**
   * Validate and parse JSON specifications (updates error state for the editor).
   * Returns the parsed payload or null when invalid.
   */
  const validateAndParseSpecJson = (jsonString) => {
    const result = parseSpecificationsJson(jsonString);
    if (!result.ok) {
      setSpecJsonError(result.error || 'Invalid specifications JSON');
      return null;
    }
    if (result.warning) {
      setSpecJsonError(result.warning);
    } else {
      setSpecJsonError('');
    }
    return { specifications: result.specifications };
  };

  /**
   * Apply JSON editor contents into formData.specifications, then return to the
   * form editor so the operator can see the applied rows immediately.
   */
  const handleApplySpecJson = () => {
    if (specJsonDebounceRef.current) {
      clearTimeout(specJsonDebounceRef.current);
    }

    const parsed = validateAndParseSpecJson(specJsonInput);
    if (parsed === null) return false;

    setFormData((prev) => ({
      ...prev,
      specifications: parsed.specifications,
    }));
    setSpecJsonMode(false);
    setSpecJsonAppliedAt(0);
    setSpecJsonError('');
    if (enableLocalDraft) {
      queueMicrotask(() => persistLocalDraft());
    }
    toast.success(
      parsed.specifications.length === 0
        ? 'Specifications cleared from JSON.'
        : `Applied ${parsed.specifications.length} specification${parsed.specifications.length === 1 ? '' : 's'}.`
    );
    return true;
  };

  /**
   * Handle switching to JSON mode
   */
  const handleSwitchToJsonMode = () => {
    // Clear any pending debounce
    if (specJsonDebounceRef.current) {
      clearTimeout(specJsonDebounceRef.current);
    }
    
    const jsonString = convertSpecsToJson();
    setSpecJsonInput(jsonString);
    setSpecJsonMode(true);
    setSpecJsonError('');
    setSpecJsonAppliedAt(0);
  };

  /**
   * Handle switching to form mode — applies JSON first so edits are not lost.
   */
  const handleSwitchToFormMode = () => {
    // Clear any pending debounce
    if (specJsonDebounceRef.current) {
      clearTimeout(specJsonDebounceRef.current);
    }
    
    const parsed = validateAndParseSpecJson(specJsonInput);
    
    if (parsed !== null) {
      setFormData((prev) => ({
        ...prev,
        specifications: parsed.specifications,
      }));
      setSpecJsonMode(false);
      setSpecJsonError('');
      setSpecJsonAppliedAt(0);
    }
    // If validation fails, stay in JSON mode and show error
  };

  /**
   * Handle JSON input change with real-time validation
   */
  const handleSpecJsonChange = (value) => {
    setSpecJsonInput(value);
    setSpecJsonAppliedAt(0);
    
    // Clear previous timeout
    if (specJsonDebounceRef.current) {
      clearTimeout(specJsonDebounceRef.current);
    }
    
    // Only validate if JSON mode is active
    if (specJsonMode) {
      if (!value.trim()) {
        setSpecJsonError('');
        return;
      }
      
      // Debounce validation for better UX
      specJsonDebounceRef.current = setTimeout(() => {
        validateAndParseSpecJson(value);
      }, 500);
    } else {
      setSpecJsonError('');
    }
  };

  const handleFilterChange = (index, e) => {
    const { name, value } = e.target;
    const newFilters = [...(formData.filters || [])];
    if (name === 'key') {
      newFilters[index] = { ...newFilters[index], key: value };
    } else if (name === 'values') {
      // Store as string during editing to allow natural comma typing
      newFilters[index] = { 
        ...newFilters[index], 
        values: value // Store raw string temporarily
      };
    }
    setFormData({ ...formData, filters: newFilters });
  };

  // Convert string values to array when user leaves the field
  const handleFilterBlur = (index) => {
    const newFilters = [...(formData.filters || [])];
    const filter = newFilters[index];
    
    if (typeof filter.values === 'string') {
      const valuesArray = filter.values.split(',').map(v => v.trim()).filter(Boolean);
      newFilters[index] = { 
        ...newFilters[index], 
        values: valuesArray // Convert to array (same format as before)
      };
      setFormData({ ...formData, filters: newFilters });
    }
  };

  const addFilter = () => {
    setFormData({ 
      ...formData, 
      filters: [...(formData.filters || []), { key: '', values: [] }] 
    });
  };
  
  const removeFilter = (index) => {
    setFormData({ 
      ...formData, 
      filters: (formData.filters || []).filter((_, i) => i !== index) 
    });
  };

  const handleAdditionalCategoryChange = (index, level, id) => {
    const newSelections = [...additionalCategorySelections];
    const newSelection = { [level]: id };
    const levelOrder = ['department', 'category', 'subcategory', 'type'];
    const currentLevelIndex = levelOrder.indexOf(level);
    
    // Preserve parent selections
    if (newSelections[index]) {
      for (let i = 0; i < currentLevelIndex; i++) {
        const parentLevel = levelOrder[i];
        if (newSelections[index][parentLevel]) {
          newSelection[parentLevel] = newSelections[index][parentLevel];
        }
      }
    }
    
    newSelections[index] = newSelection;
    setAdditionalCategorySelections(newSelections);

    // Update categoryIds array
    const updatedCategoryIds = newSelections.map(sel => {
      const mostSpecificLevel = ['type', 'subcategory', 'category', 'department'].find(l => sel[l]);
      return mostSpecificLevel ? sel[mostSpecificLevel] : null;
    }).filter(Boolean);

    setFormData({ ...formData, categoryIds: updatedCategoryIds });
  };

  const addAdditionalCategory = () => {
    setAdditionalCategorySelections([...additionalCategorySelections, {}]);
  };

  const removeAdditionalCategory = (index) => {
    const newSelections = additionalCategorySelections.filter((_, i) => i !== index);
    setAdditionalCategorySelections(newSelections);
    
    // Update categoryIds array
    const updatedCategoryIds = newSelections.map(sel => {
      const mostSpecificLevel = ['type', 'subcategory', 'category', 'department'].find(l => sel[l]);
      return mostSpecificLevel ? sel[mostSpecificLevel] : null;
    }).filter(Boolean);

    setFormData({ ...formData, categoryIds: updatedCategoryIds });
  };

  const handleColorChange = (color) => {
    const currentVariants = formData.colorVariants || [];
    const isSelected = currentVariants.some((v) => v.colorName === color.name);

    if (isSelected) {
      const newVariants = ensureOneDefaultColorVariant(
        currentVariants.filter((v) => v.colorName !== color.name)
      );
      setFormData({ ...formData, colorVariants: newVariants });
    } else {
      const newVariants = ensureOneDefaultColorVariant([
        ...currentVariants,
        { colorName: color.name, colorHex: color.hex, images: [], isDefault: false },
      ]);
      setFormData({ ...formData, colorVariants: newVariants });
    }
  };

  const handleAddCustomColor = () => {
    if (!customColorName.trim()) {
      setError('Please provide a color name');
      return;
    }
    if (!customColorHex.match(/^#[0-9A-Fa-f]{6}$/)) {
      setError('Please provide a valid hex color code');
      return;
    }

    const currentVariants = formData.colorVariants || [];
    if (currentVariants.some((v) => v.colorName.toLowerCase() === customColorName.trim().toLowerCase())) {
      setError('A color with this name already exists');
      return;
    }

    const newVariants = ensureOneDefaultColorVariant([
      ...currentVariants,
      {
        colorName: customColorName.trim(),
        colorHex: customColorHex.toUpperCase(),
        images: [],
        isDefault: false,
      },
    ]);
    setFormData({ ...formData, colorVariants: newVariants });
    setShowColorPicker(false);
    setCustomColorName('');
    setCustomColorHex('#000000');
    setError('');
  };

  const handleRemoveCustomColor = (colorName) => {
    const currentVariants = formData.colorVariants || [];
    const newVariants = ensureOneDefaultColorVariant(
      currentVariants.filter((v) => v.colorName !== colorName)
    );
    setFormData({ ...formData, colorVariants: newVariants });
  };

  // Get custom colors (colors not in AVAILABLE_COLORS)
  const getCustomColors = () => {
    const predefinedColorNames = AVAILABLE_COLORS.map(c => c.name.toLowerCase());
    return (formData.colorVariants || []).filter(v => 
      !predefinedColorNames.includes(v.colorName.toLowerCase())
    );
  };

  const handleColorImageUpload = async (e, colorName) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setError('');
    try {
      const uploadPromises = Array.from(files).map(file => uploadProductFile(file));
      const newImageUrls = await Promise.all(uploadPromises);
      const updatedVariants = (formData.colorVariants || []).map(variant => 
        variant.colorName === colorName 
          ? { ...variant, images: [...variant.images, ...newImageUrls] } 
          : variant
      );
      setFormData({ ...formData, colorVariants: updatedVariants });
    } catch (error) {
      console.error("Upload failed", error);
      setError(`Image upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveColorImage = (colorName, imageIndex) => {
    const updatedVariants = (formData.colorVariants || []).map(variant => 
      variant.colorName === colorName 
        ? { ...variant, images: variant.images.filter((_, i) => i !== imageIndex) } 
        : variant
    );
    setFormData({ ...formData, colorVariants: updatedVariants });
  };

  // FAQs helpers
  const addFaq = () => {
    const next = [...(formData.faqs || []), { question: '', answer: '' }];
    setFormData({ ...formData, faqs: next });
  };

  const removeFaq = (index) => {
    const next = (formData.faqs || []).filter((_, i) => i !== index);
    setFormData({ ...formData, faqs: next });
  };

  const handleFaqChange = (index, field, value) => {
    const next = (formData.faqs || []).map((f, i) => (i === index ? { ...f, [field]: value } : f));
    setFormData({ ...formData, faqs: next });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting || isUploading || saving) return;
    setIsSubmitting(true);
    setError('');
    try {

    const rowsForVariantSubmit = isChildProduct ? [] : (variantRows || []);
    const normalizedVariants = rowsForVariantSubmit
      .filter((row) => row && typeof row === 'object')
      .map((row) => {
        const colorName = String(row.color || '').trim();
        const resolvedColor = resolveColorDisplay(
          row.colorDetails || (row.colorHex ? { colorName, colorHex: row.colorHex, swatch: row.colorSwatch } : colorName),
          formData.colorVariants
        );
        const colorHex = String(row.colorHex || resolvedColor?.colorHex || '').trim();
        const colorSwatch = String(row.colorSwatch || resolvedColor?.swatch || '').trim();
        const colorDetails = resolvedColor ? {
          colorName: resolvedColor.colorName,
          colorHex: resolvedColor.colorHex,
          swatch: resolvedColor.swatch || '',
        } : null;

        return {
          variantId: String(row.variantId || '').trim() || generatePersistedVariantId(),
          images: resolveVariantRowImages(row, formData.colorVariants, formData.heroImage),
          name: String(row.name || formData.title || '').trim(),
          size: String(row.size || '').trim(),
          unit: String(row.unit || '').trim(),
          color: colorName,
          colorHex,
          colorSwatch,
          colorDetails,
          unitCount: String(row.unitCount || '').trim(),
          weight: String(row.weight || '').trim(),
          isDefault: Boolean(row.isDefault),
          showInCatalog: row.showInCatalog === true,
          sku: String(row.sku || '').trim(),
          barcode: String(row.barcode || '').trim(),
          hsnCode: String(row.hsnCode || '').trim(),
          gstPercent: Number(row.gstPercent || 0),
          mrp: Number(row.mrp || 0),
          sellingPrice: Number(row.sellingPrice || 0),
          discountPercent: Number(row.discountPercent || 0),
          marginPrice: Number(row.marginPrice || 0),
          price: Number(row.sellingPrice || row.price || 0),
          _childProductId: row._childProductId || null,
          _legacyParentVariantId: row._legacyParentVariantId || '',
        };
      })
      .filter(
        (row) =>
          row.name ||
          row.sku ||
          row.barcode ||
          row.hsnCode ||
          row.color ||
          row.size ||
          row.unit ||
          row.weight ||
          row.unitCount
      );

    if (normalizedVariants.length > 0) {
      const explicitDefaultIndex = normalizedVariants.findIndex((row) => row.isDefault);
      const resolvedDefaultIndex = explicitDefaultIndex >= 0 ? explicitDefaultIndex : 0;
      const variantsWithSingleDefault = normalizedVariants.map((row, idx) => ({
        ...row,
        isDefault: idx === resolvedDefaultIndex,
      }));
      const defaultRow = variantsWithSingleDefault[resolvedDefaultIndex];
      const nonDefaultRows = variantsWithSingleDefault.filter((_, idx) => idx !== resolvedDefaultIndex);
      normalizedVariants.length = 0;
      normalizedVariants.push(defaultRow, ...nonDefaultRows);
    }

    // Only title and hero image are required - everything else can be added later
    if (!formData.title || !formData.heroImage) {
      setError("Please provide a Title and a Hero Image.");
      return;
    }

    if (variantWorkflowEnabled && normalizedVariants.length === 0) {
      setError('Add at least one variant in the Variants section, or switch to a single product (No variants).');
      toast.error('Add at least one variant row before saving.');
      return;
    }

    if (variantWorkflowEnabled && normalizedVariants.length > 0) {
      const axisMsg = validateVariantRowsAgainstAxes(normalizedVariants, variantFieldSelection);
      if (axisMsg) {
        setError(axisMsg);
        toast.error(axisMsg);
        return;
      }
    }

    const parentOrSelfId = product?._id || product?.id || null;

    if (normalizedVariants.length > 0) {
      const duplicateBarcodeMsg = findDuplicateBarcodesInRows(normalizedVariants);
      if (duplicateBarcodeMsg) {
        setError(duplicateBarcodeMsg);
        toast.error(duplicateBarcodeMsg);
        return;
      }
      const catalogBarcodeMsg = await validateVariantBarcodesAgainstCatalog(normalizedVariants, {
        parentProductId: parentOrSelfId,
      });
      if (catalogBarcodeMsg) {
        setError(catalogBarcodeMsg);
        toast.error(catalogBarcodeMsg);
        return;
      }
    } else if (!isChildProduct) {
      const standaloneBarcode = String(formData.barcode || '').trim();
      if (standaloneBarcode) {
        const catalogBarcodeMsg = await validateVariantBarcodesAgainstCatalog(
          [{ barcode: standaloneBarcode, _childProductId: parentOrSelfId }],
          { parentProductId: parentOrSelfId }
        );
        if (catalogBarcodeMsg) {
          setError(catalogBarcodeMsg);
          toast.error(catalogBarcodeMsg);
          return;
        }
      }
    }

    // Detail photos are optional:
    // - allow 0 photos
    // - allow exactly 3 photos
    // - disallow 1 2 photos (incomplete set for the UI)
    const detailPhotosCount = (formData.detailPhotos || []).filter(Boolean).length;
    if (detailPhotosCount !== 0 && detailPhotosCount !== 3) {
      setError("Detail Page Photos must be either 0 or exactly 3 images.");
      return;
    }

    if (normalizedVariants.length > 0) {
      const firstInvalidIndex = normalizedVariants.findIndex((row) => {
        const rowErrors = getVariantPricingErrors(row);
        return rowErrors.sellingPrice || rowErrors.marginPrice || rowErrors.discountPercent;
      });

      if (firstInvalidIndex >= 0) {
        const invalidRow = normalizedVariants[firstInvalidIndex];
        const rowErrors = getVariantPricingErrors(invalidRow);
        let message = `Variant #${firstInvalidIndex + 1} has invalid pricing.`;
        if (rowErrors.sellingPrice) {
          message = `Variant #${firstInvalidIndex + 1}: Selling Price cannot exceed MRP.`;
        } else if (rowErrors.marginPrice) {
          message = `Variant #${firstInvalidIndex + 1}: Margin Price cannot exceed Selling Price.`;
        } else if (rowErrors.discountPercent) {
          message = `Variant #${firstInvalidIndex + 1}: Discount must be less than 100%.`;
        }
        setError(message);
        toast.error(message);
        return;
      }
    } else if (showStandaloneCommerceFields) {
      const rowErrors = getStandalonePricingErrors();
      if (rowErrors.sellingPrice || rowErrors.marginPrice || rowErrors.discountPercent) {
        let message = 'Invalid pricing on the product form.';
        if (rowErrors.sellingPrice) {
          message = 'Selling Price cannot exceed MRP.';
        } else if (rowErrors.marginPrice) {
          message = 'Margin Price cannot exceed Selling Price.';
        } else if (rowErrors.discountPercent) {
          message = 'Discount must be less than 100%.';
        }
        setError(message);
        toast.error(message);
        return;
      }
    }
    
    // Auto-link brand category if brand text matches a department (check synchronously)
    let updatedBrandCategoryId = formData.brandCategoryId;
    if (!updatedBrandCategoryId && formData.brand && formData.brand.trim() && brands && brands.length > 0) {
      const brandText = formData.brand.trim();
      const matchingBrand = brands.find(b => 
        b.level === 'department' && 
        b.name.toLowerCase() === brandText.toLowerCase()
      );
      if (matchingBrand) {
        updatedBrandCategoryId = (matchingBrand._id || matchingBrand.id).toString();
        // Also update state for UI feedback
        setBrandSelection({ department: updatedBrandCategoryId });
      }
    }
    
    /**
     * Always merge generated tags on Save so search stays complete even if
     * the user never opened Content or clicked Auto-generate.
     * Manual tags are preserved; generator only fills gaps.
     */
    const existingTags = formData.tagsInput
      ? formData.tagsInput.split(',').map((t) => normalizeTag(t)).filter(Boolean)
      : Array.isArray(formData.tags)
        ? formData.tags.map((t) => normalizeTag(t)).filter(Boolean)
        : [];
    const generatedTags = generateProductTags(formData, categories, brands, businessTypes, {
      variantRows,
      variantBuilderInputs,
    });
    const tags = mergeProductTags(existingTags, generatedTags);

    // Keep the Content tags field in sync with what we persist
    if (tags.join(', ') !== (formData.tagsInput || '')) {
      setFormData((prev) => ({
        ...prev,
        tagsInput: tags.join(', '),
      }));
    }
    
    // Ensure categoryIds is properly formatted
    const categoryIds = (formData.categoryIds || []).filter(id => id && id.trim() !== '');
    const brandCategoryIds = (formData.brandCategoryIds || []).filter(id => id && id.trim() !== '');

    // Process filters - filter out empty ones and ensure values are arrays
    const filters = (formData.filters || [])
      .map(f => {
        // Convert string to array if needed (in case blur didn't fire)
        let values = f.values;
        if (typeof values === 'string') {
          values = values.split(',').map(v => v.trim()).filter(Boolean);
        }
        return {
          key: f.key?.trim(),
          values: Array.isArray(values) ? values.filter(v => v && v.trim()) : []
        };
      })
      .filter(f => f.key && f.key.trim() && f.values.length > 0);

    const normalizedPriceBySize = (formData.priceBySize || [])
      .filter(row => row && typeof row === 'object')
      .map(row => ({
        price: Number(row.price || 0),
        size: String(row.size || '').trim(),
        unit: String(row.unit || '').trim(),
      }))
      .filter(row => Number.isFinite(row.price) && row.price > 0);

    // Keep sidebar/catalog Size filter aligned with Price by Size rows.
    const sizeValuesFromPriceBySize = Array.from(
      new Set(
        normalizedPriceBySize
          .map(row => row.size)
          .filter(Boolean)
      )
    );

    const filtersWithSizeFromPricing = (() => {
      const nextFilters = [...filters];
      const sizeFilterIndex = nextFilters.findIndex(
        f => String(f.key || '').toLowerCase() === 'size'
      );

      if (sizeValuesFromPriceBySize.length === 0) return nextFilters;

      if (sizeFilterIndex >= 0) {
        const existing = Array.isArray(nextFilters[sizeFilterIndex].values)
          ? nextFilters[sizeFilterIndex].values
          : [];
        const mergedValues = Array.from(new Set([...existing, ...sizeValuesFromPriceBySize]));
        nextFilters[sizeFilterIndex] = {
          ...nextFilters[sizeFilterIndex],
          values: mergedValues,
        };
        return nextFilters;
      }

      nextFilters.push({ key: 'Size', values: sizeValuesFromPriceBySize });
      return nextFilters;
    })();

    const derivedBasePrice =
      normalizedVariants.length > 0
        ? Math.min(...normalizedVariants.map((row) => Number(row.price || 0)))
        : normalizedPriceBySize.length > 0
          ? Math.min(...normalizedPriceBySize.map(r => r.price))
          : Number(formData.sellingPrice || formData.price || 0);

    const standaloneVariationAttributes = showStandaloneCommerceFields
      ? {
          ...(formData.variationAttributes && typeof formData.variationAttributes === 'object'
            ? formData.variationAttributes
            : {}),
          unit: String(formData.unit || '').trim(),
        }
      : formData.variationAttributes;

    // Strip the row-only book-keeping fields before sending to the API. We forward
    // them out-of-band as `_variantRows` so the consumer (add page / admin edit)
    // can create/update real child product documents after saving the parent.
    const variantRowsForChildren = normalizedVariants.map((row) => {
      const { _childProductId, _legacyParentVariantId, ...rest } = row;
      return { ...rest, _childProductId: _childProductId || null, _legacyParentVariantId: _legacyParentVariantId || '' };
    });

    // Don't persist row-private fields on the embedded `variants[]` payload.
    const variantsForLegacyEmbed = variantRowsForChildren.map(({ _childProductId, _legacyParentVariantId, ...rest }) => rest);

    // Auto-sync parent colorVariants: ensure every variant's color has a corresponding definition
    // on the parent so the storefront color picker and catalog filters stay completely in sync.
    const existingColorVariants = Array.isArray(formData.colorVariants) ? [...formData.colorVariants] : [];
    const existingColorNames = new Set(
      existingColorVariants.map((cv) => String(cv?.colorName || '').trim().toLowerCase())
    );

    normalizedVariants.forEach((row) => {
      const rowColor = String(row.color || '').trim();
      if (!rowColor) return;
      const lower = rowColor.toLowerCase();
      if (!existingColorNames.has(lower)) {
        const resolved = resolveColorDisplay(row.colorDetails || rowColor, existingColorVariants);
        existingColorVariants.push({
          colorName: resolved?.colorName || rowColor,
          colorHex: resolved?.colorHex || '#CCCCCC',
          images: [],
          isDefault: existingColorVariants.length === 0,
        });
        existingColorNames.add(lower);
      }
    });

    const finalProduct = {
      ...formData,
      colorVariants: ensureOneDefaultColorVariant(existingColorVariants),
      gstPercent: Number(formData.gstPercent || 0),
      mrp: Number(formData.mrp || 0),
      sellingPrice: Number(formData.sellingPrice || 0),
      discountPercent: Number(formData.discountPercent || 0),
      marginPrice: Number(formData.marginPrice || 0),
      variationAttributes: standaloneVariationAttributes,
      variants: variantsForLegacyEmbed,
      _variantRows: variantRowsForChildren,
      _initialChildIds: [...initialChildIdsRef.current],
      brandCategoryId: updatedBrandCategoryId || formData.brandCategoryId,
      priceBySize: normalizedPriceBySize,
      price: Number.isFinite(derivedBasePrice) ? derivedBasePrice : 0,
      originalPrice: formData.originalPrice && Number(formData.originalPrice) > 0 ? Number(formData.originalPrice) : null,
      tags,
      categoryIds,
      brandCategoryIds,
      filters: filtersWithSizeFromPricing,
    };

    // Mark this product as a parent carrier so the storefront chokepoint hides it.
    if (normalizedVariants.length > 0) {
      finalProduct.sku = '';
      finalProduct.barcode = '';
      finalProduct.productType = 'parent';
      finalProduct.visibleOnClient = false;
      finalProduct.variationTheme = Object.entries(variantFieldSelection || {})
        .filter(([, on]) => on)
        .map(([k]) => k);
    } else if (showStandaloneCommerceFields) {
      finalProduct.productType = 'standalone';
    }

    delete finalProduct.unit;
    delete finalProduct.tagsInput;

    if (isChildProduct) {
      stripChildVariantOwnedFields(finalProduct);
      delete finalProduct._variantRows;
      delete finalProduct._initialChildIds;
    }

    // Ensure categoryId is included if it exists (even if empty string, API will handle it)
    // categoryId should be set when a "type" level category is selected
    if (finalProduct.categoryId === '' || finalProduct.categoryId === null || finalProduct.categoryId === undefined) {
      // Remove empty categoryId - API will handle this
      delete finalProduct.categoryId;
    }

    // Ensure brandCategoryId is included if it exists
    if (finalProduct.brandCategoryId === '' || finalProduct.brandCategoryId === null || finalProduct.brandCategoryId === undefined) {
      delete finalProduct.brandCategoryId;
    }

    finalProduct.status = finalProduct.status || 'In Stock';

      const saveResult = await onSave(finalProduct);
      /**
       * Only after a successful save: allow browser leave without warning and
       * clear the Add draft so the next visit does not restore this product.
       * onSave returns false when create failed without throwing.
       */
      if (enableLocalDraft && saveResult !== false) {
        allowLeaveWithoutWarningRef.current = true;
        clearProductAddDraft();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const formApi = {
    enableLocalDraft,
    initialLocalDraft,
    localDraftRestored,
    handleLocalDraftFieldComplete,
    product,
    allProducts: allProducts || [],
    onSave,
    onCancel,
    onCategoryChange,
    onOpenParent,
    currentStep,
    setCurrentStep,
    formData,
    setFormData,
    handleChange,
    handleSubmit,
    isUploading,
    isSubmitting: isSubmitting || saving,
    error,
    setError,
    isChildProduct,
    variantWorkflowEnabled,
    showStandaloneCommerceFields,
    awaitingVariantChoice,
    hasVariantsChoice,
    handleChooseProductVariantMode,
    variantRows,
    variantFieldSelection,
    selectedVariantFieldCount,
    handleVariantFieldToggle,
    variantDraftValue,
    setVariantDraftValue,
    addVariantOptionValue,
    removeVariantOptionValue,
    variantBuilderInputs,
    renderVariantOptionValueChips,
    fullFormColorNames,
    handleGenerateVariantRows,
    handleAddSingleVariantRow,
    handleClearVariantBuilder,
    selectedVariantRowIndex,
    setSelectedVariantRowIndex,
    bulkVariantInputs,
    handleBulkVariantInputChange,
    handleApplyBulkInputs,
    handleSetDefaultVariantRow,
    handleVariantRowChange,
    handleVariantRowImageUpload,
    handleRemoveVariantRowImage,
    handleDeleteVariantRow,
    recentlyDeletedVariantRow,
    handleUndoDeleteVariantRow,
    variantTableColorOptions,
    getVariantPricingErrors,
    getStandalonePricingErrors,
    handleStandalonePricingChange,
    addPriceBySizeRow,
    removePriceBySizeRow,
    handlePriceBySizeChange,
    handleAIGenerate,
    aiLoading,
    aiCooldown,
    brandInputRef,
    handleBrandInputChange,
    setBrandInputFocused,
    getBrandSuggestions,
    setBrandSuggestions,
    setShowBrandSuggestions,
    showBrandSuggestions,
    brandSuggestions,
    brandSuggestionsRef,
    handleBrandSuggestionSelect,
    categories,
    brands,
    businessTypes,
    categorySelection,
    handleCategoryChange,
    additionalCategorySelections,
    handleAdditionalCategoryChange,
    addAdditionalCategory,
    removeAdditionalCategory,
    brandSelection,
    handleBrandCategoryChange,
    additionalBrandSelections,
    handleAdditionalBrandCategoryChange,
    addAdditionalBrandCategory,
    removeAdditionalBrandCategory,
    handleBusinessTypeChange,
    handleImageUpload,
    handleRemoveGalleryImage,
    handleRemoveDetailPhoto,
    handleAttachmentUpload,
    handleColorChange,
    getCustomColors,
    handleRemoveCustomColor,
    handleOpenColorPicker,
    showColorPicker,
    setShowColorPicker,
    customColorHex,
    setCustomColorHex,
    customColorName,
    setCustomColorName,
    handleAddCustomColor,
    handleColorImageUpload,
    handleRemoveColorImage,
    childAssignedColorDisplay,
    childAssignedColorName,
    childAssignedColorIsPredefined,
    specifications: formData.specifications,
    handleSpecChange,
    addSpec,
    removeSpec,
    handleSpecDragStart,
    handleSpecDragOver,
    handleSpecDragLeave,
    handleSpecDrop,
    handleSpecDragEnd,
    dragOverIndex,
    specJsonMode,
    specJsonInput,
    specJsonError,
    specJsonAppliedAt,
    handleSwitchToJsonMode,
    handleSwitchToFormMode,
    handleSpecJsonChange,
    handleApplySpecJson,
    handleFilterChange,
    handleFilterBlur,
    addFilter,
    removeFilter,
    addFaq,
    removeFaq,
    handleFaqChange,
    addTestimonial,
    removeTestimonial,
    handleTestimonialChange,
    handleTestimonialLogoUpload,
    relatedProductsSearchQuery,
    setRelatedProductsSearchQuery,
    debouncedSearchQuery,
    filteredRelatedCandidates,
    searchedProducts,
    handleRelatedProductChange,
    handleFrequentlyOrderedProductChange,
    handleAutoSuggestRelated,
    handleAutoGenerateTags,
    showTagsPreview,
    setShowTagsPreview,
    generatedTagsPreview,
  };

  return (
    <ProductFormProvider value={formApi}>
      <ProductFormShell />
    </ProductFormProvider>
  );
}
