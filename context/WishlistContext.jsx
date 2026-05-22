'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const WishlistContext = createContext(undefined);

const WISHLIST_KEY = 'regal_wishlist';

export function WishlistProvider({ children }) {
  const [wishlist, setWishlist] = useState([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(WISHLIST_KEY);
      if (stored) {
        setWishlist(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load wishlist from localStorage', error);
    }
  }, []);

  const addToWishlist = useCallback(
    (productId) => {
      setWishlist((prev) => {
        if (prev.includes(productId)) return prev;
        const next = [...prev, productId];
        localStorage.setItem(WISHLIST_KEY, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  const removeFromWishlist = useCallback((productId) => {
    setWishlist((prev) => {
      const next = prev.filter((id) => id !== productId);
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isInWishlist = useCallback((productId) => wishlist.includes(productId), [wishlist]);

  const value = {
    wishlist,
    addToWishlist,
    removeFromWishlist,
    isInWishlist,
  };

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (ctx === undefined) {
    throw new Error('useWishlist must be used within WishlistProvider');
  }
  return ctx;
}
