









// /**
//  * Admin Add Product Page
//  * 
//  * Page for creating new products.
//  * Uses ProductForm component with empty product data.
//  */

'use client';

import { useState, useMemo } from 'react';
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

  // Fetch products based on selected category
  // If category is selected, fetch products in that category
  // Otherwise, fetch latest 200 products
  const productsUrl = useMemo(() => {
    if (selectedCategoryId && categories.length > 0) {
      // Find category slug from ID
      const category = categories.find(c => {
        const cId = c._id || c.id;
        return cId?.toString() === selectedCategoryId?.toString();
      });
      
      if (category?.slug) {
        // Fetch products filtered by category slug
        return `/api/products?limit=200&category=${category.slug}`;
      }
    }
    // Fetch latest 200 products when no category selected
    return '/api/products?limit=200&sortBy=newest';
  }, [selectedCategoryId, categories]);

  const { data: productsData } = useSWR(productsUrl, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300000, // Cache for 5 minutes
  });

  const products = productsData?.products || [];

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

  return (
    <div className="max-w-4xl mx-auto w-full">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-sm sm:text-base">
          {error}
        </div>
      )}
      
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4 sm:mb-6">Add New Product</h1>
      <ProductForm 
        product={null}
        allProducts={products}
        onSave={handleSave}
        onCancel={handleCancel}
        onCategoryChange={setSelectedCategoryId}
      />
    </div>
  );
}

