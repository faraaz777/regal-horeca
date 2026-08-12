'use client';

import Image from 'next/image';
import { Package } from 'lucide-react';

const blurDataURL =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q==';

/**
 * Small product thumb for inventory movement UIs.
 * Display-only compressed list size — no full-size preview.
 */
export default function ProductImageThumb({
  src,
  alt = 'Product',
  size = 56,
  rounded = 'rounded-lg',
  className = '',
}) {
  const imageSrc = typeof src === 'string' ? src.trim() : '';

  if (!imageSrc) {
    return (
      <div
        className={`flex-shrink-0 bg-gray-100 border border-dashed border-gray-300 flex items-center justify-center text-gray-300 ${rounded} ${className}`}
        style={{ width: size, height: size }}
        aria-hidden
      >
        <Package size={Math.max(16, Math.round(size * 0.4))} />
      </div>
    );
  }

  return (
    <div
      className={`relative flex-shrink-0 overflow-hidden bg-gray-100 border border-gray-200 ${rounded} ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={imageSrc}
        alt={alt}
        fill
        sizes={`${size}px`}
        unoptimized
        loading="lazy"
        className="object-cover"
        placeholder="blur"
        blurDataURL={blurDataURL}
      />
    </div>
  );
}
