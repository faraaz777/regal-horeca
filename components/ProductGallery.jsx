'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * ProductGallery Component
 * 
 * Displays main product image with thumbnail navigation.
 * Refined for Phase 5 with smooth transitions and premium vertical layout.
 */
export default function ProductGallery({ images, title, isPremium = false, featured = false }) {
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
    <div className="flex flex-col md:flex-row-reverse gap-4 lg:gap-6">
      {/* Main Image Container */}
      <div className="relative flex-1 aspect-square bg-white border border-black/5 rounded-2xl overflow-hidden group shadow-sm">
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
              className="object-contain p-10 transition-transform duration-700 group-hover:scale-110"
            />
          </motion.div>
        </AnimatePresence>

        {/* Status Overlay (Subtle) */}
        <div className="absolute inset-x-0 bottom-0 py-6 bg-gradient-to-t from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      </div>

      {/* Thumbnails - Vertical on Desktop, Horizontal on Mobile */}
      {images.length > 1 && (
        <div className="flex md:flex-col gap-3 sm:gap-4 overflow-x-auto md:overflow-y-auto no-scrollbar scroll-smooth">
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedIndex(idx)}
              className={`relative flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 md:w-20 md:h-20 lg:w-24 lg:h-24 border rounded-xl overflow-hidden transition-all duration-300 ${selectedIndex === idx
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
                  className="absolute inset-0 border-2 border-accent rounded-xl pointer-events-none"
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

