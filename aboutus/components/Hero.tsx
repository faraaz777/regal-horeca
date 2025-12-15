import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowDown } from 'lucide-react';

const Hero: React.FC = () => {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, 150]);

  return (
    <div id="home" className="relative h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image with Parallax and Overlay */}
      <motion.div style={{ y }} className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?q=80&w=2070&auto=format&fit=crop"
          alt="Luxury Hospitality Kitchenware"
          className="w-full h-full object-cover scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80"></div>
      </motion.div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 text-center text-white">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <p className="text-regal-orange font-bold tracking-[0.2em] uppercase text-sm mb-4">
            Established 1978
          </p>
          <h1 className="font-serif text-5xl md:text-7xl font-bold mb-6 leading-tight">
            Crafting Excellence in <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-regal-orange">
              Brass & Steelware
            </span>
          </h1>
          <p className="font-light text-lg md:text-xl text-gray-200 max-w-2xl mx-auto mb-10 leading-relaxed">
            Over 45 years of defining quality in the hospitality industry. 
            From traditional biryani handis to modern commercial kitchens.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
             <button className="bg-regal-orange text-white px-8 py-3 rounded-none border border-regal-orange font-medium tracking-wide hover:bg-transparent hover:text-white transition-all duration-300">
              DISCOVER OUR STORY
            </button>
            <button className="bg-transparent text-white px-8 py-3 rounded-none border border-white font-medium tracking-wide hover:bg-white hover:text-black transition-all duration-300">
              VIEW CATALOG
            </button>
          </div>
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.div 
        className="absolute bottom-10 left-1/2 transform -translate-x-1/2 text-white/50"
        animate={{ y: [0, 10, 0] }}
        transition={{ repeat: Infinity, duration: 2 }}
      >
        <ArrowDown size={32} />
      </motion.div>
    </div>
  );
};

export default Hero;