'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { PlusIcon, EditIcon, TrashIcon, SearchIcon, ChevronLeftIcon, ChevronRightIcon, StarIcon } from '@/components/Icons';
import ProductForm from '@/components/ProductForm';
import { showToast } from '@/lib/utils/toast';
import { apiClient, ApiError } from '@/lib/utils/apiClient';

const ITEMS_PER_PAGE = 20;

// SWR fetcher
const fetcher = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    const error = new Error('Failed to fetch');
    error.info = await response.json();
    error.status = response.status;
    throw error;
  }
  return response.json();
};

// Error Display Component with Retry
const ErrorDisplay = ({ error, onRetry }) => {
  if (!error) return null;

  const isNetworkError = error.status === 0 || error.message?.includes('Network') || error.info?.error?.includes('Network');
  
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">
            {isNetworkError ? 'Network Error' : 'Error Loading Products'}
          </p>
          <p className="text-sm mt-1">
            {isNetworkError 
              ? 'Please check your internet connection and try again.'
              : error.info?.error || error.message || 'An unexpected error occurred'}
          </p>
        </div>
        <button
          onClick={onRetry}
          className="ml-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium transition-colors"
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
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  const [isBulkMode, setIsBulkMode] = useState(false);

  // Build URL with pagination and search
  const getProductsUrl = (page, search) => {
    const skip = (page - 1) * ITEMS_PER_PAGE;
    let url = `/api/products?limit=${ITEMS_PER_PAGE}&skip=${skip}`;
    if (search) {
      url += `&search=${encodeURIComponent(search)}`;
    }
    return url;
  };

  // Use SWR for data fetching with caching
  const { data, error, isLoading, mutate } = useSWR(
    getProductsUrl(currentPage, searchTerm),
    fetcher,
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );

  const products = data?.products || [];
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

  const handleAddProduct = () => {
    router.push('/admin/products/add');
  };
    
  const handleEditProduct = (product) => {
    setEditingProduct(product);
    setIsEditModalOpen(true);
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
      return;
    }

    const toastId = showToast.loading('Deleting product...');
    setLoading(true);

    try {
      await apiClient.requestWithRetry(`/api/products/${productId}`, {
        method: 'DELETE',
      });

      showToast.success('Product deleted successfully');
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

    if (!window.confirm(`Are you sure you want to delete ${selectedProducts.size} product(s)? This action cannot be undone.`)) {
      return;
    }

    const toastId = showToast.loading(`Deleting ${selectedProducts.size} product(s)...`);
    setLoading(true);

    try {
      const deletePromises = Array.from(selectedProducts).map(id =>
        apiClient.request(`/api/products/${id}`, { method: 'DELETE' })
      );

      await Promise.all(deletePromises);
      showToast.success(`Successfully deleted ${selectedProducts.size} product(s)`);
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

  const handleBulkFeaturedToggle = async (featured) => {
    if (selectedProducts.size === 0) {
      showToast.error('Please select products');
      return;
    }

    const toastId = showToast.loading(`Updating ${selectedProducts.size} product(s)...`);
    setLoading(true);

    try {
      const updatePromises = Array.from(selectedProducts).map(id =>
        apiClient.request(`/api/products/${id}`, {
          method: 'PUT',
          body: { featured },
        })
      );

      await Promise.all(updatePromises);
      showToast.success(`Successfully updated ${selectedProducts.size} product(s)`);
      setSelectedProducts(new Set());
      setIsBulkMode(false);
      mutate();
    } catch (error) {
      showToast.error('Failed to update some products. Please try again.');
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
      await apiClient.requestWithRetry(`/api/products/${productId}`, {
        method: 'PUT',
        body: productData,
      });

      showToast.success('Product updated successfully');
      setIsEditModalOpen(false);
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
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-gray-800">Manage Products</h1>
        <div className="flex gap-3 w-full md:w-auto flex-wrap">
          {isBulkMode && selectedProducts.size > 0 && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => handleBulkFeaturedToggle(true)}
                className="bg-yellow-600 hover:bg-yellow-700 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors"
                disabled={loading}
              >
                Mark Featured ({selectedProducts.size})
              </button>
              <button
                onClick={() => handleBulkFeaturedToggle(false)}
                className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors"
                disabled={loading}
              >
                Unmark Featured ({selectedProducts.size})
              </button>
              <button
                onClick={handleBulkDelete}
                className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors"
                disabled={loading}
              >
                Delete ({selectedProducts.size})
              </button>
              <button
                onClick={() => {
                  setIsBulkMode(false);
                  setSelectedProducts(new Set());
                }}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-4 rounded-md text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
          <div className="relative flex-grow md:flex-grow-0">
            <input 
              type="text" 
              placeholder="Search products..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full md:w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <SearchIcon className="w-4 h-4" />
            </div>
          </div>
          {!isBulkMode && (
            <>
              <button
                onClick={() => setIsBulkMode(true)}
                className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors"
              >
                Bulk Actions
              </button>
              <button 
                onClick={handleAddProduct} 
                className="bg-primary hover:bg-primary-700 text-white font-bold py-2 px-4 rounded-md flex items-center gap-2 whitespace-nowrap transition-colors"
              >
                <PlusIcon /> <span className="hidden sm:inline">Add Product</span>
              </button>
            </>
          )}
        </div>
      </div>
      
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="px-6 py-8 text-center text-gray-500">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-2">Loading products...</p>
          </div>
        ) : (
          <>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Featured</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {products.length > 0 ? (
                  products.map(product => {
                    const productId = product._id || product.id;
                    const isSelected = selectedProducts.has(productId);
                    return (
                      <tr key={productId} className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}>
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
                            <div className="relative h-10 w-10 flex-shrink-0">
                              <Image 
                                src={product.heroImage} 
                                alt={product.title} 
                                fill
                                className="rounded-md object-cover"
                                loading="lazy"
                                placeholder="blur"
                                blurDataURL={blurDataURL}
                              />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{product.title}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.brand}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₹{product.price}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            product.status === 'In Stock' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {product.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {product.featured ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                              <StarIcon className="w-3 h-3" filled={true} />
                              Featured
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {!isBulkMode && (
                            <>
                              <button 
                                onClick={() => handleEditProduct(product)} 
                                className="text-indigo-600 hover:text-indigo-900 mr-4"
                                disabled={loading}
                                title="Edit product"
                              >
                                <EditIcon />
                              </button>
                              <button 
                                onClick={() => handleDeleteProduct(productId)} 
                                className="text-red-600 hover:text-red-900"
                                disabled={loading}
                                title="Delete product"
                              >
                                <TrashIcon />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={isBulkMode ? 7 : 6} className="px-6 py-8 text-center text-gray-500">
                      {searchTerm ? `No products found matching "${searchTerm}"` : 'No products found'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-gray-700">
                  Showing <span className="font-medium">{startItem}</span> to <span className="font-medium">{endItem}</span> of <span className="font-medium">{totalProducts}</span> products
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1 || isLoading}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
                  >
                    <ChevronLeftIcon className="w-4 h-4" />
                    Previous
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {getPageNumbers().map((pageNum) => (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        disabled={isLoading}
                        className={`px-3 py-2 border rounded-md text-sm font-medium transition-colors ${
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
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
                  >
                    Next
                    <ChevronRightIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b">
              <h2 className="text-2xl font-bold">Edit Product</h2>
            </div>
            <div className="flex-grow overflow-y-auto p-6">
              <ProductForm 
                product={editingProduct} 
                allProducts={products}
                onSave={handleSaveEditedProduct}
                onCancel={() => {
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
