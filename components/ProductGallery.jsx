'use client';

import { useState } from 'react';
import Image from 'next/image';

/**
 * ProductGallery Component
 * 
 * Displays main product image with thumbnail navigation
 */
export default function ProductGallery({ images, title, isPremium = false, featured = false }) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (!images || images.length === 0) {
    return null;
  }

  // Determine badge text: Premium takes priority over Exclusive
  const badgeText = isPremium ? 'Premium' : (featured ? 'Exclusive' : null);

  return (
    <div className="flex flex-col gap-4">
      {/* Main Image Container */}
      <div className="relative w-full aspect-square bg-white border border-gray-200 rounded-lg overflow-hidden group">
        <Image
          src={images[selectedIndex]}
          alt={`${title} view ${selectedIndex + 1}`}
          fill
          className="object-contain p-4 transition-transform duration-300 group-hover:scale-105"
        />
        {badgeText && (
          <div className="absolute top-4 left-4 z-10">
            <span className="border border-[#F97316] text-[#F97316] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider bg-transparent">
              {badgeText}
            </span>
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="grid grid-cols-4 gap-4">
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedIndex(idx)}
              className={`relative aspect-square bg-white border rounded-md overflow-hidden transition-all duration-200 ${
                selectedIndex === idx
                  ? 'border-brand-orange ring-1 ring-brand-orange shadow-sm'
                  : 'border-gray-200 hover:border-gray-400'
              }`}
            >
              <Image
                src={img}
                alt={`Thumbnail ${idx + 1}`}
                fill
                className="object-contain p-1"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

