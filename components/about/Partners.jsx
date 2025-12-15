'use client';

const brands = [
  "Ariane", "FNS", "Pasabahce", "Ocean", "Superware", "Hawkins", "Clay Craft", "Bharat"
];

const hotels = [
  "Taj Group", "ITC Kohenur", "Hyatt", "Le Meridien", "The Park", "Novotel", "Marriott", "Radisson"
];

export default function Partners() {
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
                <div 
                  key={idx}
                  className="bg-zinc-800/50 p-4 text-center rounded-sm border border-zinc-700 cursor-default hover:-translate-y-1 hover:bg-white/10 transition-all duration-300"
                >
                  <span className="font-medium text-zinc-300">{brand}</span>
                </div>
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
                <div 
                  key={idx}
                  className="bg-zinc-800/50 p-4 text-center rounded-sm border border-zinc-700 cursor-default hover:-translate-y-1 hover:bg-regal-orange/20 hover:border-regal-orange transition-all duration-300"
                >
                  <span className="font-medium text-zinc-300">{hotel}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

