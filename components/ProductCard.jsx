"use client";

import Link from "next/link";
import Image from "next/image";
import { HeartIcon, ShoppingCartIcon } from './Icons';
import { useAppContext } from '@/context/AppContext';
import toast from 'react-hot-toast';

export default function ProductCard({ product, onAdd }) {
  const { addToWishlist, removeFromWishlist, isInWishlist, addToCart, removeFromCart, isInCart } = useAppContext();

  // Get product image - support multiple field names
  const productImage = 
    product.heroImage || 
    product.image || 
    (product.images && product.images[0]) || 
    '/placeholder-product.jpg';

  // Get product name/title
  const productName = product.title || product.name || 'Product';

  // Get product ID
  const productId = product._id || product.id;
  const isLiked = isInWishlist(productId);
  // ProductCard doesn't have color selection, so check for item without color variant
  const inCart = isInCart(productId, null);

  // Format price
  const formatPrice = (price) => {
    if (price == null || price === 0) return 'Price on request';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .format(price)
      .replace('₹', '₹');
  };

  const handleAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onAdd) {
      onAdd(product);
    }
  };

  const handleWishlistToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isLiked) {
      removeFromWishlist(productId);
    } else {
      addToWishlist(productId);
    }
  };

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (inCart) {
      // Remove the item without color variant (since ProductCard doesn't have color selection)
      removeFromCart(productId, null);
      toast.success('Removed from cart!');
    } else {
      addToCart(productId, 1, {
        price: product.price
        // No selectedColor - adding without color variant
      });
    toast.success('Added to cart!');
    }
  };

  return (
    <div className="group border border-black/10 rounded-lg overflow-hidden bg-white">
      <div className="relative">
        <Link href={`/products/${product.slug}`} className="block">
          <div className="relative h-48 md:h-56 w-full overflow-hidden bg-white border-b border-black/10">
            <Image
              src={productImage}
              alt={productName}
              fill
              sizes="(min-width: 768px) 25vw, 50vw, 100vw"
              className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        </Link>
        {/* Wishlist button */}
        <button
          onClick={handleWishlistToggle}
          className="absolute top-1.5 right-1.5 rounded-full bg-white/90 hover:bg-white shadow-md backdrop-blur-sm p-1.5 flex items-center justify-center transition-all duration-300 hover:shadow-lg hover:scale-110 z-10"
          aria-label={isLiked ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <HeartIcon
            isFilled={isLiked}
            className={`w-4 h-4 transition-colors duration-300 ${
              isLiked ? 'text-accent' : 'text-black/50'
            }`}
          />
        </button>
      </div>
      <div className="p-3">
        {product.brand && (
          <div className="text-[10px] text-black/50 uppercase tracking-wide mb-1">
            {product.brand}
          </div>
        )}
        <Link href={`/products/${product.slug}`}>
          <h3 className="text-xs md:text-sm font-medium text-black line-clamp-2">{productName}</h3>
        </Link>
        <div className="mt-1.5 flex items-center justify-between">
          <div className="text-xs md:text-sm font-semibold text-black">{formatPrice(product.price)}</div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleAddToCart}
              className={`px-2 py-0.5 text-xs border rounded transition flex items-center gap-1 ${
                inCart 
                  ? 'bg-accent text-white border-accent' 
                  : 'hover:bg-accent hover:text-white border-black/20 text-black'
              }`}
            >
              <ShoppingCartIcon className="w-3 h-3" />
              {inCart ? 'In Cart' : 'Add'}
            </button>
            {onAdd && (
              <button
                onClick={handleAdd}
                className="px-2 py-0.5 text-xs border border-black/20 rounded hover:bg-accent hover:text-white text-black transition"
              >
                Add
              </button>
            )}
            <Link
              href={`/products/${product.slug}`}
              className="text-[10px] text-black/60 hover:text-black transition"
            >
              View
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
