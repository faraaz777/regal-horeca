'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * ProductGallery Component
 *
 * Main hero image + thumbnail strip, with optional overlay controls.
 */
export default function ProductGallery({
  images,
  title,
  isPremium = false,
  featured = false,
  isLiked = false,
  onToggleWishlist,
  onShare,
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset to first image when images change (e.g., when color variant is selected)
  useEffect(() => {
    setSelectedIndex(0);
  }, [images]);

  if (!images || images.length === 0) {
    return null;
  }

  const badgeText = isPremium ? 'Premium' : (featured ? 'Exclusive' : null);

  return (
     <div className="flex flex-col lg:items-end md:items-start  ">
      {/* Main Image Container - square so product images fit and center properly */}
      <div className="relative w-full lg:min-w-[90%] aspect-square bg-white border border-black/5 rounded-2xl overflow-hidden group shadow-sm  ">
        <AnimatePresence mode="wait">
          <motion.div
            key={images[selectedIndex]}
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            className="absolute inset-0"
          >
            <Image
              src={images[selectedIndex]}
              alt={`${title} view ${selectedIndex + 1}`}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-contain object-left p-6 sm:p-8 md:p-10 transition-transform duration-700 group-hover:scale-105"
            />
          </motion.div>
        </AnimatePresence>

        {/* Top-right actions: Desktop shows Share + Wishlist; mobile shows Wishlist only (smaller) */}
        {(onShare || onToggleWishlist) && (
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex flex-col gap-2 z-20">
            {onShare && (
              <button
                type="button"
                onClick={onShare}
                className="hidden sm:flex w-10 h-10 rounded-xl border border-black/10 bg-white hover:bg-white shadow-sm items-center justify-center transition-colors"
                aria-label="Share product"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="w-4 h-4 text-black/70"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <path d="M8.6 13.5 15.4 17" />
                  <path d="M15.4 7 8.6 10.5" />
                </svg>
              </button>
            )}

            {onToggleWishlist && (
              <button
                type="button"
                onClick={onToggleWishlist}
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl border bg-white/95 shadow-sm flex items-center justify-center transition-colors ${
                  isLiked
                    ? 'border-accent text-accent'
                    : 'border-black/10 text-black/40 hover:text-accent hover:border-accent'
                }`}
                aria-label={isLiked ? 'Remove from wishlist' : 'Add to wishlist'}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="w-4 h-4"
                  fill={isLiked ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20.8 4.6c-1.5-1.8-4.2-2-5.9-.3L12 7.2 9.1 4.3C7.4 2.6 4.7 2.8 3.2 4.6 1.5 6.7 1.7 9.8 3.6 11.7l2.9 2.9 3.5 3.5c.5.5 1.3.5 1.8 0l3.5-3.5 2.9-2.9c1.9-1.9 2.1-5 0.6-7.1Z" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Bottom-right arrows (desktop only) */}
        {images.length > 1 && (
          <div className="hidden sm:flex absolute bottom-4 right-4 flex-col items-center gap-2 z-20">
            <button
              type="button"
              onClick={() =>
                setSelectedIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
              }
              className="w-9 h-9 rounded-xl bg-white border border-black/10 shadow-sm flex items-center justify-center hover:bg-white transition-colors"
              aria-label="Previous image"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 18L9 12l6-6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() =>
                setSelectedIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
              }
              className="w-9 h-9 rounded-xl bg-white border border-black/10 shadow-sm flex items-center justify-center hover:bg-white transition-colors"
              aria-label="Next image"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>
          </div>
        )}

        {/* Subtle bottom gradient */}
        <div className="absolute inset-x-0 bottom-0 py-4 bg-gradient-to-t from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      </div>

      {/* Thumbnails - horizontal row (scrollable) with hidden scrollbar */}
      {images.length > 1 && (
        <div className="mt-0 flex justify-start gap-0 overflow-x-auto no-scrollbar scroll-smooth">
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedIndex(idx)}
              className={`relative flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 border overflow-hidden transition-all duration-300 ${selectedIndex === idx
                ? 'border-accent shadow-md ring-1 ring-accent/20 scale-[0.98]'
                : 'border-black/5 hover:border-black/20 bg-white opacity-80 hover:opacity-100'
                }`}
            >
              <Image
                src={img}
                alt={`Thumbnail ${idx + 1}`}
                fill
                className={`object-contain p-2 transition-transform duration-500 ${selectedIndex === idx ? 'scale-90' : 'group-hover:scale-110'}`}
              />

              {/* Active Indicator Line */}
              {selectedIndex === idx && (
                <motion.div
                  layoutId="active-thumb"
                  className="absolute inset-0 border-2 border-accent pointer-events-none"
                />
              )}
            </button>
          ))}
        </div>
      )}

      <style jsx>{`
        /* Hide scrollbar while keeping scroll */
        .no-scrollbar {
          -ms-overflow-style: none; /* IE/Edge */
          scrollbar-width: none; /* Firefox */
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none; /* Chrome/Safari */
          width: 0;
          height: 0;
        }
      `}</style>
    </div>
  );
}

