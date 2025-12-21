'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import FeatureCard from './FeatureCard';

// Icon Components
const AwardIcon = ({ className = 'w-6 h-6' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
  </svg>
);

const PackageIcon = ({ className = 'w-6 h-6' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);

const RefreshCwIcon = ({ className = 'w-6 h-6' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const UsersIcon = ({ className = 'w-6 h-6' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const features = [
  {
    id: 1,
    title: '45 Years of Legacy',
    description: 'A reliable, pan-India hospitality supply brand with nearly half a century of unmatched industry expertise.',
    icon: <AwardIcon className="w-6 h-6" />,
    imageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 2,
    title: '6,000+ Products',
    description: 'A comprehensive one-stop solution with bulk-ready stock for daily essentials and bespoke large orders.',
    icon: <PackageIcon className="w-6 h-6" />,
    imageUrl: 'https://images.unsplash.com/photo-1544644061-e1f8d4628f8d?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 3,
    title: 'Consistent Quality',
    description: 'We maintain rigorous standards so reorders consistently match the same aesthetic look and premium feel.',
    icon: <RefreshCwIcon className="w-6 h-6" />,
    imageUrl: 'https://images.unsplash.com/photo-1551632432-c735e830119b?auto=format&fit=crop&q=80&w=1200'
  },
  {
    id: 4,
    title: 'Expert Support',
    description: 'Backed by a trained sales team and wide distribution network for leading global hospitality brands.',
    icon: <UsersIcon className="w-6 h-6" />,
    imageUrl: 'https://images.unsplash.com/photo-1556740758-90de374c12ad?auto=format&fit=crop&q=80&w=1200'
  }
];

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&q=80&w=1200';

export default function WhyChooseUs() {
  const [activeId, setActiveId] = useState(null);

  const activeFeature = features.find(f => f.id === activeId);

  return (
    <section className="py-12 mb-10 px-6 md:px-12 lg:px-24 max-w-[1400px] mx-auto bg-white">
      <div className="grid lg:grid-cols-12 gap-16 items-start">
        
        {/* Left Side: Editorial Content */}
        <div className="lg:col-span-5 space-y-12">
          <div className="space-y-4">
            <span className="text-accent text-xs font-bold tracking-[0.3em] uppercase block mb-4">
              Premium Hospitality Supply
            </span>
            <h2 className="text-5xl md:text-6xl font-extrabold text-black leading-[1.1] tracking-tighter">
              Why choose <br/> <span className=" bg-clip-text  text-accent/70">Regal?</span>
            </h2>
          </div>
          
          <div className="relative pl-8 border-l-2 border-accent/20">
            <p className="text-gray-700 text-sm leading-relaxed  font-bold">
              Regal is a reliable, pan-India hospitality supply brand with 45 years of experience. We provide excellence in hospitality distribution and quality consistency.
            </p>
           
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {features.map((feature, index) => (
              <FeatureCard 
                key={feature.id} 
                feature={feature} 
                index={index} 
                isHovered={activeId === feature.id}
                onHover={setActiveId}
              />
            ))}
          </div>
        </div>

        {/* Right Side: Luxury Imagery with Stacked Crossfade */}
        <div className="lg:col-span-7 relative">
          <div className="relative group">
            {/* Geometric Accent Frame */}
            <div className="absolute -top-4 -right-4 w-full h-full border border-accent z-0 transition-transform duration-[1200ms] group-hover:translate-x-4 group-hover:-translate-y-4" />
            
            {/* Image Container */}
            <div className="relative z-10 overflow-hidden shadow-2xl bg-gray-100 h-[700px]">
              
              {/* Stacked Images for Ultra-Smooth Crossfade */}
              <div 
                className={`absolute inset-0 transition-all duration-[1500ms] ease-in-out ${
                  activeId === null ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
                }`}
              >
                <Image 
                  src={DEFAULT_IMAGE} 
                  alt="Regal Hospitality Default"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>

              {features.map((feature) => (
                <div 
                  key={feature.id}
                  className={`absolute inset-0 transition-all duration-[1500ms] ease-in-out ${
                    activeId === feature.id ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
                  }`}
                >
                  <Image 
                    src={feature.imageUrl} 
                    alt={feature.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </div>
              ))}
              
              {/* Subtle Overlay */}
              <div className="absolute inset-0 bg-black/5 pointer-events-none" />
            </div>

            {/* Float Badge / Stat Overlay */}
            <div className="absolute -bottom-10 -left-10 bg-black p-10 z-20 hidden xl:block border-t-4 border-accent transition-all duration-1000">
              <div className="text-white">
                <p className="text-4xl font-extrabold mb-1">
                  {activeFeature ? activeFeature.title.split(' ')[0] : '45+'}
                </p>
                <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-gray-400">
                  {activeFeature ? 'Service Standard' : 'Years of Legacy'}
                </p>
              </div>
            </div>
          </div>
          
          {/* Footer Stats & CTA */}
          <div className="mt-12 flex items-center justify-between border-t border-gray-100 pt-8">
            <div className="flex gap-12">
              <div className="group cursor-default">
                <p className="text-lg font-bold group-hover:text-accent transition-colors duration-700">6,000+</p>
                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Products</p>
              </div>
              <div className="group cursor-default">
                <p className="text-lg font-bold group-hover:text-accent transition-colors duration-700">Pan-India</p>
                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Distribution</p>
              </div>
            </div>
            <Link 
              href="/catalog"
              className="bg-accent text-white px-8 py-4 text-[10px] uppercase tracking-[0.2em] font-extrabold hover:bg-black transition-all duration-700 transform hover:-translate-y-1"
            >
              View Catalog
            </Link>
          </div>
        </div>

      </div>
    </section>
  );
}

