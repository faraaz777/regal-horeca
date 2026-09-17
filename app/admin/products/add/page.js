/**
 * Admin Add Product
 *
 * Related/FBT search is owned by ProductForm (type-to-search). This page does
 * not prefetch the catalog — that 1000-row request was unused until merchandising.
 *
 * Excel import is optional: it prefills this same form (no _id). Save still
 * goes through createAdminProduct.
 *
 * Local draft (Strategy A): field-complete + variant-section autosave to
 * localStorage; auto-restore on reload; browser beforeunload warning.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import ProductForm from '@/components/ProductForm';
import ProductImportPanel, { ProductImportButtons } from '@/components/admin/products/ProductImportPanel';
import { showToast } from '@/lib/utils/toast';
import { ApiError } from '@/lib/utils/apiClient';
import { createAdminProduct } from '@/lib/client/saveAdminProduct';
import { readImportProductDraft } from '@/lib/client/productImportDraft';
import { readProductAddDraft, clearProductAddDraft } from '@/lib/client/productFormDraft';

export default function AdminAddProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [seedProduct, setSeedProduct] = useState(null);
  const [seedSource, setSeedSource] = useState(null);
  const [initialLocalDraft, setInitialLocalDraft] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [isCheckingSeed, setIsCheckingSeed] = useState(true);

  useEffect(() => {
    try {
      const imported = readImportProductDraft();
      if (imported) {
        clearProductAddDraft();
        setSeedProduct(imported);
        setSeedSource('import');
        setInitialLocalDraft(null);
        setFormKey((key) => key + 1);
        return;
      }

      const duplicateData = sessionStorage.getItem('duplicateProductData');
      if (duplicateData) {
        clearProductAddDraft();
        setSeedProduct(JSON.parse(duplicateData));
        setSeedSource('duplicate');
        setInitialLocalDraft(null);
        sessionStorage.removeItem('duplicateProductData');
        setFormKey((key) => key + 1);
        return;
      }

      const localDraft = readProductAddDraft();
      if (localDraft) {
        setSeedProduct(null);
        setSeedSource('draft');
        setInitialLocalDraft(localDraft);
        setFormKey((key) => key + 1);
      }
    } catch (err) {
      console.error('Error parsing product seed data:', err);
      showToast.error('Failed to load copied, imported, or draft product data');
    } finally {
      setIsCheckingSeed(false);
    }
  }, []);

  const applyImport = (payload) => {
    clearProductAddDraft();
    setSeedProduct(payload);
    setSeedSource('import');
    setInitialLocalDraft(null);
    setFormKey((key) => key + 1);
    setError('');
    showToast.success('Spreadsheet row loaded. Review and Save when ready.');
  };

  const handleSave = async (productData) => {
    const toastId = showToast.loading('Creating product...');
    setLoading(true);
    setError('');

    try {
      if (!productData.slug) {
        productData.slug = productData.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
      }

      const { children } = await createAdminProduct(productData);
      if (children.errors?.length > 0) {
        const firstMsg = children.errors[0]?.message || 'Unknown error';
        showToast.error(`${children.errors.length} variant(s) failed to save: ${firstMsg}`);
        return false;
      }

      const variantCount = children.created || 0;
      showToast.success(
        variantCount > 0
          ? `Product created with ${variantCount} variant(s)`
          : 'Product created successfully'
      );
      router.push('/admin/products');
      return true;
    } catch (err) {
      if (err instanceof ApiError) {
        showToast.error(err.message);
        setError(err.message);
      } else {
        showToast.error('An error occurred while creating the product');
        setError('An error occurred while creating the product');
      }
      return false;
    } finally {
      toast.dismiss(toastId);
      setLoading(false);
    }
  };

  if (isCheckingSeed) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 text-center text-gray-500">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        <p className="mt-2 text-sm">Loading…</p>
      </div>
    );
  }

  const heading =
    seedSource === 'import'
      ? 'Add product (from Excel)'
      : seedSource === 'duplicate'
        ? 'Duplicate product'
        : seedSource === 'draft'
          ? 'Add product (draft restored)'
          : 'Add product';

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-8">
      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-gray-900 sm:text-3xl">{heading}</h1>
          <p className="text-sm text-gray-500">
            Identity and a hero image are enough to save. Selling, media, and extras can wait.
            {seedSource !== 'import' && seedSource !== 'duplicate' ? (
              <> Fields autosave locally; reload restores your draft.</>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ProductImportButtons onImport={() => setImportOpen(true)} />
        </div>
      </div>

      {seedSource === 'duplicate' ? (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          Review the copied fields before saving. SKU and barcode should be unique.
        </div>
      ) : null}
      {seedSource === 'import' ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Loaded from Excel. Review brand, category, pricing, and upload a hero image if it is
          missing — then Save. Nothing was written to the catalog yet.
        </div>
      ) : null}
      {seedSource === 'draft' ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Restored your local draft from this browser. Closing or reloading will warn you while
          unsaved work remains — Save writes it to the catalog.
        </div>
      ) : null}

      <ProductForm
        key={formKey}
        product={seedProduct || null}
        initialLocalDraft={initialLocalDraft}
        enableLocalDraft
        allProducts={[]}
        onSave={handleSave}
        onCancel={() => router.push('/admin/products')}
        saving={loading}
      />

      <ProductImportPanel
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onOpenInForm={applyImport}
      />
    </div>
  );
}
