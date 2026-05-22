'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createCartItemKey } from '@/lib/shared/cartItemKey';

const CartContext = createContext(undefined);

const CART_KEY = 'regal_cart';

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_KEY);
      if (stored) {
        setCart(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load cart from localStorage', error);
    }
  }, []);

  const updateCart = useCallback((newCart) => {
    setCart(newCart);
    localStorage.setItem(CART_KEY, JSON.stringify(newCart));
  }, []);

  const addToCart = useCallback((productId, quantity = 1, options = {}) => {
    const productIdStr = productId?.toString();
    const { selectedColor, selectedVariant, price } = options;
    const itemKey = createCartItemKey(productIdStr, selectedColor, selectedVariant);

    setCart((prev) => {
      const existingItem = prev.find((item) => {
        const k = createCartItemKey(item.productId, item.selectedColor, item.selectedVariant);
        return k === itemKey;
      });

      let next;
      if (existingItem) {
        next = prev.map((item) => {
          const k = createCartItemKey(item.productId, item.selectedColor, item.selectedVariant);
          return k === itemKey ? { ...item, quantity: item.quantity + quantity } : item;
        });
      } else {
        next = [
          ...prev,
          {
            productId: productIdStr,
            quantity,
            selectedColor: selectedColor || null,
            selectedVariant: selectedVariant || null,
            price: price ?? null,
          },
        ];
      }
      localStorage.setItem(CART_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeFromCart = useCallback((productId, selectedColor = null, selectedVariant = null) => {
    const productIdStr = productId?.toString();
    const itemKeyToRemove = createCartItemKey(productIdStr, selectedColor, selectedVariant);
    setCart((prev) => {
      const next = prev.filter((item) => {
        const itemKey = createCartItemKey(item.productId, item.selectedColor, item.selectedVariant);
        return itemKey !== itemKeyToRemove;
      });
      localStorage.setItem(CART_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const updateCartQuantity = useCallback(
    (productId, quantity, selectedColor = null, selectedVariant = null) => {
      const productIdStr = productId?.toString();
      const itemKeyToUpdate = createCartItemKey(productIdStr, selectedColor, selectedVariant);

      if (quantity <= 0) {
        removeFromCart(productIdStr, selectedColor, selectedVariant);
        return;
      }

      setCart((prev) => {
        const next = prev.map((item) => {
          const itemKey = createCartItemKey(item.productId, item.selectedColor, item.selectedVariant);
          return itemKey === itemKeyToUpdate ? { ...item, quantity } : item;
        });
        localStorage.setItem(CART_KEY, JSON.stringify(next));
        return next;
      });
    },
    [removeFromCart]
  );

  const getCartItemQuantity = useCallback(
    (productId, selectedColor = null, selectedVariant = null) => {
      const productIdStr = productId?.toString();
      const itemKeyToFind = createCartItemKey(productIdStr, selectedColor, selectedVariant);
      const item = cart.find((row) => {
        const itemKey = createCartItemKey(row.productId, row.selectedColor, row.selectedVariant);
        return itemKey === itemKeyToFind;
      });
      return item ? item.quantity : 0;
    },
    [cart]
  );

  const isInCart = useCallback(
    (productId, selectedColor = null, selectedVariant = null) =>
      getCartItemQuantity(productId, selectedColor, selectedVariant) > 0,
    [getCartItemQuantity]
  );

  const getCartTotalItems = useCallback(() => cart.reduce((total, item) => total + item.quantity, 0), [cart]);

  const clearCart = useCallback(() => updateCart([]), [updateCart]);

  const value = {
    cart,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    getCartItemQuantity,
    isInCart,
    createCartItemKey,
    getCartTotalItems,
    clearCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (ctx === undefined) {
    throw new Error('useCart must be used within CartProvider');
  }
  return ctx;
}
