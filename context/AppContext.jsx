/**
 * App Context Provider
 * 
 * Global state management for the application.
 * Manages products, categories, wishlist, and admin authentication.
 * 
 * This context provides:
 * - Products data (fetched from API)
 * - Categories data (fetched from API)
 * - Business types data (fetched from API)
 * - Wishlist management (stored in localStorage)
 * - Admin authentication state (stored in localStorage)
 */

'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Toaster } from 'react-hot-toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SWRProvider } from '@/lib/hooks/useSWRConfig';

const AppContext = createContext(undefined);

const WISHLIST_KEY = 'regal_wishlist';
const ADMIN_KEY = 'regal_admin_auth';
const ADMIN_TOKEN_KEY = 'regal_admin_token';

export function AppProvider({ children }) {
  // State for data
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [businessTypes, setBusinessTypes] = useState([]);
  
  // State for UI
  const [wishlist, setWishlist] = useState([]);
  const [isAdmin] = useState(true); // Admin is always accessible (no authentication)
  const [loading, setLoading] = useState(true);

  // Load initial data from localStorage
  useEffect(() => {
    try {
      // Load wishlist
      const storedWishlist = localStorage.getItem(WISHLIST_KEY);
      if (storedWishlist) {
        setWishlist(JSON.parse(storedWishlist));
      }
    } catch (error) {
      console.error('Failed to load from localStorage', error);
    }
  }, []);

  // Fetch products from API
  useEffect(() => {
    async function fetchProducts() {
      try {
        const response = await fetch('/api/products?limit=1000');
        const data = await response.json();
        if (data.success) {
          setProducts(data.products || []);
        }
      } catch (error) {
        console.error('Failed to fetch products:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, []);

  // Fetch categories from API
  useEffect(() => {
    async function fetchCategories() {
      try {
        const response = await fetch('/api/categories?tree=true');
        const data = await response.json();
        if (data.success) {
          // Flatten tree structure for easier access
          const flattenCategories = (cats) => {
            let result = [];
            cats.forEach(cat => {
              result.push(cat);
              if (cat.children && cat.children.length > 0) {
                result = result.concat(flattenCategories(cat.children));
              }
            });
            return result;
          };
          setCategories(flattenCategories(data.categories || []));
        }
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      }
    }

    fetchCategories();
  }, []);

  // Fetch business types from API
  useEffect(() => {
    async function fetchBusinessTypes() {
      try {
        const response = await fetch('/api/business-types');
        const data = await response.json();
        if (data.success) {
          setBusinessTypes(data.businessTypes || []);
        }
      } catch (error) {
        console.error('Failed to fetch business types:', error);
      }
    }

    fetchBusinessTypes();
  }, []);

  // Wishlist functions
  const updateWishlist = (newWishlist) => {
    setWishlist(newWishlist);
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(newWishlist));
  };

  const addToWishlist = (productId) => {
    if (!wishlist.includes(productId)) {
      updateWishlist([...wishlist, productId]);
    }
  };

  const removeFromWishlist = (productId) => {
    updateWishlist(wishlist.filter(id => id !== productId));
  };
  
  const isInWishlist = (productId) => {
    return wishlist.includes(productId);
  };

  // Admin authentication removed - admin panel is directly accessible

  // Product management functions (for admin)
  const addProduct = (product) => {
    setProducts(prev => [...prev, product]);
  };

  const updateProduct = (updatedProduct) => {
    setProducts(prev => prev.map(p => {
      const pid = p._id || p.id;
      const upid = updatedProduct._id || updatedProduct.id;
      return pid === upid ? updatedProduct : p;
    }));
  };

  const deleteProduct = (productId) => {
    setProducts(prev => prev.filter(p => {
      const pid = p._id || p.id;
      return pid !== productId;
    }));
  };

  // Refresh products from API
  const refreshProducts = useCallback(async () => {
    try {
      const response = await fetch('/api/products?limit=1000');
      const data = await response.json();
      if (data.success) {
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error('Failed to refresh products:', error);
    }
  }, []);

  // Refresh categories from API
  const refreshCategories = useCallback(async () => {
    try {
      const response = await fetch('/api/categories?tree=true');
      const data = await response.json();
      if (data.success) {
        // Flatten tree structure for easier access
        const flattenCategories = (cats) => {
          let result = [];
          cats.forEach(cat => {
            result.push(cat);
            if (cat.children && cat.children.length > 0) {
              result = result.concat(flattenCategories(cat.children));
            }
          });
          return result;
        };
        setCategories(flattenCategories(data.categories || []));
      }
    } catch (error) {
      console.error('Failed to refresh categories:', error);
    }
  }, []);

  const value = {
    // Data
    products,
    categories,
    businessTypes,
    loading,
    
    // Wishlist
    wishlist,
    addToWishlist,
    removeFromWishlist,
    isInWishlist,
    
    // Admin
    isAdmin,
    
    // Product management
    addProduct,
    updateProduct,
    deleteProduct,
    refreshProducts,
    refreshCategories,
  };

  return (
    <ErrorBoundary>
      <SWRProvider>
        <AppContext.Provider value={value}>
          {children}
          <Toaster />
        </AppContext.Provider>
      </SWRProvider>
    </ErrorBoundary>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}

