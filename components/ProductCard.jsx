"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { HeartIcon } from './Icons';
import { ClipboardList as LuClipboardList } from "lucide-react";
import { useAppContext } from '@/context/AppContext';
import toast from 'react-hot-toast';

export default function ProductCard({ product, onAdd, hidePrice = false, transparent = false, compact = false }) {
  const router = useRouter();
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

  // Debug: Log image detection (only in development)
  // useEffect(() => {
  //   if (process.env.NODE_ENV === 'development' && productImages.length > 1) {
  //     console.log('Product has multiple images:', {
  //       productId: product._id || product.id,
  //       title: product.title,
  //       heroImage: product.heroImage,
  //       gallery: product.gallery,
  //       totalImages: productImages.length,
  //       images: productImages
  //     });
  //   }
  // }, [productImages.length, product._id, product.id, product.title, product.heroImage, product.gallery]);

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [isHovered, setIsHovered] = useState(false);
  const imageContainerRef = useRef(null);
  const hoverIntervalRef = useRef(null);
  const productImage = productImages[currentImageIndex];

  // Swipe detection for mobile
  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    // Only handle if product has multiple images
    if (productImages.length <= 1) return;
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    // Only handle if product has multiple images
    if (productImages.length <= 1) return;
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = (e) => {
    // Only handle if product has multiple images
    if (productImages.length <= 1) {
      setTouchStart(null);
      setTouchEnd(null);
      return;
    }
    
    if (!touchStart || !touchEnd) {
      setTouchStart(null);
      setTouchEnd(null);
      return;
    }
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      e.preventDefault();
      handleImageChange('next');
    }
    if (isRightSwipe) {
      e.preventDefault();
      handleImageChange('prev');
    }
    
    // Reset touch state
    setTouchStart(null);
    setTouchEnd(null);
  };

  // Get product name/title and optional specs (when title uses " | " separator)
  const rawTitle = product.title || product.name || 'Product';
  const pipeParts = rawTitle.split(/\s*\|\s*/).map((s) => s.trim()).filter(Boolean);
  const productName = pipeParts[0] || rawTitle;
  const productSpecs = pipeParts.length > 1 ? pipeParts.slice(1).join(' · ') : null;

  // Get product ID
  const productId = product._id || product.id;

  // Get product slug with fallback - use ID if slug is missing (API handles both)
  const productSlug = product.slug || productId?.toString();

  const defaultCatalogVariant =
    Array.isArray(product?.variants) && product.variants.length > 0
      ? product.variants.find((v) => v.isDefault) || product.variants[0]
      : null;

  const isLiked = isInWishlist(productId);
  const inCart = isInCart(productId, null, defaultCatalogVariant);

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
      removeFromCart(productId, null, defaultCatalogVariant);
      toast.success('Removed from cart!');
    } else {
      addToCart(productId, 1, {
        selectedVariant: defaultCatalogVariant,
        price:
          defaultCatalogVariant != null
            ? defaultCatalogVariant.price ?? product.price ?? null
            : product.price ?? null,
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

  // Auto-cycle images on hover (desktop only)
  useEffect(() => {
    if (isHovered && productImages.length > 1 && typeof window !== 'undefined' && window.innerWidth >= 768) {
      hoverIntervalRef.current = setInterval(() => {
        setCurrentImageIndex((prev) => (prev === productImages.length - 1 ? 0 : prev + 1));
      }, 2000); // Change image every 2 seconds
    } else {
      if (hoverIntervalRef.current) {
        clearInterval(hoverIntervalRef.current);
        hoverIntervalRef.current = null;
      }
    }
    return () => {
      if (hoverIntervalRef.current) {
        clearInterval(hoverIntervalRef.current);
      }
    };
  }, [isHovered, productImages.length]);

  return (
    <div className={`overflow-hidden flex flex-col h-full ${transparent ? '' : 'bg-white'}`}>
      {/* Image Container - Separated with rounded corners */}
      <div
        ref={imageContainerRef}
        className={`group relative w-full ${compact ? 'aspect-[3/2] sm:aspect-[4/3] md:aspect-square' : 'aspect-square'} overflow-hidden hover:scale-105 transition-all duration-700 rounded-none select-none ${transparent ? 'bg-white' : ''}`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Image
          src={productImage}
          alt={productName}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
          className="object-contain select-none pointer-events-none"
          draggable={false}
        />
        {/* Clickable overlay for navigation - only captures clicks, not touches */}
        {productImages.length <= 1 && (
          <Link 
            href={`/products/${productSlug}`}
            className="absolute inset-0 z-10"
            onClick={(e) => {
              // Don't navigate if clicking on a button
              if (e.target.closest('button')) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
          />
        )}
        {/* For products with multiple images, handle click navigation manually */}
        {productImages.length > 1 && (
          <div 
            className="absolute inset-0 z-10 cursor-pointer"
            onClick={(e) => {
              // Don't navigate if clicking on a button or during swipe
              if (e.target.closest('button')) {
                return;
              }
              // Check if this was a swipe (not a click)
              if (touchStart !== null && touchEnd !== null) {
                const distance = Math.abs(touchStart - touchEnd);
                if (distance > minSwipeDistance) {
                  return; // It was a swipe, don't navigate
                }
              }
              // It was a click, use client-side navigation (no full page reload)
              router.push(`/products/${productSlug}`);
            }}
          />
        )}

        {/* Wishlist Button - Top Right - Heart Only, No Background */}
        <button
          onClick={handleWishlistToggle}
          className="absolute top-3 right-3 flex items-center justify-center hover:scale-110 transition-all duration-200 z-30 text-accent pointer-events-auto"
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
              className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 hover:bg-white rounded-full items-center justify-center shadow-lg transition-all duration-200 z-30 opacity-0 group-hover:opacity-100 pointer-events-auto"
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
              className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 hover:bg-white rounded-full items-center justify-center shadow-lg transition-all duration-200 z-30 opacity-0 group-hover:opacity-100 pointer-events-auto"
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
            <div className="hidden md:flex absolute bottom-3 left-1/2 -translate-x-1/2 gap-1.5 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-auto">
              {productImages.map((_, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCurrentImageIndex(index);
                  }}
                  className={`transition-all duration-200 rounded-full ${index === currentImageIndex
                    ? 'w-2.5 h-2.5 bg-black'
                    : 'w-2 h-2 bg-white/90 hover:bg-white border border-black/40'
                    }`}
                  aria-label={`View image ${index + 1}`}
                />
              ))}
            </div>
            {/* Mobile - Bottom Left, always visible */}
            <div className="flex md:hidden absolute bottom-3 left-3 gap-1.5 z-30 pointer-events-auto">
              {productImages.map((_, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCurrentImageIndex(index);
                  }}
                  className={`transition-all duration-200 rounded-full ${index === currentImageIndex
                    ? 'w-2.5 h-2.5 bg-black'
                    : 'w-2 h-2 bg-white/90 border border-black/40'
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
          className={`absolute bottom-3 right-3 bg-white rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-all duration-200 z-30 pointer-events-auto ${
            compact ? 'w-8 h-8' : 'w-10 h-10'
          } ${inCart ? 'ring-2 ring-accent' : ''}`}
          aria-label={inCart ? 'Remove from cart' : 'Add to cart'}
        >
          <LuClipboardList className={compact ? 'w-[15px] h-[15px]' : 'w-5 h-5'} />
        </button>
      </div>

      {/* Content - Center Aligned, Separated from Image */}
      <div className={`flex-1 flex flex-col text-center ${compact ? 'px-2.5 py-1.5' : 'px-4 py-3.5'}`}>
        {/* Brand/Category */}
     

        {/* Product Name - Large, Bold + Specs line (smaller, grey) */}
        <Link href={`/products/${productSlug}`} className="block">
          <h3
            className={`font-bold hover:text-accent transition-colors leading-tight break-words ${
              compact ? 'text-[11px] sm:text-[13px] md:text-sm mt-1' : 'text-sm sm:text-base md:text-lg mt-2'
            } ${transparent ? 'text-white' : 'text-black'}`}
          >
            {productName}
          </h3>
          {productSpecs && (
            <p
              className={`font-medium mt-0.5 tracking-wide leading-snug ${
                compact ? 'text-[9px] sm:text-[10px]' : 'text-[11px] sm:text-xs'
              } ${transparent ? 'text-white/80' : 'text-black/60'}`}
            >
              {productSpecs}
            </p>
          )}
        </Link>

        {/* Summary for SEO (crawlable keyword-rich content) */}
        {(product.summary || product.description) && !productSpecs && (
          <p className="text-[11px] sm:text-xs mt-1.5 line-clamp-2 text-black/60 leading-snug">
            {(product.summary || product.description || '').replace(/\s+/g, ' ').trim().slice(0, 120)}
            {(product.summary || product.description || '').length > 120 ? '…' : ''}
          </p>
        )}

        {/* Price Section - Compact and Clean */}
        {/* {!hidePrice && (product.price && product.price > 0) && (
          <div className="flex flex-col items-center gap-1 mt-auto">
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-black">
                {formatPrice(product.price)}
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
        )} */}
      </div>
    </div>
  );
}
