'use client';

import Image from 'next/image';
import aboutimg from './IMG_5179.JPG'

export default function About() {
  return (
    <section id="about-us" className="py-24 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          
          {/* Left Column: Image */}
          <div className="relative animate-fade-in-left">
            <div className="absolute top-2 left-0 sm:top-4 sm:-left-4 w-full h-full border-2 border-accent/30 z-0"></div>
            <div className="relative z-10 w-full h-[300px] sm:h-[400px] md:h-[500px] lg:h-[580px]">
              <Image 
                src={aboutimg} 
                alt="Artisan crafting metalware" 
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover shadow-xl rounded-sm"
              />
            </div>  
            <div className="absolute -bottom-4 -right-4 sm:-bottom-6 sm:-right-6 bg-black text-white p-4 sm:p-6 shadow-lg z-20 max-w-[280px] sm:max-w-xs hidden md:block">
              <p className="italic text-base sm:text-lg leading-snug">"Quality is not an act, it is a habit."</p>
            </div>
          </div>

          {/* Right Column: Text Content */}
          <div className="animate-fade-in-right">
            <div className="inline-flex items-center gap-2 mb-6">
              <span className="text-accent font-bold tracking-[0.2em] uppercase text-xs">Who We Are</span>
              <div className="h-[1px] w-12 bg-accent"></div>
            </div>
            
            <h2 className="text-4xl md:text-5xl font-bold text-black mb-8 leading-tight">
              A Legacy of <span className="italic text-accent">Tradition</span> Meets Modern Hospitality
            </h2>
            
            <div className="space-y-6 text-black/70 text-lg font-light leading-relaxed">
              <p>
                <strong className="text-black font-semibold">Regal Brass & Steelware (Regal Horeca)</strong> has been a cornerstone of the hospitality industry since 1978. 
              </p>
              <p>
              We specialize in delivering bespoke kitchen solutions, bridging the gap between traditional craftsmanship—like our signature brass biryani handis—and the modern demands of 5-star commercial kitchens.
              </p>
              <p>
                With over <strong className="text-black">45 years</strong> of experience, we don't just sell products; we provide the foundation for culinary excellence, trusted by chefs and hoteliers across the nation.
              </p>
              
              <div className="pt-4">
                <button className="text-black font-semibold uppercase tracking-widest text-sm hover:text-accent transition-colors pb-1 relative group">
                  <span className="relative inline-block">
                    Read Our Full Story
                    <span className="absolute bottom-0 left-1/2 w-0 h-0.5 bg-accent transition-all duration-300 ease-out group-hover:w-full group-hover:left-1/2 group-hover:-translate-x-1/2"></span>
                  </span>
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

