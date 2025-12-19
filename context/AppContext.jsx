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
const CART_KEY = 'regal_cart';
const ADMIN_KEY = 'regal_admin_auth';
const ADMIN_TOKEN_KEY = 'regal_admin_token';

export function AppProvider({ children }) {
  // State for data
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [businessTypes, setBusinessTypes] = useState([]);
  
  // State for UI
  const [wishlist, setWishlist] = useState([]);
  const [cart, setCart] = useState([]); // Cart items: [{ productId, quantity }, ...]
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
      // Load cart
      const storedCart = localStorage.getItem(CART_KEY);
      if (storedCart) {
        setCart(JSON.parse(storedCart));
      }
    } catch (error) {
      console.error('Failed to load from localStorage', error);
    }
  }, []);

  // Fetch products from API - reduced limit for better performance
  useEffect(() => {
    async function fetchProducts() {
      try {
        // Reduced limit from 1000 to 100 - use pagination when needed
        // Add cache: 'no-store' to prevent caching in production
        const response = await fetch('/api/products?limit=100', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        });
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
        const response = await fetch('/api/categories?tree=true', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        });
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

  // Fetch brands from API
  useEffect(() => {
    async function fetchBrands() {
      try {
        const response = await fetch('/api/brands?tree=true', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        });
        const data = await response.json();
        if (data.success) {
          // Flatten tree structure for easier access
          const flattenBrands = (brs) => {
            let result = [];
            brs.forEach(brand => {
              result.push(brand);
              if (brand.children && brand.children.length > 0) {
                result = result.concat(flattenBrands(brand.children));
              }
            });
            return result;
          };
          setBrands(flattenBrands(data.brands || []));
        }
      } catch (error) {
        console.error('Failed to fetch brands:', error);
      }
    }

    fetchBrands();
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

  // Cart functions
  const updateCart = (newCart) => {
    setCart(newCart);
    localStorage.setItem(CART_KEY, JSON.stringify(newCart));
  };

  /**
   * Helper function to create a unique cart item key
   * Handles edge cases where selectedColor might be missing properties
   * @param {string} productId - The product ID
   * @param {object|null} selectedColor - The color variant object (can be null)
   * @returns {string} A unique key for the cart item
   */
  const createCartItemKey = (productId, selectedColor = null) => {
    const productIdStr = productId?.toString();
    
    // If no color variant, return just the product ID
    if (!selectedColor || typeof selectedColor !== 'object') {
      return productIdStr;
    }
    
    // Try to get a unique identifier from the color variant
    // Priority: colorName > colorHex > colorId > JSON stringified object
    const colorIdentifier = 
      selectedColor.colorName || 
      selectedColor.colorHex || 
      selectedColor.colorId ||
      selectedColor.id ||
      selectedColor._id;
    
    // If we have a valid identifier, use it
    if (colorIdentifier && colorIdentifier !== 'undefined' && colorIdentifier !== 'null') {
      return `${productIdStr}_${colorIdentifier.toString()}`;
    }
    
    // Fallback: if selectedColor exists but has no identifiable properties,
    // use a hash of the object to ensure uniqueness
    // This handles edge cases where color variants might have different structures
    try {
      const colorHash = JSON.stringify(selectedColor);
      // Use a simple hash to avoid very long keys
      const hash = colorHash.split('').reduce((acc, char) => {
        const hash = ((acc << 5) - acc) + char.charCodeAt(0);
        return hash & hash;
      }, 0);
      return `${productIdStr}_hash_${Math.abs(hash)}`;
    } catch (e) {
      // If JSON.stringify fails, fall back to productId only
      console.warn('Failed to create cart item key for color variant:', selectedColor);
      return productIdStr;
    }
  };

  const addToCart = (productId, quantity = 1, options = {}) => {
    const productIdStr = productId?.toString();
    const { selectedColor, price } = options;
    
    // Create a unique key for cart items that includes color variant
    const itemKey = createCartItemKey(productIdStr, selectedColor);
    
    const existingItem = cart.find(item => {
      const itemKeyToCheck = createCartItemKey(item.productId, item.selectedColor);
      return itemKeyToCheck === itemKey;
    });
    
    if (existingItem) {
      // Update quantity if item already exists with same color
      updateCart(cart.map(item => {
        const itemKeyToCheck = createCartItemKey(item.productId, item.selectedColor);
        return itemKeyToCheck === itemKey
          ? { ...item, quantity: item.quantity + quantity }
          : item;
      }));
    } else {
      // Add new item with color and price info
      updateCart([...cart, { 
        productId: productIdStr, 
        quantity,
        selectedColor: selectedColor || null,
        price: price || null
      }]);
    }
  };

  const removeFromCart = (productId, selectedColor = null) => {
    const productIdStr = productId?.toString();
    
    // Create key for the item to remove
    const itemKeyToRemove = createCartItemKey(productIdStr, selectedColor);
    
    // Remove only the specific item with matching productId AND color
    updateCart(cart.filter(item => {
      const itemKey = createCartItemKey(item.productId, item.selectedColor);
      return itemKey !== itemKeyToRemove;
    }));
  };

  const updateCartQuantity = (productId, quantity, selectedColor = null) => {
    const productIdStr = productId?.toString();
    
    // Create key for the item to update
    const itemKeyToUpdate = createCartItemKey(productIdStr, selectedColor);
    
    if (quantity <= 0) {
      removeFromCart(productIdStr, selectedColor);
    } else {
      updateCart(cart.map(item => {
        const itemKey = createCartItemKey(item.productId, item.selectedColor);
        return itemKey === itemKeyToUpdate
          ? { ...item, quantity }
          : item;
      }));
    }
  };

  const getCartItemQuantity = (productId, selectedColor = null) => {
    const productIdStr = productId?.toString();
    
    // Create key for the item to find
    const itemKeyToFind = createCartItemKey(productIdStr, selectedColor);
    
    const item = cart.find(item => {
      const itemKey = createCartItemKey(item.productId, item.selectedColor);
      return itemKey === itemKeyToFind;
    });
    return item ? item.quantity : 0;
  };

  const isInCart = (productId, selectedColor = null) => {
    return getCartItemQuantity(productId, selectedColor) > 0;
  };

  const getCartTotalItems = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  const clearCart = () => {
    updateCart([]);
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

  // Refresh products from API - reduced limit
  const refreshProducts = useCallback(async () => {
    try {
      const response = await fetch('/api/products?limit=100');
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

  // Refresh brands from API
  const refreshBrands = useCallback(async () => {
    try {
      const response = await fetch('/api/brands?tree=true');
      const data = await response.json();
      if (data.success) {
        // Flatten tree structure for easier access
        const flattenBrands = (brs) => {
          let result = [];
          brs.forEach(brand => {
            result.push(brand);
            if (brand.children && brand.children.length > 0) {
              result = result.concat(flattenBrands(brand.children));
            }
          });
          return result;
        };
        setBrands(flattenBrands(data.brands || []));
      }
    } catch (error) {
      console.error('Failed to refresh brands:', error);
    }
  }, []);

  const value = {
    // Data
    products,
    categories,
    brands,
    businessTypes,
    loading,
    
    // Wishlist
    wishlist,
    addToWishlist,
    removeFromWishlist,
    isInWishlist,
    
    // Cart
    cart,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    getCartItemQuantity,
    isInCart,
    getCartTotalItems,
    clearCart,
    
    // Admin
    isAdmin,
    
    // Product management
    addProduct,
    updateProduct,
    deleteProduct,
    refreshProducts,
    refreshCategories,
    refreshBrands,
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

