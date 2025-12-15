import React from 'react';
import { motion } from 'framer-motion';

const brands = [
  "Ariane", "FNS", "Pasabahce", "Ocean", "Superware", "Hawkins", "Clay Craft", "Bharat"
];

const hotels = [
  "Taj Group", "ITC Kohenur", "Hyatt", "Le Meridien", "The Park", "Novotel", "Marriott", "Radisson"
];

const Partners: React.FC = () => {
  return (
    <section className="py-24 bg-zinc-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          
          {/* Column 1: Brand Partners */}
          <div>
            <div className="mb-8">
              <span className="text-regal-orange tracking-widest uppercase text-xs font-bold">Official Distributors</span>
              <h2 className="font-serif text-3xl font-bold mt-2">Brand Partners</h2>
              <p className="text-zinc-400 mt-4 text-sm leading-relaxed">
                We are proud authorized distributors for the world's leading tableware and kitchenware brands, bringing global quality to your doorstep.
              </p>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {brands.map((brand, idx) => (
                <motion.div 
                  key={idx}
                  whileHover={{ y: -3, backgroundColor: 'rgba(255,255,255,0.1)' }}
                  className="bg-zinc-800/50 p-4 text-center rounded-sm border border-zinc-700 cursor-default"
                >
                  <span className="font-medium text-zinc-300">{brand}</span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Column 2: Hotel Partners */}
          <div>
            <div className="mb-8">
              <span className="text-regal-orange tracking-widest uppercase text-xs font-bold">Our Clientele</span>
              <h2 className="font-serif text-3xl font-bold mt-2">Hotel Partners</h2>
              <p className="text-zinc-400 mt-4 text-sm leading-relaxed">
                Trusted by the most prestigious names in hospitality. We have equipped the finest kitchens and banquets across the region.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {hotels.map((hotel, idx) => (
                <motion.div 
                  key={idx}
                  whileHover={{ y: -3, backgroundColor: 'rgba(194, 65, 12, 0.2)', borderColor: '#C2410C' }}
                  className="bg-zinc-800/50 p-4 text-center rounded-sm border border-zinc-700 cursor-default transition-colors"
                >
                  <span className="font-medium text-zinc-300">{hotel}</span>
                </motion.div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default Partners;