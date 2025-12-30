'use client';

/**
 * Hero Component
 * 
 * Full screen hero slider with premium aesthetic using Playfair Display font.
 * Features smooth transitions, parallax effects, and elegant typography.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import glassware from './glassware.png'
import heroimg1 from "../components/images/luxurybg4.png"
import heroimg2 from "../components/images/photo.png"


const slides = [
  {
    id: 1,
    title: 'Elevate Your Dining Experience',
    subtitle: 'Premium tableware crafted for modern hospitality living.',
    image: heroimg1,
    ctaText: 'Shop Collections',
    ctaLink: '/catalog',
  },
  {
    id: 2,
    title: 'Precision in Every Detail',
    subtitle: 'High-performance kitchenware for the modern chef.',
    image: heroimg2,
    ctaText: 'Discover Collections',
    ctaLink: '/catalog?category=kitchenware',
  },
  {
    id: 3,
    title: 'The Art of Glassware',
    subtitle: 'Crystal-clear designs that celebrate every occasion.',
    image: glassware,
    ctaText: 'Shop Collections',
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

  // Handle scroll down
  const handleScrollDown = () => {
    window.scrollTo({
      top: window.innerHeight,
      behavior: 'smooth',
    });
  };

  return (
    <section className="relative w-full overflow-hidden bg-black h-[85svh] md:h-[90svh]">
      <div
        className="relative w-full h-full"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {slides.map((slide, idx) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-all duration-[1500ms] ease-out ${idx === current
              ? 'opacity-100 z-10'
              : 'opacity-0 z-0'
              }`}
          >
            {/* Background Image with Slow Zoom Effect */}
            <div className="absolute inset-0 overflow-hidden">
              <Image
                src={slide.image}
                alt={slide.title}
                fill
                sizes="100vw"
                priority={idx === 0}
                className={`object-cover transition-transform duration-[10000ms] ease-in-out ${idx === current ? 'scale-110' : 'scale-100'
                  }`}
              />
              {/* Refined Gradient Overlay */}
              <div className="absolute inset-0 bg-black/40 bg-gradient-to-b from-black/60 via-transparent to-black/60" />
              <div className="absolute inset-0 bg-black/20" />
            </div>

            {/* Content Container */}
            <div className="absolute inset-0 flex items-center justify-center -translate-y-8 md:-translate-y-12">
              <div className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center">

                {/* Decorative Line */}
                <div
                  className={`w-[1px] h-12 bg-white/50 mb-6 transition-all duration-1000 delay-300 ${idx === current ? 'opacity-100 h-12' : 'opacity-0 h-0'
                    }`}
                />

                <p
                  className={`text-white/80 uppercase tracking-[0.3em] text-[10px] sm:text-xs mb-4 transition-all duration-1000 delay-500 transform font-medium ${idx === current
                    ? 'translate-y-0 opacity-100'
                    : 'translate-y-8 opacity-0'
                    }`}
                >
                  Premium Hospitality Solutions
                </p>

                <h1
                  className={`text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-serif text-white mb-4 leading-[1.1] tracking-tight transition-all duration-1000 delay-700 transform ${idx === current
                    ? 'translate-y-0 opacity-100'
                    : 'translate-y-12 opacity-0'
                    }`}
                >
                  {slide.title}
                </h1>

                <p
                  className={`text-white/90 text-lg md:text-xl mb-8 max-w-xl mx-auto font-light leading-relaxed transition-all duration-1000 delay-900 transform ${idx === current
                    ? 'translate-y-0 opacity-100'
                    : 'translate-y-8 opacity-0'
                    }`}
                >
                  {slide.subtitle}
                </p>

                <div
                  className={`flex flex-col sm:flex-row items-center justify-center gap-6 transition-all duration-1000 delay-1000 transform ${idx === current
                    ? 'translate-y-0 opacity-100'
                    : 'translate-y-8 opacity-0'
                    }`}
                >
                  <Link
                    href={slide.ctaLink}
                    className="group relative px-8 py-3 overflow-hidden bg-white text-black transition-all duration-300 hover:bg-white/90"
                  >
                    <span className="relative z-10 text-xs font-bold uppercase tracking-[0.2em]">
                      {slide.ctaText}
                    </span>
                  </Link>

                  <Link
                    href="/about"
                    className="group px-8 py-3 bg-transparent border border-white/30 text-white text-xs font-bold uppercase tracking-[0.2em] hover:bg-white hover:text-black transition-all duration-300"
                  >
                    Our Story
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Custom Navigation Arrows */}
        <div className="absolute bottom-8 right-8 z-20 hidden md:flex gap-4">
          <button
            onClick={prevSlide}
            className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white hover:bg-white hover:text-black transition-all duration-300"
          >
            ←
          </button>
          <button
            onClick={nextSlide}
            className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white hover:bg-white hover:text-black transition-all duration-300"
          >
            →
          </button>
        </div>

        {/* Scroll Indicator */}
        <button
          onClick={handleScrollDown}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 text-white hidden md:flex flex-col items-center gap-2 opacity-60 hover:opacity-100 transition-opacity duration-300 animate-bounce"
        >
          <span className="text-[10px] uppercase tracking-widest">Scroll</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 5V19M12 19L19 12M12 19L5 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Slide Indicators - Mobile: Bottom, Desktop: Left */}
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 flex flex-row gap-3 md:hidden">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => goToSlide(idx)}
              className={`w-8 h-1 rounded-full transition-all duration-300 ${idx === current ? 'bg-white w-12' : 'bg-white/20 hover:bg-white/40'
                }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
        
        {/* Slide Indicators - Desktop: Left Side */}
        <div className="absolute left-8 top-1/2 -translate-y-1/2 z-20 hidden md:flex flex-col gap-4">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => goToSlide(idx)}
              className={`w-1 h-8 rounded-full transition-all duration-300 ${idx === current ? 'bg-white h-12' : 'bg-white/20 hover:bg-white/40'
                }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
