'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { PlusIcon, EditIcon, TrashIcon, SearchIcon, ChevronLeftIcon, ChevronRightIcon, DuplicateIcon, RestoreIcon } from '@/components/Icons';
import ProductForm from '@/components/ProductForm';
import { showToast } from '@/lib/utils/toast';
import { apiClient, ApiError } from '@/lib/utils/apiClient';
import { saveProductChildren } from '@/lib/utils/saveProductChildren';
import { childRowListedInStorefrontCatalog } from '@/lib/utils/storefrontCatalogFilter';

const ITEMS_PER_PAGE = 20;

/** Emerald “In catalog” pill: opens storefront PDP for this row’s slug in a new tab. */
function StorefrontInCatalogBadge({ slug, size = 'md' }) {
  const trimmed = slug != null ? String(slug).trim() : '';
  const href = trimmed ? `/products/${encodeURIComponent(trimmed)}` : '';
  const className =
    'inline-flex items-center font-semibold rounded-full bg-emerald-100 text-emerald-900 ' +
    (size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[10px]') +
    (href ? ' hover:bg-emerald-200 cursor-pointer' : '');
  if (!href) {
    return (
      <span
        className={className}
        title="Listed in storefront catalog — add a slug on this variant to open its product page"
      >
        In catalog
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      title="View this product on the storefront (opens in a new tab)"
      onClick={(e) => e.stopPropagation()}
    >
      In catalog
    </a>
  );
}

// SWR fetcher — attaches admin JWT when present
const fetcher = async (url) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('regal_admin_token') : null;
  const response = await fetch(url, {
    ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
  });
  if (!response.ok) {
    const error = new Error('Failed to fetch');
    error.info = await response.json();
    error.status = response.status;
    throw error;
  }
  return response.json();
};

function adminAuthHeaderObj() {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('regal_admin_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Error Display Component with Retry
const ErrorDisplay = ({ error, onRetry }) => {
  if (!error) return null;

  const isNetworkError = error.status === 0 || error.message?.includes('Network') || error.info?.error?.includes('Network');
  
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex-1">
          <p className="font-semibold text-sm sm:text-base">
            {isNetworkError ? 'Network Error' : 'Error Loading Products'}
          </p>
          <p className="text-xs sm:text-sm mt-1">
            {isNetworkError 
              ? 'Please check your internet connection and try again.'
              : error.info?.error || error.message || 'An unexpected error occurred'}
          </p>
        </div>
        <button
          onClick={onRetry}
          className="w-full sm:w-auto px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-xs sm:text-sm font-medium transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  );
};

export default function AdminProductsPage() {
  const router = useRouter();
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isVariantsOnlyView, setIsVariantsOnlyView] = useState(false);
  /** 'variants' when opening parent from a child (Variants section); otherwise 'full'. */
  const [editFormInitialView, setEditFormInitialView] = useState('full');
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  const [isBulkMode, setIsBulkMode] = useState(false);
  /** 'active' = catalog rows; 'deleted' = soft-deleted only */
  const [listFilter, setListFilter] = useState('active');
  /** Admin-only row kind filter (Active list only). Passed to `adminListFilter` query. */
  const [adminListFilter, setAdminListFilter] = useState('all');
  /** Parent _id -> bool (expanded). Drives the variant child rows. */
  const [expandedParents, setExpandedParents] = useState({});

  // Admin list endpoint: returns parents/children/standalones in one shot, ignoring
  // the storefront visibility filter so admins see hidden variants.
  const getProductsUrl = (page, search, filter, rowKind) => {
    let url = `/api/admin/products?limit=${ITEMS_PER_PAGE}&page=${page}`;
    if (search) {
      url += `&search=${encodeURIComponent(search)}`;
    }
    if (filter === 'deleted') {
      url += '&showDeleted=true';
    }
    if (filter === 'active' && rowKind && rowKind !== 'all') {
      url += `&adminListFilter=${encodeURIComponent(rowKind)}`;
    }
    return url;
  };

  // Use SWR for data fetching with caching
  const { data, error, isLoading, mutate } = useSWR(
    getProductsUrl(currentPage, searchTerm, listFilter, adminListFilter),
    fetcher,
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );

  // When viewing Deleted, related-product pickers still need an active catalog pool.
  // The picker pool intentionally uses the public route (which already excludes parents).
  const { data: activePickerData } = useSWR(
    listFilter === 'deleted' ? '/api/products?limit=300&page=1' : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const products = data?.products || [];

  // Group children by parent for grouped table rendering. We read the source array
  // straight from `data` inside the memo so its identity is stable per SWR refresh
  // (avoids the no-op-but-noisy react-hooks/exhaustive-deps warning).
  const childrenByParent = useMemo(() => {
    const list = data?.attachedChildren || [];
    const map = new Map();
    list.forEach((child) => {
      const pid = child.parentProductId?.toString?.() || String(child.parentProductId || '');
      if (!pid) return;
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid).push(child);
    });
    return map;
  }, [data]);

  const productByIdOnPage = useMemo(() => {
    const m = new Map();
    (products || []).forEach((p) => {
      const id = p?._id || p?.id;
      if (id != null) m.set(String(id), p);
    });
    return m;
  }, [products]);

  // Exact-match detection. The server uses substring regex, which is great for
  // discovery, but admins typing a full SKU/barcode/HSN expect to *land* on that
  // row. We compute case-insensitive exact matches client-side and:
  //   - mark the matching product (or variant) row for visual highlight
  //   - auto-expand any parent whose embedded variant or child matches exactly
  //     so the highlighted row is actually visible without an extra click
  const normalizedSearch = searchTerm ? String(searchTerm).trim().toLowerCase() : '';
  const exactMatchInfo = useMemo(() => {
    if (!normalizedSearch) return { productIds: new Set(), childKeys: new Set(), parentIdsToExpand: new Set() };

    const productIds = new Set();
    const childKeys = new Set();
    const parentIdsToExpand = new Set();

    const eq = (value) => String(value || '').trim().toLowerCase() === normalizedSearch;

    // Reading from `data?.products` keeps the dep array stable per SWR refresh.
    (data?.products || []).forEach((p) => {
      const pid = String(p._id || p.id || '');
      if (!pid) return;
      const productMatches =
        eq(p.sku) || eq(p.barcode) || eq(p.hsnCode) || eq(p.title) || eq(p.brand) || eq(p.legacyParentVariantId);
      if (productMatches) productIds.add(pid);

      // Legacy embedded variants: scan in-place.
      if (Array.isArray(p.variants)) {
        p.variants.forEach((v, idx) => {
          if (!v) return;
          if (eq(v.sku) || eq(v.barcode) || eq(v.hsnCode) || eq(v.name)) {
            childKeys.add(`${pid}::legacy::${idx}`);
            parentIdsToExpand.add(pid);
          }
        });
      }
    });

    // Real child products (already separate documents — they live in `attachedChildren`
    // for their visible parents, but they may also appear at the top level of
    // `products` when the search matched them directly).
    (data?.attachedChildren || []).forEach((c) => {
      const cid = String(c._id || c.id || '');
      if (!cid) return;
      if (eq(c.sku) || eq(c.barcode) || eq(c.hsnCode) || eq(c.title) || eq(c.legacyParentVariantId)) {
        childKeys.add(cid);
        const parentPid = c.parentProductId?.toString?.() || String(c.parentProductId || '');
        if (parentPid) parentIdsToExpand.add(parentPid);
      }
    });

    return { productIds, childKeys, parentIdsToExpand };
  }, [normalizedSearch, data]);

  // Auto-expand parents that contain a variant matching the current search term.
  // Use a ref-like effect so the user can still manually collapse afterwards
  // (we only force-expand on a *change* in match set).
  useEffect(() => {
    if (exactMatchInfo.parentIdsToExpand.size === 0) return;
    setExpandedParents((prev) => {
      let changed = false;
      const next = { ...prev };
      exactMatchInfo.parentIdsToExpand.forEach((pid) => {
        if (!next[pid]) {
          next[pid] = true;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [exactMatchInfo]);

  useEffect(() => {
    if (listFilter === 'deleted') {
      setAdminListFilter('all');
    }
  }, [listFilter]);

  // Optimistic toggle for child.showInCatalog (storefront catalog card, not PDP visibility).
  const toggleChildCatalogListing = async (child) => {
    const childId = child._id || child.id;
    if (!childId) return;
    const nextListed = !childRowListedInStorefrontCatalog(child);

    try {
      await mutate(
        async (current) => {
          if (!current) return current;
          return {
            ...current,
            attachedChildren: (current.attachedChildren || []).map((c) =>
              (c._id || c.id) === childId ? { ...c, showInCatalog: nextListed } : c
            ),
          };
        },
        { revalidate: false }
      );

      const res = await fetch(`/api/admin/products/children/${childId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...adminAuthHeaderObj() },
        body: JSON.stringify({ showInCatalog: nextListed }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to update catalog visibility');
      }
      mutate();
    } catch (err) {
      showToast.error(err?.message || 'Failed to update catalog visibility');
      mutate();
    }
  };

  const toggleParentExpanded = (parentId) => {
    setExpandedParents((prev) => ({ ...prev, [parentId]: !prev[parentId] }));
  };
  const allProductsForForm = listFilter === 'deleted' ? (activePickerData?.products || []) : products;
  const totalProducts = data?.total || 0;

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentPage === 1) {
        mutate();
      } else {
        setCurrentPage(1);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
    setIsBulkMode(false);
    setSelectedProducts(new Set());
  }, [listFilter, adminListFilter]);

  const handleAddProduct = () => {
    router.push('/admin/products/add');
  };
    
  const handleEditProduct = async (product, options = {}) => {
    const variantsOnly = Boolean(options.variantsOnly);
    const productId = product._id || product.id;
    if (!productId) {
      showToast.error('Product ID not found');
      return;
    }

    const toastId = showToast.loading('Loading product details...');
    setLoading(true);

    try {
      const response = await fetch(`/api/products/${productId}`);
      const data = await response.json();

      if (data.success && data.product) {
        let editingPayload = data.product;

        // For parents, the public product route already returns merged content
        // (because resolveProduct picks the default child) — but for the EDIT
        // form we want the parent's own copy + the canonical list of children
        // so the variant table can render. Refetch via the admin children endpoint.
        if (product.productType === 'parent') {
          try {
            const childrenRes = await fetch(`/api/admin/products/${productId}/children`, {
              headers: { ...adminAuthHeaderObj() },
            });
            const childrenData = await childrenRes.json().catch(() => ({}));
            if (childrenRes.ok && childrenData?.success) {
              editingPayload = {
                ...childrenData.parent,
                children: childrenData.children,
              };
            }
          } catch (e) {
            console.error('Failed to load variant children:', e);
          }
        }

        setEditingProduct(editingPayload);
        setEditFormInitialView(variantsOnly ? 'variants' : 'full');
        setIsVariantsOnlyView(variantsOnly);
        setIsEditModalOpen(true);
      } else {
        showToast.error(data.error || 'Failed to load product details');
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      showToast.error('Failed to load product details');
    } finally {
      toast.dismiss(toastId);
      setLoading(false);
    }
  };

  const formatChildVariantSummary = (child) => {
    const attrs = child?.variationAttributes || {};
    const parts = [attrs.size, attrs.color, attrs.weight, attrs.unitCount]
      .map((v) => String(v || '').trim())
      .filter(Boolean);
    const label = parts.join(' / ');
    const title = String(child?.title || '').trim();
    if (title && label) return `${title} (${label})`;
    return title || label || String(child?.sku || '').trim() || 'Variant';
  };

  const buildDeleteProductConfirmMessage = (productId, productHint) => {
    const deletedId = String(productId);
    const isChild = productHint?.productType === 'child';
    const linkedInOpenParentForm =
      isEditModalOpen &&
      editingProduct?.productType === 'parent' &&
      Array.isArray(editingProduct?.children) &&
      editingProduct.children.some((c) => String(c._id || c.id) === deletedId);

    if (linkedInOpenParentForm) {
      const child = editingProduct.children.find(
        (c) => String(c._id || c.id) === deletedId
      );
      const summary = formatChildVariantSummary(child);
      return (
        'WARNING: This child product is linked to a variant row.\n\n' +
        `Variant: ${summary}\n` +
        (child?.sku ? `SKU: ${child.sku}\n` : '') +
        `Child product ID: ${deletedId}\n\n` +
        'Deleting will:\n' +
        '• Move this child product to trash\n' +
        '• Remove it from the Variants section in the open parent editor\n\n' +
        'Continue?'
      );
    }

    if (isChild) {
      return (
        'WARNING: Child variant product\n\n' +
        'This product is a child variant (not a standalone listing). Deleting it removes the variant from the storefront and parent product page.\n\n' +
        'If you edit the parent later, this variant will no longer appear in the Variants table.\n\n' +
        'Continue?'
      );
    }

    return 'Move this product to trash? You can restore it later from the Deleted tab.';
  };

  const handleDeleteProduct = async (productId, productHint = null) => {
    if (!window.confirm(buildDeleteProductConfirmMessage(productId, productHint))) {
      return;
    }

    const toastId = showToast.loading('Moving to trash...');
    setLoading(true);

    try {
      await apiClient.requestWithRetry(`/api/products/${productId}`, {
        method: 'DELETE',
      });

      showToast.success('Product moved to trash');

      const deletedId = String(productId);
      setEditingProduct((prev) => {
        if (!prev?.children?.length) return prev;
        const nextChildren = prev.children.filter(
          (c) => String(c._id || c.id) !== deletedId
        );
        if (nextChildren.length === prev.children.length) return prev;
        return { ...prev, children: nextChildren };
      });
      if (
        isEditModalOpen &&
        editingProduct &&
        String(editingProduct._id || editingProduct.id) === deletedId
      ) {
        setIsEditModalOpen(false);
        setIsVariantsOnlyView(false);
        setEditFormInitialView('full');
        setEditingProduct(null);
      }

      mutate(); // Refresh data using SWR
    } catch (error) {
      if (error instanceof ApiError) {
        showToast.error(error.message);
      } else {
        showToast.error('Failed to delete product');
      }
    } finally {
      toast.dismiss(toastId);
      setLoading(false);
    }
  };

  const handleRestoreProduct = async (productId) => {
    const toastId = showToast.loading('Restoring product...');
    setLoading(true);
    try {
      const res = await fetch(`/api/products/${productId}/restore`, {
        method: 'POST',
        headers: { ...adminAuthHeaderObj() },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast.error(body.error || 'Failed to restore product');
        return;
      }
      showToast.success('Product restored');
      mutate();
    } catch (err) {
      console.error(err);
      showToast.error('Failed to restore product');
    } finally {
      toast.dismiss(toastId);
      setLoading(false);
    }
  };

  const handleDuplicateProduct = async (product) => {
    const productId = product._id || product.id;
    if (!productId) {
      showToast.error('Product ID not found');
      return;
    }

    const toastId = showToast.loading('Preparing product for duplication...');
    setLoading(true);

    try {
      // Fetch full product data with all fields
      const response = await fetch(`/api/products/${productId}`);
      const data = await response.json();

      if (data.success && data.product) {
        const productData = data.product;
        
        // Extract IDs from populated fields
        const categoryId = productData.categoryId?._id || productData.categoryId;
        const categoryIds = (productData.categoryIds || []).map(c => c?._id || c).filter(Boolean);
        const brandCategoryId = productData.brandCategoryId?._id || productData.brandCategoryId;
        const brandCategoryIds = (productData.brandCategoryIds || []).map(b => b?._id || b).filter(Boolean);
        
        // Clean the product data for duplication
        const duplicatedProduct = {
          ...productData,
          // Remove MongoDB-specific fields
          _id: undefined,
          id: undefined,
          createdAt: undefined,
          updatedAt: undefined,
          __v: undefined,
          // Clear slug - will be auto-generated from title
          slug: '',
          // Append " (Copy)" to title
          title: productData.title ? `${productData.title} (Copy)` : '',
          // Convert populated objects to IDs
          categoryId: categoryId ? String(categoryId) : '',
          categoryIds: categoryIds.map(id => String(id)),
          brandCategoryId: brandCategoryId ? String(brandCategoryId) : '',
          brandCategoryIds: brandCategoryIds.map(id => String(id)),
          // Clear related products and tags - do not duplicate them
          relatedProductIds: [],
          tags: [],
          tagsInput: '',
          // Keep all other fields (brand, images, specifications, etc.)
        };

        // Remove undefined fields and MongoDB populated objects
        Object.keys(duplicatedProduct).forEach(key => {
          if (duplicatedProduct[key] === undefined) {
            delete duplicatedProduct[key];
          }
          // Remove any remaining MongoDB populated objects (they should be converted to IDs above)
          if (duplicatedProduct[key] && typeof duplicatedProduct[key] === 'object' && duplicatedProduct[key]._id) {
            // This shouldn't happen, but just in case
            duplicatedProduct[key] = duplicatedProduct[key]._id;
          }
        });

        // Store in sessionStorage to pass to add page
        try {
          sessionStorage.setItem('duplicateProductData', JSON.stringify(duplicatedProduct));
          // Navigate to add page
          router.push('/admin/products/add?duplicate=true');
        } catch (storageError) {
          console.error('Error storing duplicate data:', storageError);
          showToast.error('Failed to store duplicate product data. The data might be too large.');
        }
      } else {
        showToast.error(data.error || 'Failed to load product details');
      }
    } catch (error) {
      console.error('Error duplicating product:', error);
      showToast.error('Failed to duplicate product');
    } finally {
      toast.dismiss(toastId);
      setLoading(false);
    }
  };

  // Bulk operations
  const handleSelectProduct = (productId) => {
    setSelectedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(products.map(p => p._id || p.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProducts.size === 0) {
      showToast.error('Please select products to delete');
      return;
    }

    if (!window.confirm(`Move ${selectedProducts.size} product(s) to trash? You can restore them later from the Deleted tab.`)) {
      return;
    }

    const toastId = showToast.loading(`Moving ${selectedProducts.size} product(s) to trash...`);
    setLoading(true);

    try {
      const deletePromises = Array.from(selectedProducts).map(id =>
        apiClient.request(`/api/products/${id}`, { method: 'DELETE' })
      );

      await Promise.all(deletePromises);
      showToast.success(`Moved ${selectedProducts.size} product(s) to trash`);
      setSelectedProducts(new Set());
      setIsBulkMode(false);
      mutate();
    } catch (error) {
      showToast.error('Failed to delete some products. Please try again.');
    } finally {
      toast.dismiss(toastId);
      setLoading(false);
    }
  };

  const handleSaveEditedProduct = async (productData) => {
    const toastId = showToast.loading('Saving product...');
    setLoading(true);

    try {
      const productId = editingProduct._id || editingProduct.id;
      const variantRows = Array.isArray(productData._variantRows) ? productData._variantRows : [];
      const variationTheme = Array.isArray(productData.variationTheme) ? productData.variationTheme : [];
      const initialChildIds = Array.isArray(productData._initialChildIds)
        ? productData._initialChildIds
        : [];

      await apiClient.requestWithRetry(`/api/products/${productId}`, {
        method: 'PUT',
        body: productData,
      });

      const result = await saveProductChildren({
        parentId: productId,
        parent: { title: productData.title || editingProduct?.title },
        variantRows,
        variationTheme,
        initialChildIds,
      });
      if (result.errors.length > 0) {
        const firstMsg = result.errors[0]?.message || 'Unknown error';
        showToast.error(
          `${result.errors.length} variant(s) failed to save: ${firstMsg}`
        );
        console.error('Variant save errors:', result.errors);
        return;
      }

      const syncedCount = result.created + result.updated;
      const deletedCount = result.deleted || 0;
      showToast.success(
        syncedCount > 0 || deletedCount > 0
          ? `Product updated. Synced ${syncedCount} variant(s)${deletedCount > 0 ? `, removed ${deletedCount} from trash` : ''}.`
          : 'Product updated successfully'
      );
      setIsEditModalOpen(false);
      setIsVariantsOnlyView(false);
      setEditFormInitialView('full');
      setEditingProduct(null);
      mutate();
    } catch (error) {
      if (error instanceof ApiError) {
        showToast.error(error.message);
      } else {
        showToast.error('Failed to update product');
      }
    } finally {
      toast.dismiss(toastId);
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(totalProducts / ITEMS_PER_PAGE);
  const startItem = totalProducts > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, totalProducts);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= maxVisible; i++) {
          pages.push(i);
        }
      } else if (currentPage >= totalPages - 2) {
        for (let i = totalPages - maxVisible + 1; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        for (let i = currentPage - 2; i <= currentPage + 2; i++) {
          pages.push(i);
        }
      }
    }
    
    return pages;
  };

  // Blur placeholder for images
  const blurDataURL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q==';

  return (
    <div>
      <ErrorDisplay error={error} onRetry={() => mutate()} />
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 sm:mb-6 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Manage Products</h1>
          <div className="flex gap-2 mt-3" role="tablist" aria-label="Product list filter">
            <button
              type="button"
              role="tab"
              aria-selected={listFilter === 'active'}
              onClick={() => setListFilter('active')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                listFilter === 'active'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Active
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={listFilter === 'deleted'}
              onClick={() => setListFilter('deleted')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                listFilter === 'deleted'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Deleted
            </button>
          </div>
        </div>
        <div className="flex gap-3 w-full md:w-auto flex-wrap">
          {isBulkMode && selectedProducts.size > 0 && (
            <div className="flex gap-2 flex-wrap w-full">
              <button
                onClick={handleBulkDelete}
                className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-3 sm:px-4 rounded-md text-xs sm:text-sm transition-colors flex-1 sm:flex-none min-w-[120px]"
                disabled={loading}
              >
                Delete ({selectedProducts.size})
              </button>
              <button
                onClick={() => {
                  setIsBulkMode(false);
                  setSelectedProducts(new Set());
                }}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-3 sm:px-4 rounded-md text-xs sm:text-sm transition-colors flex-1 sm:flex-none min-w-[120px]"
              >
                Cancel
              </button>
            </div>
          )}
          <div className="relative flex-grow md:flex-grow-0 w-full md:w-64">
            <input 
              type="text" 
              placeholder="Search products..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary text-base"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <SearchIcon className="w-4 h-4" />
            </div>
          </div>
          {!isBulkMode && listFilter === 'active' && (
            <select
              value={adminListFilter}
              onChange={(e) => {
                setAdminListFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full md:w-56 border border-gray-300 rounded-md px-3 py-2.5 sm:py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
              aria-label="Filter product rows"
            >
              <option value="all">All products</option>
              <option value="parents">Parents only</option>
              <option value="children">Variants only</option>
              <option value="catalog_visible">Catalog-visible</option>
              <option value="hidden_catalog">Hidden from catalog (variants)</option>
            </select>
          )}
          {!isBulkMode && listFilter === 'active' && (
            <>
              <button
                onClick={() => setIsBulkMode(true)}
                className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2.5 sm:py-2 px-3 sm:px-4 rounded-md text-xs sm:text-sm transition-colors whitespace-nowrap"
              >
                Bulk Actions
              </button>
              <button 
                onClick={handleAddProduct} 
                className="bg-primary hover:bg-primary-700 text-white font-bold py-2.5 sm:py-2 px-3 sm:px-4 rounded-md flex items-center gap-2 whitespace-nowrap transition-colors text-xs sm:text-sm"
              >
                <PlusIcon /> <span className="hidden sm:inline">Add Product</span><span className="sm:hidden">Add</span>
              </button>
            </>
          )}
          {!isBulkMode && listFilter === 'deleted' && (
            <p className="text-sm text-gray-500 self-center">Restore products to show them on the store again.</p>
          )}
        </div>
      </div>
      
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="px-4 sm:px-6 py-8 text-center text-gray-500">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-2 text-sm">Loading products...</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {isBulkMode && (
                      <th className="px-6 py-3">
                        <input
                          type="checkbox"
                          checked={selectedProducts.size === products.length && products.length > 0}
                          onChange={handleSelectAll}
                          className="rounded border-gray-300 text-primary focus:ring-primary"
                        />
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Catalog</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {products.length > 0 ? (
                    products.flatMap(product => {
                      const productId = product._id || product.id;
                      const isSelected = selectedProducts.has(productId);
                      const isParent = product.productType === 'parent';
                      const childRowParentId =
                        product.productType === 'child'
                          ? product.parentProductId?.toString?.() || String(product.parentProductId || '')
                          : '';
                      const parentProductOnPage = childRowParentId
                        ? productByIdOnPage.get(childRowParentId)
                        : null;

                      // Unify "real children" and "legacy embedded variants" so both render
                      // as expandable rows under the carrier. Legacy rows are reshaped to look
                      // like children (image / title / brand / price / status) and are flagged
                      // with `__legacy: true` so action handlers know they aren't yet promoted
                      // to standalone child documents.
                      const childRows = isParent ? (childrenByParent.get(String(productId)) || []) : [];
                      const legacyVariants = !isParent && Array.isArray(product.variants) ? product.variants : [];
                      const legacyChildRows = legacyVariants.map((v, i) => {
                        const attrs = {
                          size: String(v?.size || '').trim(),
                          color: String(v?.color || '').trim(),
                          weight: String(v?.weight || '').trim(),
                          unitCount: String(v?.unitCount || '').trim(),
                        };
                        const tail = ['size', 'color', 'weight', 'unitCount']
                          .map((k) => attrs[k])
                          .filter(Boolean)
                          .join(' / ');
                        return {
                          _id: `${productId}::legacy::${i}`,
                          __legacy: true,
                          title: tail ? `${product.title} - ${tail}` : (v?.name || product.title),
                          heroImage: (Array.isArray(v?.images) && v.images.find(Boolean)) || product.heroImage,
                          gallery: Array.isArray(v?.images) ? v.images.filter(Boolean) : [],
                          brand: product.brand,
                          price: Number(v?.sellingPrice ?? v?.price ?? product.price ?? 0),
                          status: product.status,
                          sku: String(v?.sku || '').trim(),
                          variationAttributes: attrs,
                          visibleOnClient: true,
                        };
                      });
                      const displayChildren = isParent ? childRows : legacyChildRows;
                      const variantCount = displayChildren.length;
                      const anyChildInCatalog =
                        isParent && childRows.some((c) => childRowListedInStorefrontCatalog(c));
                      const isExpandable = variantCount > 0;
                      const isExpanded = !!expandedParents[String(productId)];
                      const isCarrier = isParent || legacyChildRows.length > 0;

                      const rows = [];
                      const isExactMatch = exactMatchInfo.productIds.has(String(productId));
                      const rowHighlight = isExactMatch
                        ? 'bg-yellow-50 ring-1 ring-inset ring-yellow-300'
                        : isSelected
                          ? 'bg-blue-50'
                          : '';

                      rows.push(
                        <tr key={productId} className={`hover:bg-gray-50 ${rowHighlight}`}>
                          {isBulkMode && (
                            <td className="px-6 py-4">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleSelectProduct(productId)}
                                className="rounded border-gray-300 text-primary focus:ring-primary"
                              />
                            </td>
                          )}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {isExpandable ? (
                                <button
                                  type="button"
                                  onClick={() => toggleParentExpanded(String(productId))}
                                  className="mr-2 inline-flex items-center justify-center w-5 h-5 rounded text-gray-600 hover:text-gray-900"
                                  aria-label={isExpanded ? 'Collapse variants' : 'Expand variants'}
                                  title={isExpanded ? 'Collapse variants' : 'Expand variants'}
                                >
                                  <svg
                                    viewBox="0 0 12 12"
                                    className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                    fill="currentColor"
                                  >
                                    <path d="M3 1.5l6 4.5-6 4.5z" />
                                  </svg>
                                </button>
                              ) : (
                                <span className="mr-2 inline-block w-5" />
                              )}
                              <div className="relative h-10 w-10 flex-shrink-0">
                                {product.heroImage ? (
                                  <Image
                                    src={product.heroImage}
                                    alt={product.title}
                                    fill
                                    sizes="40px"
                                    unoptimized
                                    className="rounded-md object-cover"
                                    loading="lazy"
                                    placeholder="blur"
                                    blurDataURL={blurDataURL}
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-md bg-gray-100 border border-dashed border-gray-300" />
                                )}
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900 flex items-center gap-2 flex-wrap">
                                  <span>{product.title}</span>
                                  {product.productType === 'child' && (
                                    <>
                                      <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full bg-indigo-100 text-indigo-800">
                                        Variant
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (!childRowParentId) return;
                                          void handleEditProduct(
                                            parentProductOnPage || { _id: childRowParentId, productType: 'parent' }
                                          );
                                        }}
                                        className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors cursor-pointer"
                                        title="Open parent product (variant matrix is edited there)"
                                      >
                                        Child product
                                      </button>
                                      {childRowListedInStorefrontCatalog(product) && (
                                        <StorefrontInCatalogBadge slug={product.slug} />
                                      )}
                                    </>
                                  )}
                                  {isParent && (
                                    <>
                                      <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full bg-violet-100 text-violet-800">
                                        Parent
                                      </span>
                                      <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-100 text-slate-700">
                                        Has variants
                                      </span>
                                      {anyChildInCatalog && (
                                        <span
                                          className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-100 text-emerald-900"
                                          title="At least one variant is also listed as its own product card in the storefront catalog"
                                        >
                                          Visible in catalog
                                        </span>
                                      )}
                                    </>
                                  )}
                                  {isExactMatch && (
                                    <span
                                      className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-full bg-yellow-200 text-yellow-900"
                                      title={`Exact match for "${searchTerm}"`}
                                    >
                                      Match
                                    </span>
                                  )}
                                  {isExpandable && (
                                    <button
                                      type="button"
                                      onClick={() => toggleParentExpanded(String(productId))}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-full bg-indigo-100 text-indigo-800 hover:bg-indigo-200 transition-colors"
                                      title={isExpanded ? 'Hide variants' : 'Show variants'}
                                    >
                                      Variations ({variantCount})
                                    </button>
                                  )}
                                </div>
                                {product.productType === 'child' && childRowParentId && (
                                  <div className="text-xs text-gray-600 mt-1 max-w-md">
                                    <span className="text-gray-500">Parent:</span>{' '}
                                    <button
                                      type="button"
                                      className="text-primary font-semibold hover:underline text-left"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void handleEditProduct(
                                          parentProductOnPage || { _id: childRowParentId, productType: 'parent' }
                                        );
                                      }}
                                    >
                                      {parentProductOnPage?.title || 'Open parent product'}
                                    </button>
                                  </div>
                                )}
                                {listFilter === 'deleted' && product.deletedAt && (
                                  <div className="text-xs text-gray-400 mt-0.5">
                                    Removed {new Date(product.deletedAt).toLocaleString()}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.brand}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{isCarrier ? '—' : `₹${product.price}`}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-xs text-gray-400">—</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            {!isBulkMode && listFilter === 'active' && (
                              <>
                                <button
                                  onClick={() => handleEditProduct(product)}
                                  className="text-indigo-600 hover:text-indigo-900 mr-4"
                                  disabled={loading}
                                  title="Edit product"
                                >
                                  <EditIcon />
                                </button>
                                {/* Variant carriers (new parents AND legacy products with embedded
                                    variants) only get Edit. Duplicate/Delete is hidden here so
                                    admins can't orphan variants from the list view; both flows
                                    are owned by the parent edit modal. */}
                                {!isCarrier && (
                                  <>
                                    <button
                                      onClick={() => handleDuplicateProduct(product)}
                                      className="text-blue-600 hover:text-blue-900 mr-4"
                                      disabled={loading}
                                      title="Duplicate product"
                                    >
                                      <DuplicateIcon />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteProduct(productId, product)}
                                      className="text-red-600 hover:text-red-900"
                                      disabled={loading}
                                      title="Move to trash"
                                    >
                                      <TrashIcon />
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                            {!isBulkMode && listFilter === 'deleted' && (
                              <>
                                <button
                                  onClick={() => handleRestoreProduct(productId)}
                                  className="text-emerald-600 hover:text-emerald-900 mr-4"
                                  disabled={loading}
                                  title="Restore product"
                                >
                                  <RestoreIcon />
                                </button>
                                <button
                                  onClick={() => handleEditProduct(product)}
                                  className="text-indigo-600 hover:text-indigo-900"
                                  disabled={loading}
                                  title="Edit (e.g. change slug if restore fails)"
                                >
                                  <EditIcon />
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );

                      if (isExpanded && displayChildren.length > 0) {
                        displayChildren.forEach((child) => {
                          const childId = child._id || child.id;
                          const isLegacy = Boolean(child.__legacy);
                          const childKey = String(childId);
                          const isChildExactMatch = exactMatchInfo.childKeys.has(childKey);
                          const attrs = child.variationAttributes || {};
                          const attrChips = ['size', 'color', 'weight', 'unitCount']
                            .map((k) => (attrs[k] ? `${k}: ${attrs[k]}` : null))
                            .filter(Boolean);
                          const childImage =
                            child.heroImage ||
                            (Array.isArray(child.gallery) && child.gallery[0]) ||
                            product.heroImage;
                          const childRowClass = isChildExactMatch
                            ? 'bg-yellow-50 ring-1 ring-inset ring-yellow-300'
                            : 'bg-gray-50/60';
                          rows.push(
                            <tr key={`${productId}::child::${childId}`} className={childRowClass}>
                              {isBulkMode && <td className="px-6 py-3" />}
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center pl-9">
                                  {/* Same image / title block as parent so the row reads as a sibling. */}
                                  <span className="mr-2 inline-block w-5" />
                                  <div className="relative h-10 w-10 flex-shrink-0">
                                    {childImage ? (
                                      <Image
                                        src={childImage}
                                        alt={child.title || 'Variant'}
                                        fill
                                        sizes="40px"
                                        unoptimized
                                        className="rounded-md object-cover"
                                        loading="lazy"
                                      />
                                    ) : (
                                      <div className="w-10 h-10 rounded-md bg-gray-100 border border-dashed border-gray-300" />
                                    )}
                                  </div>
                                  <div className="ml-4">
                                    <div className="text-sm font-medium text-gray-900 flex items-center gap-2 flex-wrap">
                                      <span>{child.title || 'Variant'}</span>
                                      {isChildExactMatch && (
                                        <span
                                          className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-yellow-200 text-yellow-900"
                                          title={`Exact match for "${searchTerm}"`}
                                        >
                                          Match
                                        </span>
                                      )}
                                      {isLegacy && (
                                        <span
                                          className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-amber-100 text-amber-800"
                                          title="Embedded variant (pre-migration). Run npm run migrate:variants to promote it to a real child product."
                                        >
                                          Legacy
                                        </span>
                                      )}
                                      {!isLegacy && (
                                        <>
                                          <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-indigo-100 text-indigo-800">
                                            Variant
                                          </span>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              void handleEditProduct(product);
                                            }}
                                            className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-gray-200 text-gray-800 hover:bg-gray-300 cursor-pointer"
                                            title="Open parent product"
                                          >
                                            Child product
                                          </button>
                                          {childRowListedInStorefrontCatalog(child) && (
                                            <StorefrontInCatalogBadge slug={child.slug} size="sm" />
                                          )}
                                        </>
                                      )}
                                    </div>
                                    {!isLegacy && (
                                      <div className="text-[11px] text-gray-600 mt-1">
                                        Parent:{' '}
                                        <button
                                          type="button"
                                          className="text-primary font-semibold hover:underline"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            void handleEditProduct(product);
                                          }}
                                        >
                                          {product.title}
                                        </button>
                                      </div>
                                    )}
                                    {(attrChips.length > 0 || child.sku) && (
                                      <div className="text-[11px] text-gray-500 flex flex-wrap gap-1 mt-0.5">
                                        {attrChips.map((chip) => (
                                          <span key={chip} className="px-1.5 py-0.5 bg-white border border-gray-200 rounded">{chip}</span>
                                        ))}
                                        {child.sku ? <span className="px-1.5 py-0.5 bg-white border border-gray-200 rounded">SKU: {child.sku}</span> : null}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{child.brand || product.brand}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₹{child.price ?? 0}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {isLegacy ? (
                                  <span className="text-xs text-gray-400">—</span>
                                ) : (
                                  <label
                                    className="inline-flex items-center gap-2 text-xs text-gray-700 cursor-pointer"
                                    title="Show on catalog and sitemap (separate product card)"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={childRowListedInStorefrontCatalog(child)}
                                      onChange={() => toggleChildCatalogListing(child)}
                                      className="rounded border-gray-300 text-primary focus:ring-primary"
                                    />
                                    In catalog
                                  </label>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button
                                  onClick={() => handleEditProduct(product)}
                                  className="text-indigo-600 hover:text-indigo-900"
                                  disabled={loading}
                                  title="Edit variant via parent"
                                >
                                  <EditIcon />
                                </button>
                              </td>
                            </tr>
                          );
                        });
                      }

                      return rows;
                    })
                  ) : (
                    <tr>
                      <td colSpan={isBulkMode ? 6 : 5} className="px-6 py-8 text-center text-gray-500">
                        {searchTerm
                          ? `No products found matching "${searchTerm}"`
                          : listFilter === 'deleted'
                            ? 'No deleted products'
                            : 'No products found'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-200">
              {isBulkMode && products.length > 0 && (
                <div className="p-4 bg-gray-50 border-b">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedProducts.size === products.length}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-medium text-gray-700">Select All</span>
                  </label>
                </div>
              )}
              {products.length > 0 ? (
                products.map(product => {
                  const productId = product._id || product.id;
                  const isSelected = selectedProducts.has(productId);
                  const isParent = product.productType === 'parent';
                  const mobileChildParentId =
                    product.productType === 'child'
                      ? product.parentProductId?.toString?.() || String(product.parentProductId || '')
                      : '';
                  const mobileParentOnPage = mobileChildParentId
                    ? productByIdOnPage.get(mobileChildParentId)
                    : null;
                  const childRows = isParent ? (childrenByParent.get(String(productId)) || []) : [];
                  const legacyVariants = !isParent && Array.isArray(product.variants) ? product.variants : [];
                  const legacyChildRows = legacyVariants.map((v, i) => {
                    const attrs = {
                      size: String(v?.size || '').trim(),
                      color: String(v?.color || '').trim(),
                      weight: String(v?.weight || '').trim(),
                      unitCount: String(v?.unitCount || '').trim(),
                    };
                    const tail = ['size', 'color', 'weight', 'unitCount']
                      .map((k) => attrs[k])
                      .filter(Boolean)
                      .join(' / ');
                    return {
                      _id: `${productId}::legacy::${i}`,
                      __legacy: true,
                      title: tail ? `${product.title} - ${tail}` : (v?.name || product.title),
                      heroImage: (Array.isArray(v?.images) && v.images.find(Boolean)) || product.heroImage,
                      gallery: Array.isArray(v?.images) ? v.images.filter(Boolean) : [],
                      brand: product.brand,
                      price: Number(v?.sellingPrice ?? v?.price ?? product.price ?? 0),
                      status: product.status,
                      sku: String(v?.sku || '').trim(),
                      variationAttributes: attrs,
                      visibleOnClient: true,
                    };
                  });
                  const displayChildren = isParent ? childRows : legacyChildRows;
                  const variantCount = displayChildren.length;
                  const anyChildInCatalog =
                    isParent && childRows.some((c) => childRowListedInStorefrontCatalog(c));
                  const isExpandable = variantCount > 0;
                  const isExpanded = !!expandedParents[String(productId)];
                  const isCarrier = isParent || legacyChildRows.length > 0;
                  const isExactMatch = exactMatchInfo.productIds.has(String(productId));
                  const cardHighlight = isExactMatch
                    ? 'bg-yellow-50 ring-2 ring-yellow-300'
                    : isSelected
                      ? 'bg-blue-50'
                      : 'bg-white';
                  return (
                    <div
                      key={productId}
                      className={`p-4 hover:bg-gray-50 transition-colors ${cardHighlight}`}
                    >
                      <div className="flex items-start gap-3">
                        {isBulkMode && (
                          <div className="pt-1">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleSelectProduct(productId)}
                              className="rounded border-gray-300 text-primary focus:ring-primary"
                            />
                          </div>
                        )}
                        <div className="relative h-16 w-16 flex-shrink-0">
                          {product.heroImage ? (
                            <Image
                              src={product.heroImage}
                              alt={product.title}
                              fill
                              sizes="64px"
                              unoptimized
                              className="rounded-md object-cover"
                              loading="lazy"
                              placeholder="blur"
                              blurDataURL={blurDataURL}
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-md bg-gray-100 border border-dashed border-gray-300" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium text-gray-900 mb-1 line-clamp-2 flex items-center gap-2 flex-wrap">
                            <span>{product.title}</span>
                            {product.productType === 'child' && (
                              <>
                                <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full bg-indigo-100 text-indigo-800">
                                  Variant
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!mobileChildParentId) return;
                                    void handleEditProduct(
                                      mobileParentOnPage || { _id: mobileChildParentId, productType: 'parent' }
                                    );
                                  }}
                                  className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full bg-gray-200 text-gray-800 hover:bg-gray-300"
                                  title="Open parent product"
                                >
                                  Child product
                                </button>
                                {childRowListedInStorefrontCatalog(product) && (
                                  <StorefrontInCatalogBadge slug={product.slug} />
                                )}
                              </>
                            )}
                            {isParent && (
                              <>
                                <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full bg-violet-100 text-violet-800">
                                  Parent
                                </span>
                                <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-100 text-slate-700">
                                  Has variants
                                </span>
                                {anyChildInCatalog && (
                                  <span
                                    className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-100 text-emerald-900"
                                    title="At least one variant is also listed as its own product card in the storefront catalog"
                                  >
                                    Visible in catalog
                                  </span>
                                )}
                              </>
                            )}
                            {isExactMatch && (
                              <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-full bg-yellow-200 text-yellow-900">
                                Match
                              </span>
                            )}
                            {isExpandable && (
                              <button
                                type="button"
                                onClick={() => toggleParentExpanded(String(productId))}
                                className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full bg-indigo-100 text-indigo-800 hover:bg-indigo-200 transition-colors"
                                title={isExpanded ? 'Hide variants' : 'Show variants'}
                              >
                                Variations ({variantCount})
                              </button>
                            )}
                          </h3>
                          {product.productType === 'child' && mobileChildParentId && (
                            <p className="text-xs text-gray-600 mb-1">
                              Parent:{' '}
                              <button
                                type="button"
                                className="text-primary font-semibold hover:underline"
                                onClick={() =>
                                  void handleEditProduct(
                                    mobileParentOnPage || { _id: mobileChildParentId, productType: 'parent' }
                                  )
                                }
                              >
                                {mobileParentOnPage?.title || 'Open parent product'}
                              </button>
                            </p>
                          )}
                          {listFilter === 'deleted' && product.deletedAt && (
                            <p className="text-xs text-gray-400 mb-1">
                              Removed {new Date(product.deletedAt).toLocaleString()}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mb-2">
                            <span>{product.brand}</span>
                            {!isCarrier && (
                              <>
                                <span>•</span>
                                <span className="font-semibold text-gray-900">₹{product.price}</span>
                              </>
                            )}
                          </div>
                        </div>
                        {!isBulkMode && listFilter === 'active' && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => handleEditProduct(product)}
                              className="text-indigo-600 hover:text-indigo-900 p-2"
                              disabled={loading}
                              title="Edit product"
                            >
                              <EditIcon />
                            </button>
                            {/* Carriers (new parents OR legacy products with embedded variants)
                                only get Edit. Variants are managed inside the parent edit modal.
                                Standalones keep the full action set. */}
                            {!isCarrier && (
                              <>
                                <button
                                  onClick={() => handleDuplicateProduct(product)}
                                  className="text-blue-600 hover:text-blue-900 p-2"
                                  disabled={loading}
                                  title="Duplicate product"
                                >
                                  <DuplicateIcon />
                                </button>
                                <button
                                  onClick={() => handleDeleteProduct(productId, product)}
                                  className="text-red-600 hover:text-red-900 p-2"
                                  disabled={loading}
                                  title="Move to trash"
                                >
                                  <TrashIcon />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                        {!isBulkMode && listFilter === 'deleted' && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button 
                              onClick={() => handleRestoreProduct(productId)} 
                              className="text-emerald-600 hover:text-emerald-900 p-2"
                              disabled={loading}
                              title="Restore product"
                            >
                              <RestoreIcon />
                            </button>
                            <button 
                              onClick={() => handleEditProduct(product)} 
                              className="text-indigo-600 hover:text-indigo-900 p-2"
                              disabled={loading}
                              title="Edit product"
                            >
                              <EditIcon />
                            </button>
                          </div>
                        )}
                      </div>

                      {isExpanded && displayChildren.length > 0 && (
                        <div className="mt-3 pl-4 border-l-2 border-indigo-100 space-y-2">
                          {displayChildren.map((child) => {
                            const childId = child._id || child.id;
                            const isLegacy = Boolean(child.__legacy);
                            const isChildExactMatch = exactMatchInfo.childKeys.has(String(childId));
                            const attrs = child.variationAttributes || {};
                            const attrChips = ['size', 'color', 'weight', 'unitCount']
                              .map((k) => (attrs[k] ? `${k}: ${attrs[k]}` : null))
                              .filter(Boolean);
                            const childImage =
                              child.heroImage ||
                              (Array.isArray(child.gallery) && child.gallery[0]) ||
                              product.heroImage;
                            const childCardClass = isChildExactMatch
                              ? 'bg-yellow-50 ring-2 ring-yellow-300'
                              : 'bg-gray-50';
                            return (
                              <div key={`m::child::${childId}`} className={`${childCardClass} rounded-md p-3 flex items-start gap-3`}>
                                <div className="relative h-14 w-14 flex-shrink-0">
                                  {childImage ? (
                                    <Image
                                      src={childImage}
                                      alt={child.title || 'Variant'}
                                      fill
                                      sizes="56px"
                                      unoptimized
                                      className="rounded-md object-cover"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="w-14 h-14 rounded-md bg-white border border-dashed border-gray-300" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-semibold text-gray-900 flex items-center gap-2 line-clamp-2 flex-wrap">
                                    <span>{child.title || 'Variant'}</span>
                                    {isChildExactMatch && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-yellow-200 text-yellow-900">
                                        Match
                                      </span>
                                    )}
                                    {isLegacy && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-amber-100 text-amber-800">
                                        Legacy
                                      </span>
                                    )}
                                    {!isLegacy && (
                                      <>
                                        <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-indigo-100 text-indigo-800">
                                          Variant
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => void handleEditProduct(product)}
                                          className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-gray-200 text-gray-800 hover:bg-gray-300"
                                          title="Open parent product"
                                        >
                                          Child product
                                        </button>
                                        {childRowListedInStorefrontCatalog(child) && (
                                          <StorefrontInCatalogBadge slug={child.slug} size="sm" />
                                        )}
                                      </>
                                    )}
                                  </div>
                                  {!isLegacy && (
                                    <div className="text-[11px] text-gray-600 mt-1">
                                      Parent:{' '}
                                      <button
                                        type="button"
                                        className="text-primary font-semibold hover:underline"
                                        onClick={() => void handleEditProduct(product)}
                                      >
                                        {product.title}
                                      </button>
                                    </div>
                                  )}
                                  {(attrChips.length > 0 || child.sku) && (
                                    <div className="text-[11px] text-gray-500 flex flex-wrap gap-1 mt-1">
                                      {attrChips.map((chip) => (
                                        <span key={chip} className="px-1.5 py-0.5 bg-white border border-gray-200 rounded">{chip}</span>
                                      ))}
                                      {child.sku ? <span className="px-1.5 py-0.5 bg-white border border-gray-200 rounded">SKU: {child.sku}</span> : null}
                                    </div>
                                  )}
                                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                    <span>{child.brand || product.brand}</span>
                                    <span>•</span>
                                    <span className="font-semibold text-gray-900">₹{child.price ?? 0}</span>
                                  </div>
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    {!isLegacy && (
                                      <label
                                        className="inline-flex items-center gap-1 text-[11px] text-gray-700"
                                        title="Show on catalog and sitemap (separate product card)"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={childRowListedInStorefrontCatalog(child)}
                                          onChange={() => toggleChildCatalogListing(child)}
                                          className="rounded border-gray-300 text-primary focus:ring-primary"
                                        />
                                        In catalog
                                      </label>
                                    )}
                                    <button
                                      onClick={() => handleEditProduct(product)}
                                      className="ml-auto text-indigo-600"
                                      title="Edit variant via parent"
                                    >
                                      <EditIcon />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="px-4 py-8 text-center text-gray-500 text-sm">
                  {searchTerm
                    ? `No products found matching "${searchTerm}"`
                    : listFilter === 'deleted'
                      ? 'No deleted products'
                      : 'No products found'}
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="bg-gray-50 px-4 sm:px-6 py-4 border-t border-gray-200">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs sm:text-sm text-gray-700 text-center sm:text-left">
                    Showing <span className="font-medium">{startItem}</span> to <span className="font-medium">{endItem}</span> of <span className="font-medium">{totalProducts}</span> products
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto justify-center">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1 || isLoading}
                      className="px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-xs sm:text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
                    >
                      <ChevronLeftIcon className="w-4 h-4" />
                      <span className="hidden sm:inline">Previous</span>
                    </button>
                    
                    <div className="flex items-center gap-1 overflow-x-auto max-w-[200px] sm:max-w-none">
                      {getPageNumbers().map((pageNum) => (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          disabled={isLoading}
                          className={`px-2 sm:px-3 py-2 border rounded-md text-xs sm:text-sm font-medium transition-colors flex-shrink-0 ${
                            currentPage === pageNum
                              ? 'bg-primary text-white border-primary'
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {pageNum}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages || isLoading}
                      className="px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-xs sm:text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
                    >
                      <span className="hidden sm:inline">Next</span>
                      <ChevronRightIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className={`bg-white rounded-lg shadow-xl w-full max-h-[95vh] flex flex-col overflow-hidden ${isVariantsOnlyView ? 'max-w-[96vw] 2xl:max-w-[1800px]' : 'max-w-4xl'}`}>
            <div className="p-4 sm:p-6 border-b">
              <h2 className="text-xl sm:text-2xl font-bold">Edit Product</h2>
            </div>
            <div className="flex-grow overflow-y-auto p-2 sm:p-6">
              <ProductForm 
                product={editingProduct} 
                allProducts={allProductsForForm}
                initialView={editFormInitialView}
                onSave={handleSaveEditedProduct}
                onVariantsOnlyChange={setIsVariantsOnlyView}
                onOpenParent={(parentId) => {
                  if (!parentId) return;
                  void handleEditProduct(
                    { _id: parentId, productType: 'parent' },
                    { variantsOnly: true }
                  );
                }}
                onCancel={() => {
                  setIsVariantsOnlyView(false);
                  setEditFormInitialView('full');
                  setIsEditModalOpen(false);
                  setEditingProduct(null);
                }} 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}