/**
 * Product Card Component
 *
 * Responsive, modern product card with
 * robust image handling for any aspect ratio.
 */

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { HeartIcon } from './Icons';
import { useAppContext } from '@/context/AppContext';

export default function ProductCard({ product }) {
  const { addToWishlist, removeFromWishlist, isInWishlist } = useAppContext();

  const productId = product._id || product.id;
  const isLiked = isInWishlist(productId);
  const isPremium = product.isPremium;

  const handleWishlistToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isLiked) {
      removeFromWishlist(productId);
    } else {
      addToWishlist(productId);
    }
  };

  const formatPrice = (price) => {
    if (price == null) return 'Price on request';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .format(price)
      .replace('₹', '₹ ');
  };

  const cardToneClasses = isPremium
    ? 'bg-premium-dark/90 border-premium-light/30 text-premium-text'
    : 'bg-white border-gray-200 text-gray-900';

  const titleClasses = isPremium
    ? 'text-premium-light'
    : 'text-gray-900 group-hover:text-primary';

  const brandClasses = isPremium ? 'text-gray-400' : 'text-gray-500';

  const priceClasses = isPremium ? 'text-premium-text' : 'text-gray-900';

  const badgeClasses = isPremium
    ? 'border border-premium-light/60 bg-premium-dark/60 text-premium-light/90'
    : 'border border-primary/10 bg-primary/5 text-primary';

  // Robust image source
  const heroImage =
    product.heroImage ||
    product.image ||
    (product.images && product.images[0]) ||
    '/placeholder-product.jpg';

  return (
    <article className="group relative h-full w-full">
      <Link
        href={`/products/${product.slug}`}
        className={`relative flex h-full w-full flex-col rounded-2xl border ${cardToneClasses} overflow-hidden shadow-sm transition-all duration-500 ease-out hover:-translate-y-1 hover:shadow-xl`}
      >
        {/* IMAGE SECTION */}
        <div className="relative w-full aspect-[4/3] sm:aspect-[4/3] bg-slate-50 overflow-hidden">
          {/* Padded frame to make any aspect ratio look good */}
          <div className="absolute inset-0 p-3 sm:p-4">
            <div className="relative w-full h-full">
              <Image
                src={heroImage}
                alt={product.title || product.name}
                fill
                sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 100vw"
                className="object-contain transition-transform duration-700 ease-out group-hover:scale-105 group-hover:-translate-y-1"
              />
            </div>
          </div>

          {/* Border highlight on hover */}
          <div className="pointer-events-none absolute inset-0 rounded-2xl border border-black/5 group-hover:border-primary/30 transition-colors duration-500 ease-out" />

          {/* Premium / Tag badge */}
          <div className="absolute top-2 sm:top-3 left-2 sm:left-3 flex flex-col gap-1 sm:gap-2">
            {isPremium && (
              <span
                className={`inline-flex items-center rounded-full px-2.5 sm:px-3 py-0.5 sm:py-1 text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.16em] ${badgeClasses} backdrop-blur-sm transition-all duration-500 ease-out`}
              >
                Premium Collection
              </span>
            )}
            {product.tag && !isPremium && (
              <span className="inline-flex items-center rounded-full px-2.5 sm:px-3 py-0.5 sm:py-1 text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.16em] border border-white/60 bg-black/40 text-white/90 backdrop-blur-sm transition-all duration-500 ease-out">
                {product.tag}
              </span>
            )}
          </div>

          {/* Wishlist button */}
          <button
            onClick={handleWishlistToggle}
            className="absolute top-2 sm:top-3 right-2 sm:right-3 rounded-full bg-white/85 hover:bg-white shadow-md backdrop-blur-sm p-2 sm:p-2.5 flex items-center justify-center transition-all duration-400 ease-out hover:shadow-lg hover:-translate-y-0.5 active:scale-95"
            aria-label={isLiked ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            <HeartIcon
              isFilled={isLiked}
              className={`w-4 h-4 sm:w-5 sm:h-5 transition-colors duration-400 ease-out ${
                isLiked ? 'text-primary' : 'text-gray-500'
              }`}
            />
          </button>
        </div>

        {/* CONTENT SECTION */}
        <div className="flex flex-1 flex-col justify-between p-3 sm:p-4 md:p-5 gap-2">
          <div className="space-y-2">
            {/* Brand + SKU */}
            <div className="flex items-center justify-between gap-2">
              <p
                className={`text-[10px] sm:text-[11px] uppercase tracking-[0.18em] ${brandClasses}`}
              >
                {product.brand || 'Regal HoReCa'}
              </p>
              {product.sku && (
                <span className="text-[9px] sm:text-[10px] text-gray-400">
                  #{product.sku}
                </span>
              )}
            </div>

            {/* Title */}
            <h3
              className={`mt-0.5 text-xs sm:text-sm md:text-base font-semibold line-clamp-2 ${titleClasses} transition-colors duration-500 ease-out`}
            >
              {product.title || product.name}
            </h3>

            {/* Optional sub-info */}
            {product.shortDescription || product.size || product.capacity ? (
              <p className="mt-1 text-[11px] sm:text-xs text-gray-400 line-clamp-2 transition-colors duration-500 ease-out">
                {product.shortDescription ||
                  product.size ||
                  product.capacity}
              </p>
            ) : null}
          </div>

          {/* Price + micro CTA */}
          <div className="mt-2 flex items-end justify-between gap-3">
            <div className="flex flex-col">
              <span
                className={`text-sm sm:text-base font-semibold ${priceClasses} transition-colors duration-500 ease-out`}
              >
                {formatPrice(product.price)}
              </span>
              {product.mrp && product.mrp > product.price && (
                <span className="text-[10px] sm:text-[11px] text-gray-400 line-through transition-colors duration-500 ease-out">
                  {formatPrice(product.mrp)}
                </span>
              )}
            </div>

            <div className="flex flex-col items-end">
              <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 sm:px-3 py-1 text-[10px] sm:text-[11px] font-medium text-gray-500 transition-all duration-500 ease-out group-hover:bg-primary/5 group-hover:text-primary group-hover:border-primary/40">
                View details
                <span className="ml-1 inline-block translate-x-0 group-hover:translate-x-1 transition-transform duration-500 ease-out">
                  →
                </span>
              </span>
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}
