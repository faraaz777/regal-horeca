'use client';

/**
 * Hero Component
 * 
 * Hero slider with smooth transitions and animations
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';

const slides = [
  {
    id: 1,
    title: 'Elevate Your Dining Experience',
    subtitle: 'Premium tableware crafted for modern hospitality living.',
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=2000',
    ctaText: 'Shop Collections',
    ctaLink: '/catalog',
  },
  {
    id: 2,
    title: 'Precision in Every Detail',
    subtitle: 'High-performance kitchenware for the modern chef.',
    image: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&q=80&w=2000',
    ctaText: 'Discover Tools',
    ctaLink: '/catalog?category=kitchenware',
  },
  {
    id: 3,
    title: 'The Art of Glassware',
    subtitle: 'Crystal-clear designs that celebrate every occasion.',
    image: 'https://images.unsplash.com/photo-1544145945-f904253db0ad?auto=format&fit=crop&q=80&w=2000',
    ctaText: 'Explore Drinkware',
    ctaLink: '/catalog?category=glassware',
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
    setTimeout(() => setIsTransitioning(false), 1200);
  }, [isTransitioning]);

  const prevSlide = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrent((prev) => (prev - 1 + slides.length) % slides.length);
    setTimeout(() => setIsTransitioning(false), 1200);
  }, [isTransitioning]);

  const goToSlide = useCallback((index) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrent(index);
    setTimeout(() => setIsTransitioning(false), 1200);
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
    <section className="relative w-full overflow-hidden bg-black pt-[120px] md:pt-[140px]">
      <div
        className="relative h-[70vh] sm:h-[80vh] lg:h-[85vh]"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {slides.map((slide, idx) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-all duration-[1200ms] ease-out ${
              idx === current
                ? 'opacity-100 scale-100 z-10'
                : 'opacity-0 scale-110 z-0'
            }`}
          >
            {/* Background Image with Zoom Effect */}
            <div className="absolute inset-0">
              <Image
                src={slide.image}
                alt={slide.title}
                fill
                priority={idx === 0}
                className={`object-cover transition-transform duration-[8000ms] ease-linear ${
                  idx === current ? 'scale-110' : 'scale-100'
                }`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            </div>

            {/* Content */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
                <p
                  className={`text-white/60 uppercase tracking-[0.4em] text-xs sm:text-sm mb-6 transition-all duration-1000 delay-300 transform ${
                    idx === current
                      ? 'translate-y-0 opacity-100'
                      : 'translate-y-8 opacity-0'
                  }`}
                >
                  Premium Hospitality Solutions
                </p>
                <h1
                  className={`text-4xl sm:text-6xl md:text-8xl font-bold text-white mb-8 leading-[1.1] transition-all duration-1000 delay-500 transform ${
                    idx === current
                      ? 'translate-y-0 opacity-100'
                      : 'translate-y-12 opacity-0'
                  }`}
                >
                  {slide.title}
                </h1>
                <p
                  className={`text-white/80 text-lg md:text-xl mb-12 max-w-2xl mx-auto font-light transition-all duration-1000 delay-700 transform ${
                    idx === current
                      ? 'translate-y-0 opacity-100'
                      : 'translate-y-8 opacity-0'
                  }`}
                >
                  {slide.subtitle}
                </p>
                <div
                  className={`flex flex-wrap items-center justify-center gap-6 transition-all duration-1000 delay-900 transform ${
                    idx === current
                      ? 'translate-y-0 opacity-100'
                      : 'translate-y-8 opacity-0'
                  }`}
                >
                  <Link
                    href={slide.ctaLink}
                    className="px-10 py-5 bg-white text-black text-xs font-black uppercase tracking-[0.2em] hover:bg-accent hover:text-white transition-all duration-300 shadow-2xl"
                  >
                    {slide.ctaText}
                  </Link>
                  <Link
                    href="/about"
                    className="px-10 py-5 bg-transparent border border-white/30 text-white text-xs font-black uppercase tracking-[0.2em] hover:bg-white/10 transition-all duration-300"
                  >
                    Our Story
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Left Arrow */}
        <button
          type="button"
          onClick={prevSlide}
          className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 inline-flex items-center justify-center rounded-full w-9 h-9 sm:w-10 sm:h-10 bg-black/35 hover:bg-black/55 backdrop-blur-md border border-white/10 transition-all duration-300 group z-20"
          aria-label="Previous slide"
        >
          <span className="text-white text-xl sm:text-2xl leading-none group-hover:-translate-x-0.5 transition-transform duration-300">
            ‹
          </span>
        </button>

        {/* Right Arrow */}
        <button
          type="button"
          onClick={nextSlide}
          className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 inline-flex items-center justify-center rounded-full w-9 h-9 sm:w-10 sm:h-10 bg-black/35 hover:bg-black/55 backdrop-blur-md border border-white/10 transition-all duration-300 group z-20"
          aria-label="Next slide"
        >
          <span className="text-white text-xl sm:text-2xl leading-none group-hover:translate-x-0.5 transition-transform duration-300">
            ›
          </span>
        </button>

        {/* Slide Navigation Dots */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => goToSlide(idx)}
              className="group py-4 px-2"
              aria-label={`Go to slide ${idx + 1}`}
            >
              <div
                className={`h-[2px] transition-all duration-500 rounded-full ${
                  idx === current
                    ? 'w-12 bg-white'
                    : 'w-6 bg-white/30 group-hover:bg-white/60'
                }`}
              />
            </button>
          ))}
        </div>

        {/* Visual Indicator of Progress */}
        <div
          className="absolute bottom-0 left-0 h-1 bg-accent z-30 transition-all duration-[8000ms] ease-linear"
          style={{ width: `${((current + 1) / slides.length) * 100}%` }}
        />
      </div>
    </section>
  );
}

