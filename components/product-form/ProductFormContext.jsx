'use client';

import { createContext, useContext } from 'react';

const ProductFormContext = createContext(null);

export function ProductFormProvider({ value, children }) {
  return <ProductFormContext.Provider value={value}>{children}</ProductFormContext.Provider>;
}

export function useProductForm() {
  const ctx = useContext(ProductFormContext);
  if (!ctx) {
    throw new Error('useProductForm must be used inside ProductFormProvider');
  }
  return ctx;
}
