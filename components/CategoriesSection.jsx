'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function CategoriesSection({ categories }) {
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);
  const scrollContainerRef = useRef(null);
  const categoryRefs = useRef([]);

  // Intersection Observer for mobile categories animation
  useEffect(() => {
    const isMobile = window.innerWidth < 1024;
    if (!isMobile) return;

    const observerOptions = {
      root: scrollContainerRef.current,
      threshold: 0.7, // Trigger when 70% of the card is visible
      rootMargin: '0px'
    };

    const observerCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const index = parseInt(entry.target.getAttribute('data-index'));
          setActiveCategoryIndex(index);
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    // Copy refs to a local variable for cleanup
    const currentRefs = categoryRefs.current;
    currentRefs.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => {
      currentRefs.forEach((ref) => {
        if (ref) observer.unobserve(ref);
      });
    };
  }, [categories]);

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -320, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 320, behavior: "smooth" });
    }
  };

  // Filter main categories (level === "department")
  const mainCategories = categories.filter((c) => c.level === "department");

  if (mainCategories.length === 0) {
    return null;
  }

  return (
    <section className="py-20 px-4 bg-gray-50 relative border-t border-black/5">
      <div className="max-w-full mx-auto relative group/section">
        <div className="text-center mb-16">
          <span className="text-xs font-bold tracking-[0.2em] text-accent uppercase mb-3 block">
            Discover Our Collections
          </span>
          <h2 className="text-4xl md:text-5xl font-serif text-black mb-6">
            Curated Excellence
          </h2>
          <div className="w-24 h-1 bg-black/5 mx-auto rounded-full" />
        </div>

        {/* Left Arrow - Only Desktop */}
        <button
          onClick={scrollLeft}
          className="hidden md:flex absolute left-4 top-[60%] -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-white/80 backdrop-blur-sm border border-black/10 items-center justify-center text-black hover:bg-black hover:text-white transition-all duration-300 shadow-lg opacity-0 group-hover/section:opacity-100"
          aria-label="Scroll Left"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M15 19L8 12L15 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Right Arrow - Only Desktop */}
        <button
          onClick={scrollRight}
          className="hidden md:flex absolute right-4 top-[60%] -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-white/80 backdrop-blur-sm border border-black/10 items-center justify-center text-black hover:bg-black hover:text-white transition-all duration-300 shadow-lg opacity-0 group-hover/section:opacity-100"
          aria-label="Scroll Right"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M9 5L16 12L9 19"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <div
          ref={scrollContainerRef}
          className={`flex w-full overflow-x-auto pb-12 gap-6 snap-x snap-mandatory px-4 md:px-12 hide-scrollbar ${mainCategories.length <= 5 ? "md:justify-center" : ""
            }`}
        >
          {mainCategories.map((cat, i) => {
            const isActive = activeCategoryIndex === i;
            return (
              <Link
                key={cat._id || cat.id || `category-${i}`}
                href={`/catalog?category=${cat.slug}`}
                ref={(el) => (categoryRefs.current[i] = el)}
                data-index={i}
                className={`flex-none snap-center group relative w-[280px] h-[420px] rounded-[100px] border bg-white overflow-hidden transition-all duration-500 ${isActive
                  ? "border-accent shadow-2xl scale-[1.02] md:border-black/10 md:shadow-none md:scale-100 md:hover:border-accent md:hover:shadow-2xl"
                  : "border-black/10 hover:border-accent hover:shadow-2xl"
                  }`}
              >
                {/* Hover Background Fill */}
                <div className={`absolute inset-0 bg-accent origin-bottom transition-transform duration-500 ease-in-out z-0 ${isActive ? "scale-y-100 md:scale-y-0" : "scale-y-0 group-hover:scale-y-100"
                  }`} />

                <div className="relative z-10 w-full h-full flex flex-col items-center">
                  {/* Image Container - Top Half */}
                  <div className="w-full h-[55%] relative p-4">
                    <div className="w-full h-full relative rounded-[80px] overflow-hidden bg-gray-50">
                      {cat.image ? (
                        <Image
                          src={cat.image}
                          alt={cat.name}
                          fill
                          sizes="280px"
                          className={`object-cover transition-transform duration-700 ${isActive ? "scale-110 md:scale-100" : "scale-100 group-hover:scale-110"
                            }`}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          No Image
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Content - Bottom Half */}
                  <div className="w-full h-[45%] flex flex-col items-center justify-center p-6 text-center">
                    <span className={`text-xs font-bold tracking-[0.25em] uppercase mb-2 transition-colors duration-300 ${isActive ? "text-white/80 md:text-accent" : "text-accent group-hover:text-white/80"
                      }`}>
                      Collection
                    </span>
                    <h3 className={`text-2xl font-serif mb-6 transition-colors duration-300 ${isActive ? "text-white md:text-black" : "text-black group-hover:text-white"
                      }`}>
                      {cat.name}
                    </h3>

                    {/* Arrow Icon */}
                    <div className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all duration-300 ${isActive
                      ? "border-white/40 bg-white/20 md:border-black/10 md:bg-transparent"
                      : "border-black/10 group-hover:border-white/40 group-hover:bg-white/20"
                      }`}>
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        className={`transform transition-all duration-300 ${isActive ? "text-white -rotate-45 md:text-black md:rotate-0" : "text-black group-hover:text-white group-hover:-rotate-45"
                          }`}
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M5 12H19M19 12L12 5M19 12L12 19"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

