/**
 * Dedicated edit page for the product wizard.
 * Replaces the cramped list-page modal so stepper, readiness, and Save stay visible.
 *
 * Parents are loaded via the admin children API (raw family card + child SKUs).
 * Public GET would replace a parent with its default child and break the matrix.
 */

'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import ProductForm from '@/components/ProductForm';
import { showToast } from '@/lib/utils/toast';
import { ApiError } from '@/lib/utils/apiClient';
import { loadProductForAdminForm, updateAdminProduct } from '@/lib/client/saveAdminProduct';

export default function AdminEditProductPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-6xl px-4 py-8 text-center text-gray-500">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          <p className="mt-2 text-sm">Loading product…</p>
        </div>
      }
    >
      <AdminEditProductPageInner />
    </Suspense>
  );
}

function AdminEditProductPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const productId = params?.id;
  const initialView = searchParams?.get('step') === 'selling' ? 'variants' : 'full';

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    setError('');
    try {
      const loaded = await loadProductForAdminForm(productId);
      setProduct(loaded);
    } catch (err) {
      setError(err.message || 'Failed to load product');
      showToast.error(err.message || 'Failed to load product');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (productData) => {
    const toastId = showToast.loading('Saving product...');
    setSaving(true);
    try {
      const { children } = await updateAdminProduct(productId, productData, {
        parentTitle: product?.title,
      });
      if (children.errors?.length > 0) {
        const firstMsg = children.errors[0]?.message || 'Unknown error';
        showToast.error(`${children.errors.length} variant(s) failed to save: ${firstMsg}`);
        return;
      }
      const syncedCount = (children.created || 0) + (children.updated || 0);
      const deletedCount = children.deleted || 0;
      showToast.success(
        syncedCount > 0 || deletedCount > 0
          ? `Product updated. Synced ${syncedCount} variant(s)${deletedCount > 0 ? `, removed ${deletedCount}` : ''}.`
          : 'Product updated successfully'
      );
      router.push('/admin/products');
    } catch (err) {
      if (err instanceof ApiError) {
        showToast.error(err.message);
        setError(err.message);
      } else {
        showToast.error('Failed to update product');
        setError('Failed to update product');
      }
    } finally {
      toast.dismiss(toastId);
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 text-center text-gray-500">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        <p className="mt-2 text-sm">Loading product…</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <p className="text-red-600">{error || 'Product not found'}</p>
        <button
          type="button"
          onClick={() => router.push('/admin/products')}
          className="mt-4 rounded-md bg-gray-200 px-4 py-2 text-sm font-semibold"
        >
          Back to products
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-8">
      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      <h1 className="mb-1 text-2xl font-bold text-gray-900 sm:text-3xl">Edit product</h1>
      <p className="mb-6 truncate text-sm text-gray-500">{product.title}</p>
      <ProductForm
        key={product._id || product.id}
        product={product}
        allProducts={[]}
        initialView={initialView}
        onSave={handleSave}
        onCancel={() => router.push('/admin/products')}
        saving={saving}
        onOpenParent={(parentId) => {
          if (!parentId) return;
          router.push(`/admin/products/${parentId}/edit?step=selling`);
        }}
      />
    </div>
  );
}
