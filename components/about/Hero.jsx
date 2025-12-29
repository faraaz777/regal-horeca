'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowDown } from 'lucide-react';

export default function Hero() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const parallaxY = Math.min(scrollY * 0.3, 150);

  const handleDiscoverStory = (e) => {
    e.preventDefault();
    const aboutSection = document.getElementById('about-us');
    if (aboutSection) {
      aboutSection.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  return (
    <div id="home" className="relative h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image with Parallax and Overlay */}
      <div 
        className="absolute inset-0 z-0"
        style={{ transform: `translateY(${parallaxY}px)` }}
      >
        <Image
          src="https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?q=80&w=2070&auto=format&fit=crop"
          alt="Luxury Hospitality Kitchenware"
          fill
          sizes="100vw"
          className="object-cover scale-105"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 text-center text-white">
        <div className="animate-fade-in-up">
          <p className="text-accent font-bold tracking-[0.2em] uppercase text-sm mb-4">
            Established 1978
          </p>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            Crafting Excellence in <br />
            <span className="text-accent">
              Brass & Steelware
            </span>
          </h1>
          <p className="font-light text-lg md:text-xl text-white/90 max-w-2xl mx-auto mb-10 leading-relaxed">
            Over 45 years of defining quality in the hospitality industry. 
            From traditional biryani handis to modern commercial kitchens.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={handleDiscoverStory}
              className="bg-accent text-white px-8 py-3 rounded-none border border-accent font-medium tracking-wide hover:bg-transparent hover:text-white transition-all duration-300"
            >
              DISCOVER OUR STORY
            </button>
            <Link 
              href="/catalog"
              className="bg-transparent text-white px-8 py-3 rounded-none border border-white font-medium tracking-wide hover:bg-white hover:text-black transition-all duration-300"
            >
              VIEW CATALOG
            </Link>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 text-white/50 animate-bounce">
        <ArrowDown size={32} />
      </div>
    </div>
  );
}

