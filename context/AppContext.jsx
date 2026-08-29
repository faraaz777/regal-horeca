/**
 * App provider composition + unified `useAppContext()` facade.
 *
 * Cart and wishlist live in dedicated providers (fewer unrelated re-renders).
 * Taxonomy (categories, brands, business types) uses SWR with SSR fallback data.
 */

'use client';

import { Toaster } from 'react-hot-toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SWRProvider } from '@/lib/hooks/useSWRConfig';
import { TaxonomyProvider } from '@/context/TaxonomyContext';
import { WishlistProvider } from '@/context/WishlistContext';
import { CartProvider } from '@/context/CartContext';
import { useTaxonomy } from '@/context/TaxonomyContext';
import { useWishlist } from '@/context/WishlistContext';
import { useCart } from '@/context/CartContext';

export function AppProvider({ children, initialCategories = [] }) {
  return (
    <ErrorBoundary>
      <SWRProvider>
        <TaxonomyProvider initialCategories={initialCategories}>
          <WishlistProvider>
            <CartProvider>
              {children}
              <Toaster />
            </CartProvider>
          </WishlistProvider>
        </TaxonomyProvider>
      </SWRProvider>
    </ErrorBoundary>
  );
}

/**
 * @deprecated Prefer useCart / useWishlist / useTaxonomy for new code.
 * Merged surface kept for existing components.
 */
export function useAppContext() {
  const taxonomy = useTaxonomy();
  const wishlist = useWishlist();
  const cart = useCart();

  return {
    products: [],
    categories: taxonomy.categories,
    brands: taxonomy.brands,
    businessTypes: taxonomy.businessTypes,
    loading: taxonomy.loading,
    ...wishlist,
    ...cart,
    refreshCategories: taxonomy.refreshCategories,
    upsertCategory: taxonomy.upsertCategory,
    removeCategory: taxonomy.removeCategory,
    refreshBrands: taxonomy.refreshBrands,
    upsertBrand: taxonomy.upsertBrand,
    removeBrand: taxonomy.removeBrand,
    refreshProducts: async () => {},
  };
}
