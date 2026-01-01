'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MainBannerCard from './MainBannerCard';
import SmallBannerCard from './SmallBannerCard';
import heroimg1 from './images/hero.png';
import heroimg2 from './images/photo.png';
import glassware from './images/glassware.png';

// Main large banner data (left side)
const MAIN_BANNERS = [
  {
    id: 1,
    title: 'Premium',
    subtitle: 'Hospitality Supplies',
    description: 'Discover our curated collection of premium tableware, kitchenware, and equipment designed for excellence.',
    badge: '100% Natural',
    badgeColor: 'bg-yellow-400 text-yellow-900',
    imageUrl: heroimg1,
    bgColor: 'bg-blue-50',
    accentColor: 'text-yellow-400',
    shopUrl: '/catalog',
    learnMoreUrl: '/about',
  },
  {
    id: 2,
    title: 'Quality',
    subtitle: 'You Can Trust',
    description: 'Over 45 years of excellence in providing premium hospitality supplies to hotels, restaurants, and cafés across India.',
    badge: '100% Natural',
    badgeColor: 'bg-yellow-400 text-yellow-900',
    imageUrl: heroimg2,
    bgColor: 'bg-blue-50',
    accentColor: 'text-yellow-400',
    shopUrl: '/catalog',
    learnMoreUrl: '/about',
  },
  {
    id: 3,
    title: 'Excellence',
    subtitle: 'In Every Detail',
    description: 'From tableware to kitchen equipment, we provide everything you need for a world-class hospitality experience.',
    badge: '100% Natural',
    badgeColor: 'bg-yellow-400 text-yellow-900',
    imageUrl: glassware,
    bgColor: 'bg-blue-50',
    accentColor: 'text-yellow-400',
    shopUrl: '/catalog',
    learnMoreUrl: '/about',
  },
];

// Small banner data (right side - stacked)
const SMALL_BANNERS = [
  {
    id: 1,
    title: 'Fruits & Vegetables',
    discount: '20% Off',
    saleLabel: 'SALE',
    imageUrl: heroimg2,
    bgColor: 'bg-green-50',
    shopUrl: '/catalog?category=fruits-vegetables',
  },
  {
    id: 2,
    title: 'Baked Products',
    discount: '15% Off',
    saleLabel: 'SALE',
    imageUrl: glassware,
    bgColor: 'bg-pink-50',
    shopUrl: '/catalog?category=baked-products',
  },
];

export default function Hero({ mainBanners = MAIN_BANNERS, smallBanners = SMALL_BANNERS }) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [touchStartX, setTouchStartX] = useState(null);
  const [touchEndX, setTouchEndX] = useState(null);

  const nextSlide = () => setActiveSlide((prev) => (prev + 1) % mainBanners.length);
  const prevSlide = () => setActiveSlide((prev) => (prev - 1 + mainBanners.length) % mainBanners.length);

  // Auto-slide every 10 seconds
  useEffect(() => {
    const timer = setInterval(nextSlide, 10000);
    return () => clearInterval(timer);
  }, []);

  // Swipe handlers for mobile
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
        nextSlide();
      } else {
        prevSlide();
      }
    }

    setTouchStartX(null);
    setTouchEndX(null);
  };

  return (
    <section className="relative w-screen overflow-hidden bg-orange-50/30">
      {/* Fixed height container - never changes */}
      <div className="relative w-full h-[500px] sm:h-[550px] md:h-[600px] lg:h-[650px] xl:h-[700px]">
        {/* Container with max-width and padding */}
        <div className="relative w-full max-w-7xl mx-auto h-full px-3 sm:px-4 md:px-6 lg:px-8">
          {/* Grid layout: Large banner left, two small banners right */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-3 sm:gap-4 md:gap-5 h-full">
            
            {/* Large Left Banner */}
            <div 
              className="relative h-full rounded-xl sm:rounded-2xl overflow-hidden shadow-lg"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeSlide}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ 
                    duration: 1.2, 
                    ease: [0.25, 0.46, 0.45, 0.94]
                  }}
                  className="w-full h-full"
                >
                  <MainBannerCard data={mainBanners[activeSlide]} />
                </motion.div>
              </AnimatePresence>

              {/* Pagination Dots - Yellow for active, white for inactive */}
              <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 sm:gap-3 z-20">
                {mainBanners.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveSlide(i)}
                    className="group p-1"
                    aria-label={`Go to slide ${i + 1}`}
                  >
                    <div className={`h-2 w-2 rounded-full transition-all duration-500 ease-in-out ${
                      activeSlide === i ? 'bg-yellow-400 w-8 shadow-md' : 'bg-white w-2 group-hover:bg-yellow-200'
                    }`} />
                  </button>
                ))}
              </div>
            </div>

            {/* Right Column - Two Small Banners Stacked */}
            <div className="flex flex-col gap-3 sm:gap-4 md:gap-5 h-full">
              {smallBanners.map((banner, index) => (
                <div key={banner.id} className="flex-1 min-h-0">
                  <SmallBannerCard data={banner} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
