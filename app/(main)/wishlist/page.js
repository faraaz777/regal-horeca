/**
 * Wishlist Page
 * 
 * Displays all products in the user's wishlist.
 */

'use client';

import { useState, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import ProductCard from '@/components/ProductCard';
import ProductCardSkeleton from '@/components/ProductCardSkeleton';

export default function WishlistPage() {
  const { wishlist } = useAppContext();
  const [wishlistProducts, setWishlistProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchWishlistProducts() {
      if (wishlist.length === 0) {
        setWishlistProducts([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Fetch products by IDs
        const promises = wishlist.map(id => 
          fetch(`/api/products/${id}`).then(res => res.json())
        );
        const results = await Promise.all(promises);
        const fetched = results
          .filter(r => r.success && r.product)
          .map(r => r.product);
        setWishlistProducts(fetched);
      } catch (error) {
        console.error('Failed to fetch wishlist products:', error);
        setWishlistProducts([]);
      } finally {
        setLoading(false);
      }
    }

    fetchWishlistProducts();
  }, [wishlist]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">My Wishlist</h1>
      
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <ProductCardSkeleton key={`wishlist-skeleton-${index}`} />
          ))}
        </div>
      ) : wishlistProducts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {wishlistProducts.map(product => (
            <ProductCard key={product._id || product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <h2 className="text-2xl font-semibold mb-4">Your wishlist is empty</h2>
          <p className="text-gray-500 mb-6">Start adding products to your wishlist!</p>
          <a href="/catalog" className="text-primary font-semibold hover:underline">
            Browse Products
          </a>
        </div>
      )}
    </div>
  );
}

