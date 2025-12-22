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
    <section className="relative bg-black border-y border-white/10 overflow-hidden">
    {/* Full-bleed background */}
    <div className="w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] py-8 sm:py-10 md:py-12">
  
      {/* Heading */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-8 sm:mb-10 md:mb-14 text-center">
        <p className="text-xs sm:text-sm md:text-base uppercase font-semibold tracking-[0.2em] sm:tracking-[0.3em] md:tracking-[0.45em] text-white/50">
          Trusted by the best in the world
        </p>
      </div>
  
      {/* Marquee */}
      <div className="relative overflow-hidden">
        {/* Padding container for logos */}
        <div className="px-4 sm:px-6 md:px-8 lg:px-16 xl:px-24">
          <div className="flex gap-12 sm:gap-16 md:gap-20 lg:gap-24 animate-marquee whitespace-nowrap items-center">
            {[...BRANDS, ...BRANDS].map((brand, i) => (
              <img
                key={i}
                src={brand}
                alt="Partner Brand"
                className="
                  h-10 sm:h-12 md:h-14 lg:h-16
                  opacity-50 grayscale
                  hover:opacity-100 hover:grayscale-0
                  transition-all duration-500 ease-out
                  cursor-pointer
                "
              />
            ))}
          </div>
        </div>
      </div>
  
      {/* Animation */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          width: fit-content;
          animation: marquee 35s linear infinite;
        }
      `}</style>
  
    </div>
  </section>
  

  );
}

