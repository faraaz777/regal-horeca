









// /**
//  * Admin Add Product Page
//  * 
//  * Page for creating new products.
//  * Uses ProductForm component with empty product data.
//  */

'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import useSWR from 'swr';
import { useAppContext } from '@/context/AppContext';
import ProductForm from '@/components/ProductForm';
import { showToast } from '@/lib/utils/toast';
import { apiClient, ApiError } from '@/lib/utils/apiClient';

// SWR fetcher function
const fetcher = (url) => fetch(url).then(res => res.json());

export default function AdminAddProductPage() {
  const { refreshProducts, categories } = useAppContext();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [duplicateProduct, setDuplicateProduct] = useState(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(true);

  // Fetch products based on selected category
  // If category is selected, fetch products in that category
  // Otherwise, fetch latest products (increased limit for better related products selection)
  const productsUrl = useMemo(() => {
    if (selectedCategoryId && categories.length > 0) {
      // Find category slug from ID
      const category = categories.find(c => {
        const cId = c._id || c.id;
        return cId?.toString() === selectedCategoryId?.toString();
      });
      
      if (category?.slug) {
        // Fetch products filtered by category slug (increased limit)
        return `/api/products?limit=1000&category=${category.slug}`;
      }
    }
    // Fetch latest products when no category selected (increased limit)
    return '/api/products?limit=1000&sortBy=newest';
  }, [selectedCategoryId, categories]);

  const { data: productsData } = useSWR(productsUrl, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300000, // Cache for 5 minutes
  });

  const products = productsData?.products || [];

  // Check for duplicate product data in sessionStorage on mount
  useEffect(() => {
    try {
      const duplicateData = sessionStorage.getItem('duplicateProductData');
      if (duplicateData) {
        const parsedData = JSON.parse(duplicateData);
        console.log('Loaded duplicate product data:', parsedData);
        setDuplicateProduct(parsedData);
        // Clear sessionStorage after reading
        sessionStorage.removeItem('duplicateProductData');
      } else {
        console.log('No duplicate product data found in sessionStorage');
      }
    } catch (error) {
      console.error('Error parsing duplicate product data:', error);
      showToast.error('Failed to load duplicate product data');
    } finally {
      setIsCheckingDuplicate(false);
    }
  }, []); // Run only once on mount

  const handleSave = async (productData) => {
    const toastId = showToast.loading('Creating product...');
    setLoading(true);
    setError('');

    try {
      // Generate slug from title if not provided
      if (!productData.slug) {
        productData.slug = productData.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
      }

      await apiClient.requestWithRetry('/api/products', {
        method: 'POST',
        body: productData,
      });

      showToast.success('Product created successfully');
      await refreshProducts();
      router.push('/admin/products');
    } catch (error) {
      if (error instanceof ApiError) {
        showToast.error(error.message);
        setError(error.message);
      } else {
        showToast.error('An error occurred while creating the product');
        setError('An error occurred while creating the product');
      }
    } finally {
      toast.dismiss(toastId);
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.push('/admin/products');
  };

  // Don't render form until we've checked for duplicate data
  if (isCheckingDuplicate) {
    return (
      <div className="max-w-4xl mx-auto w-full">
        <div className="px-4 sm:px-6 py-8 text-center text-gray-500">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-2 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto w-full">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-sm sm:text-base">
          {error}
        </div>
      )}
      
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4 sm:mb-6">
        {duplicateProduct ? 'Duplicate Product' : 'Add New Product'}
      </h1>
      {duplicateProduct && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-4 text-sm">
          <p>This product is being duplicated. Please review and modify the fields as needed before saving.</p>
        </div>
      )}
      <ProductForm 
        product={duplicateProduct || null}
        allProducts={products}
        onSave={handleSave}
        onCancel={handleCancel}
        onCategoryChange={setSelectedCategoryId}
      />
    </div>
  );
}