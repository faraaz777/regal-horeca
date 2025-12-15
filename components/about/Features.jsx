'use client';

import Image from 'next/image';

const features = [
  { 
    title: "Commercial Cookware", 
    desc: "Heavy-duty pots, pans, and handis designed for high-volume kitchens.",
    image: "https://images.unsplash.com/photo-1556910103-1c02745a30bf?q=80&w=800&auto=format&fit=crop"
  },
  { 
    title: "Brass & Copper", 
    desc: "Traditional manufacturing of authentic serving ware and utensils.",
    image: "https://images.unsplash.com/photo-1615993215286-904d9c75908f?q=80&w=800&auto=format&fit=crop"
  },
  { 
    title: "Hotelware Supplies", 
    desc: "Complete range of crockery, cutlery, and buffet setups for 5-star hotels.",
    image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=800&auto=format&fit=crop"
  },
  { 
    title: "Glassware & Barware", 
    desc: "Premium crystal and durability-focused glasses for banquets.",
    image: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?q=80&w=800&auto=format&fit=crop"
  },
  { 
    title: "Retail Presence", 
    desc: "Accessible stores in Begum Bazar and Afzalgunj.",
    image: "https://images.unsplash.com/photo-1604719312566-b7cb0463283a?q=80&w=800&auto=format&fit=crop"
  },
  { 
    title: "Global Distribution", 
    desc: "Serving national and international markets with robust logistics.",
    image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=800&auto=format&fit=crop"
  }
];

export default function Features() {
  return (
    <section id="products" className="py-24 bg-zinc-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-regal-orange font-bold tracking-widest uppercase text-sm">What We Do</span>
          <h2 className="font-serif text-4xl font-bold text-regal-black mt-2 mb-4">Our Expertise</h2>
          <p className="text-gray-600 max-w-2xl mx-auto font-light">
            Comprehensive solutions for the Horeca industry, from manufacturing to last-mile delivery.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-white border border-gray-100 shadow-sm hover:shadow-2xl transition-all duration-300 group rounded-sm overflow-hidden hover:-translate-y-2"
            >
              {/* Image Container */}
              <div className="h-48 overflow-hidden relative">
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors duration-500 z-10"></div>
                <Image 
                  src={feature.image} 
                  alt={feature.title}
                  fill
                  className="object-cover transform group-hover:scale-110 transition-transform duration-700"
                />
              </div>

              {/* Content */}
              <div className="p-8 relative">
                <div className="absolute -top-6 right-8 bg-regal-orange w-12 h-1 bg-opacity-0 group-hover:bg-opacity-100 transition-all duration-300"></div>
                
                <h3 className="font-serif text-xl font-bold text-regal-black mb-3 group-hover:text-regal-orange transition-colors">
                  {feature.title}
                </h3>
                <p className="text-gray-500 font-light leading-relaxed text-sm">
                  {feature.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

