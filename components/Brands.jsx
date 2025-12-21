"use client";
import ariane from "../lib/ariane.png"
import bybone from "../lib/bybone.png"
import ocean from "../lib/ocean.png"

// Helper to get image src from Next.js static import
const getImageSrc = (img) => {
  if (typeof img === 'string') return img;
  if (img?.src) return img.src;
  if (img?.default) return img.default.src || img.default;
  return img;
};

const BRANDS = [
  getImageSrc(ariane),
  getImageSrc(bybone),
  getImageSrc(ocean),
  getImageSrc(ariane),
  getImageSrc(bybone),
  getImageSrc(ocean),
];

export default function Brands() {
  return (
    <section className="py-20 bg-gray-50 border-y border-black/5 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 mb-12 text-center">
        <p className="text-[10px] uppercase font-bold tracking-[0.4em] text-black/40">Trusted by the best in the world</p>
      </div>
      <div className="flex gap-20 animate-marquee whitespace-nowrap">
        {[...BRANDS, ...BRANDS].map((brand, i) => (
          <img 
            key={i} 
            src={brand} 
            alt="Partner Brand" 
            className="h-10 opacity-30 grayscale hover:opacity-100 hover:grayscale-0 transition-all cursor-crosshair"
          />
        ))}
      </div>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          display: flex;
          width: fit-content;
          animation: marquee 30s linear infinite;
        }
      `}</style>
    </section>
  );
}

