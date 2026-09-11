/**
 * Shared create/update path for the admin product wizard.
 *
 * Parent document is saved first; child SKUs are materialized afterwards so
 * inventory and barcodes stay on real child products — not on the family card.
 *
 * POST /api/products then saveProductChildren
 * PUT  /api/products/:id then saveProductChildren
 */

import { apiClient } from '@/lib/utils/apiClient';
import { adminFetch, adminJson } from '@/lib/client/adminFetch';
import { saveProductChildren } from '@/lib/utils/saveProductChildren';

/**
 * Load a product for the add/edit wizard.
 *
 * GET /api/products/:id runs resolveProduct, which replaces a parent with the
 * default child so the storefront never shows the family card. The wizard must
 * edit the parent document + children table, so families are loaded from the
 * admin children endpoint first (raw parent, not the merged child).
 */
export async function loadProductForAdminForm(productId) {
  try {
    const family = await adminJson(`/api/admin/products/${productId}/children`);
    if (family?.success && family.parent?.productType === 'parent') {
      return {
        ...family.parent,
        children: family.children || [],
      };
    }
  } catch (err) {
    // Standalone and child SKUs are not families; fall through to product GET.
    console.warn('Admin family load skipped:', err?.message || err);
  }

  const response = await adminFetch(`/api/products/${productId}`);
  const data = await response.json();
  if (!response.ok || !data.success || !data.product) {
    throw new Error(data.error || 'Failed to load product details');
  }
  return data.product;
}

function splitVariantMeta(productData) {
  const variantRows = Array.isArray(productData._variantRows) ? productData._variantRows : [];
  const variationTheme = Array.isArray(productData.variationTheme)
    ? productData.variationTheme
    : [];
  const initialChildIds = Array.isArray(productData._initialChildIds)
    ? productData._initialChildIds
    : [];
  return { variantRows, variationTheme, initialChildIds };
}

export async function createAdminProduct(productData) {
  const { variantRows, variationTheme } = splitVariantMeta(productData);

  const response = await apiClient.requestWithRetry('/api/products', {
    method: 'POST',
    body: productData,
  });

  const createdProduct = response?.product || response?.data?.product;
  const parentId = createdProduct?._id || createdProduct?.id;

  let children = { created: 0, updated: 0, deleted: 0, errors: [] };
  if (variantRows.length > 0 && parentId) {
    children = await saveProductChildren({
      parentId,
      parent: { title: productData.title },
      variantRows,
      variationTheme,
    });
  }

  return { product: createdProduct, children };
}

export async function updateAdminProduct(productId, productData, { parentTitle } = {}) {
  const { variantRows, variationTheme, initialChildIds } = splitVariantMeta(productData);

  await apiClient.requestWithRetry(`/api/products/${productId}`, {
    method: 'PUT',
    body: productData,
  });

  const children = await saveProductChildren({
    parentId: productId,
    parent: { title: productData.title || parentTitle },
    variantRows,
    variationTheme,
    initialChildIds,
  });

  return { children };
}
