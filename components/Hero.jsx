'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import glassware from '@/components/images/glassware.png'
import heroimg1 from "../components/images/hero.png"
import heroimg2 from "../components/images/photo.png"

const slides = [
  {
    id: 1,
    image: heroimg1,
    alt: 'Hero banner 1',
  },
  {
    id: 2,
    image: heroimg2,
    alt: 'Hero banner 2',
  },
  {
    id: 3,
    image: glassware,
    alt: 'Hero banner 3',
  },
];

export default function Hero() {
  const [current, setCurrent] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [touchStartX, setTouchStartX] = useState(null);
  const [touchEndX, setTouchEndX] = useState(null);

  const nextSlide = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrent((prev) => (prev + 1) % slides.length);
    setTimeout(() => setIsTransitioning(false), 600);
  }, [isTransitioning]);

  const prevSlide = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrent((prev) => (prev - 1 + slides.length) % slides.length);
    setTimeout(() => setIsTransitioning(false), 600);
  }, [isTransitioning]);

  const goToSlide = useCallback((index) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrent(index);
    setTimeout(() => setIsTransitioning(false), 600);
  }, [isTransitioning]);

  // Auto-play
  useEffect(() => {
    const timer = setInterval(nextSlide, 8000);
    return () => clearInterval(timer);
  }, [nextSlide]);

  // Swipe handlers (mobile)
  const onTouchStart = (e) => {
    setTouchStartX(e.touches[0].clientX);
    setTouchEndX(null);
  };

  const onTouchMove = (e) => {
    setTouchEndX(e.touches[0].clientX);
  };

  const onTouchEnd = () => {
    if (touchStartX === null || touchEndX === null) return;

    const diff = touchStartX - touchEndX;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        // swipe left
        nextSlide();
      } else {
        // swipe right
        prevSlide();
      }
    }

    setTouchStartX(null);
    setTouchEndX(null);
  };

  return (
    <section className="relative w-full overflow-hidden px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
      <div
        className="relative w-full h-[300px] sm:h-[350px] md:h-[400px] lg:h-[450px] rounded-2xl md:rounded-3xl overflow-hidden group"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {slides.map((slide, idx) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-opacity duration-1000 ease-out ${
              idx === current ? 'opacity-100 z-10' : 'opacity-0 z-0'
            }`}
          >
            <Image
              src={slide.image}
              alt={slide.alt}
              fill
              sizes="100vw"
              priority={idx === 0}
              className="object-cover"
            />
          </div>
        ))}

        {/* Navigation Arrows */}
        <button
          onClick={prevSlide}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2 bg-white/80 hover:bg-white backdrop-blur-sm rounded-full shadow-lg transition-all duration-300 opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95"
          aria-label="Previous slide"
        >
          <ChevronLeft className="w-5 h-5 text-gray-900" />
        </button>
        <button
          onClick={nextSlide}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2 bg-white/80 hover:bg-white backdrop-blur-sm rounded-full shadow-lg transition-all duration-300 opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95"
          aria-label="Next slide"
        >
          <ChevronRight className="w-5 h-5 text-gray-900" />
        </button>

        {/* Dot Indicators */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => goToSlide(idx)}
              className={`transition-all duration-300 rounded-full ${
                idx === current
                  ? 'w-8 h-2 bg-white'
                  : 'w-2 h-2 bg-white/50 hover:bg-white/70'
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
