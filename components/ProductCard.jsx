"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { HeartIcon, ShoppingCartIcon } from './Icons';
import { useAppContext } from '@/context/AppContext';
import toast from 'react-hot-toast';

export default function ProductCard({ product, onAdd }) {
  const { addToWishlist, removeFromWishlist, isInWishlist, addToCart, removeFromCart, isInCart } = useAppContext();

  // Get product images - combine heroImage and gallery
  const getProductImages = () => {
    const images = [];

    // Add heroImage first if it exists
    if (product.heroImage) {
      images.push(product.heroImage);
    }

    // Add gallery images if they exist
    if (product.gallery && Array.isArray(product.gallery) && product.gallery.length > 0) {
      // Filter out duplicates (in case heroImage is also in gallery)
      product.gallery.forEach(img => {
        if (img && !images.includes(img)) {
          images.push(img);
        }
      });
    }

    // Fallback to other possible image fields
    if (images.length === 0) {
      if (product.images && Array.isArray(product.images) && product.images.length > 0) {
        images.push(...product.images);
      } else if (product.image) {
        images.push(product.image);
      } else {
        images.push('/placeholder-product.jpg');
      }
    }

    return images;
  };

  const productImages = getProductImages();

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const imageContainerRef = useRef(null);
  const productImage = productImages[currentImageIndex];

  // Swipe detection for mobile
  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && productImages.length > 1) {
      handleImageChange('next');
    }
    if (isRightSwipe && productImages.length > 1) {
      handleImageChange('prev');
    }
  };

  // Get product name/title
  const productName = product.title || product.name || 'Product';

  // Get product ID
  const productId = product._id || product.id;

  // Get product slug with fallback - use ID if slug is missing (API handles both)
  const productSlug = product.slug || productId?.toString();

  const isLiked = isInWishlist(productId);
  const inCart = isInCart(productId, null);

  // Get brand and category
  const brand = product.brand || product.brandCategory?.name || '';
  const category = product.category?.name || product.categoryName || '';

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

  const handleWishlistToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isLiked) {
      removeFromWishlist(productId);
      toast.success('Removed from wishlist');
    } else {
      addToWishlist(productId);
      toast.success('Added to wishlist');
    }
  };

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (inCart) {
      removeFromCart(productId, null);
      toast.success('Removed from cart!');
    } else {
      addToCart(productId, 1, {
        price: product.price
      });
      toast.success('Added to cart!');
    }
  };

  const handleImageChange = (direction) => {
    if (direction === 'prev') {
      setCurrentImageIndex((prev) => (prev === 0 ? productImages.length - 1 : prev - 1));
    } else {
      setCurrentImageIndex((prev) => (prev === productImages.length - 1 ? 0 : prev + 1));
    }
  };

  return (
    <div className="bg-white rounded-lg overflow-hidden flex flex-col h-full">
      {/* Image Container - Separated with rounded corners */}
      <div
        ref={imageContainerRef}
        className="group relative w-full aspect-square overflow-hidden bg-gray-50 rounded-lg"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <Link href={`/products/${productSlug}`} className="block w-full h-full relative">
          <Image
            src={productImage}
            alt={productName}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover"
          />
        </Link>

        {/* Wishlist Button - Top Right - Heart Only, No Background */}
        <button
          onClick={handleWishlistToggle}
          className="absolute top-3 right-3 flex items-center justify-center hover:scale-110 transition-all duration-200 z-10 text-accent"
          aria-label={isLiked ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <HeartIcon isFilled={isLiked} className="w-5 h-5" />
        </button>

        {/* Image Navigation Arrows - Show on hover for desktop, hidden on mobile */}
        {productImages.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleImageChange('prev');
              }}
              className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 hover:bg-white rounded-full items-center justify-center shadow-md transition-all duration-200 z-10 opacity-0 group-hover:opacity-100"
              aria-label="Previous image"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleImageChange('next');
              }}
              className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 hover:bg-white rounded-full items-center justify-center shadow-md transition-all duration-200 z-10 opacity-0 group-hover:opacity-100"
              aria-label="Next image"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </>
        )}

        {/* Image Carousel Indicators - Bottom Center on desktop (hover), Bottom Left on mobile (always visible) */}
        {productImages.length > 1 && (
          <>
            {/* Desktop - Bottom Center, show on hover */}
            <div className="hidden md:flex absolute bottom-3 left-1/2 -translate-x-1/2 gap-1.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              {productImages.map((_, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCurrentImageIndex(index);
                  }}
                  className={`transition-all duration-200 rounded-full ${index === currentImageIndex
                    ? 'w-2 h-2 bg-black'
                    : 'w-2 h-2 bg-white/80 hover:bg-white'
                    }`}
                  aria-label={`View image ${index + 1}`}
                />
              ))}
            </div>
            {/* Mobile - Bottom Left, always visible */}
            <div className="flex md:hidden absolute bottom-3 left-3 gap-1.5 z-10">
              {productImages.map((_, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCurrentImageIndex(index);
                  }}
                  className={`transition-all duration-200 rounded-full ${index === currentImageIndex
                    ? 'w-2 h-2 bg-black'
                    : 'w-2 h-2 bg-white/80'
                    }`}
                  aria-label={`View image ${index + 1}`}
                />
              ))}
            </div>
          </>
        )}

        {/* Shopping Cart Button - Bottom Right */}
        <button
          onClick={handleAddToCart}
          className={`absolute bottom-3 right-3 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-all duration-200 z-10 ${inCart ? 'ring-2 ring-accent' : ''
            }`}
          aria-label={inCart ? 'Remove from cart' : 'Add to cart'}
        >
          <ShoppingCartIcon />
        </button>
      </div>

      {/* Content - Center Aligned, Separated from Image */}
      <div className="flex-1 flex flex-col px-4 py-3.5 text-center">
        {/* Brand/Category */}
        {(brand || category) && (
          <div className="inline-flex items-center gap-2 mb-2 justify-center">
            <span className="h-px w-4 bg-accent/40"></span>
            <span className="text-xs font-bold text-accent uppercase tracking-[0.2em]">
              {brand && category ? `${brand} • ${category}` : brand || category}
            </span>
          </div>
        )}

        {/* Product Name - Larger and Bold */}
        <Link href={`/products/${productSlug}`}>
          <h3 className="text-base font-bold text-black mb-2 line-clamp-2 hover:text-accent transition-colors leading-snug">
            {productName}
          </h3>
        </Link>

        {/* Price Section - Compact and Clean */}
        <div className="flex flex-col items-center gap-1 mt-auto">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-black">
              {formatPrice(product.price || 0)}
            </span>
            {(() => {
              // Calculate original price: use originalPrice if exists, otherwise calculate as price * 1.2
              const originalPrice = product.originalPrice && product.originalPrice > product.price
                ? product.originalPrice
                : (product.price ? product.price * 1.2 : null);

              // Only show if we have a valid original price that's higher than current price
              if (originalPrice && originalPrice > product.price) {
                const discount = Math.round(((originalPrice - product.price) / originalPrice) * 100);
                return (
                  <>
                    <span className="text-[11px] text-black/40 line-through font-normal">
                      {formatPrice(originalPrice)}
                    </span>
                    {discount > 0 && (
                      <span className="text-[11px] font-semibold text-accent">
                        {discount}% off
                      </span>
                    )}
                  </>
                );
              }
              return null;
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
