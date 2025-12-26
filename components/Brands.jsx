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

// Brand logos configuration
// To add a new logo:
// 1. Place the logo image in the /lib folder (e.g., /lib/newbrand.png)
// 2. Import it at the top: import newbrand from "../lib/newbrand.png"
// 3. Add it to the BRANDS array below using getImageSrc(newbrand)
const BRANDS = [
  { src: getImageSrc(bybone), name: "By Bone" },
  { src: getImageSrc(ocean), name: "Ocean" },
  { src: getImageSrc(ariane), name: "Ariane" },
  { src: "https://bybone.com/wp-content/uploads/2023/12/logow300_white.png", name: "By Bone" },
  { src: getImageSrc(ocean), name: "Ocean" },
  { src: "https://www.milton.in/cdn/shop/files/1__1_-removebg-preview_1_a5b0b114-e4b3-4846-afe9-b88cac3a7abc.png?v=1752814136&width=200", name: "Milton" },
  { src: "https://file.hstatic.net/200000409027/file/logo_300_x_83_e722f9e57bbc489f85994c3fb893ccd5.png", name: "Superware" },
  { src: "https://arianefineporcelain.com/wp-content/uploads/2023/01/Ariane-Logo-Final-Transparent.png", name: "Ariane" },
];

export default function Brands() {
  return (
    <section className="relative bg-black border-y border-white/10 overflow-hidden">
      {/* Full-bleed background */}
      <div className="w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] py-6 sm:py-7 md:py-8">

        {/* Heading */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-6 sm:mb-7 md:mb-8 text-center">
          <p className="text-xs sm:text-sm uppercase font-semibold tracking-[0.25em] sm:tracking-[0.35em] text-white/50">
            Trusted by the best in the world
          </p>
        </div>

        {/* Marquee Container */}
        <div className="relative overflow-hidden">
          {/* Gradient overlays for smooth fade effect */}
          <div className="absolute left-0 top-0 bottom-0 w-32 sm:w-48 md:w-64 bg-gradient-to-r from-black via-black/80 to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-32 sm:w-48 md:w-64 bg-gradient-to-l from-black via-black/80 to-transparent z-10 pointer-events-none" />

          {/* Logo track */}
          <div className="flex gap-16 sm:gap-20 md:gap-24 lg:gap-32 animate-marquee items-center py-4">
            {[...BRANDS, ...BRANDS, ...BRANDS].map((brand, i) => (
              <div key={i} className="flex-shrink-0">
                <img
                  src={brand.src}
                  alt={brand.name}
                  className="h-8 sm:h-10 md:h-12 w-auto object-contain opacity-70"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Animation */}
        <style>{`
          @keyframes marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-33.333%); }
          }
          .animate-marquee {
            width: fit-content;
            animation: marquee 30s linear infinite;
          }
        `}</style>

      </div>
    </section>
  );
}

