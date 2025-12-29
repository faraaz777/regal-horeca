/**
 * Home Page
 *
 * The main landing page of the application.
 * Displays hero slider, categories, and featured products.
 */

"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import useSWR from "swr";
import { useAppContext } from "@/context/AppContext";
import ProductCard from "@/components/ProductCard";
import ProductCardSkeleton from "@/components/ProductCardSkeleton";
import WhomWeServe from "@/components/new/WhomWeServe";
import Brands from "@/components/Brands";
import ContactUs from "@/components/ContactUs";
import FAQs from "@/app/(main)/faqs/FAQs";
import Hero from "@/components/Hero";
import Numbers from "@/components/Numbers";
import WhyChooseUs from "@/components/WhyChooseUs";
import Locations from "@/components/about/Locations";

// SWR fetcher function
const fetcher = (url) => fetch(url).then(res => res.json());

export default function HomePage() {
  const { categories } = useAppContext();
  
  // Use SWR for caching - caches for 5 minutes
  const { data: featuredData, isLoading: featuredLoading } = useSWR(
    '/api/products?featured=true&limit=4',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000, // Cache for 5 minutes
    }
  );
  
  const { data: arrivalsData, isLoading: arrivalsLoading } = useSWR(
    '/api/products?limit=4',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000, // Cache for 5 minutes
    }
  );
  
  const featuredProducts = featuredData?.products || [];
  const newArrivals = arrivalsData?.products || [];
  const loading = featuredLoading || arrivalsLoading;
  
  const [mainCategories, setMainCategories] = useState([]);
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);
  const scrollContainerRef = useRef(null);
  const categoryRefs = useRef([]);

  // Set main categories
  useEffect(() => {
    const mainCats = categories.filter((c) => c.level === "department");
    setMainCategories(mainCats);
  }, [categories]);

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
  }, [mainCategories]);

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

  return (
    <div>
      {/* Hero Slider Section */}
      <Hero />

      {/* Featured Products Section - Moved UP */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif text-black mb-4">
              Featured Products
            </h2>
            <p className="text-black/60 max-w-2xl mx-auto font-light">
              Handpicked items that define quality and elegance.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
            {loading ? (
              // Show skeleton loaders while loading
              Array.from({ length: 4 }).map((_, index) => (
                <ProductCardSkeleton key={`skeleton-${index}`} />
              ))
            ) : featuredProducts.length > 0 ? (
              featuredProducts.map((product, index) => (
                <ProductCard
                  key={product._id || product.id || `featured-${index}`}
                  product={product}
                />
              ))
            ) : (
              <div className="col-span-full text-center py-8 text-black/60">
                No featured products available
              </div>
            )}
          </div>

          <div className="flex justify-center mt-16">
            <Link
              href="/catalog"
              className="group inline-flex items-center gap-2 border-b border-black pb-1 text-sm font-bold uppercase tracking-widest hover:text-accent hover:border-accent transition-colors"
            >
              View All Products
              <span className="transform group-hover:translate-x-1 transition-transform">
                →
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* Categories Section - Moved DOWN */}
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

      {/* Parallax Image Section */}
      <section className="w-full relative lg:h-[500px] md:h-[550px] h-[400px] overflow-hidden">
        <div
          className="absolute inset-0 bg-fixed"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=2000')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-black/50" />
        </div>
        <div className="relative h-full flex flex-col items-center justify-center text-center text-white px-6 max-w-5xl mx-auto">
          <span className="text-accent text-xs md:text-sm font-bold tracking-[0.3em] uppercase mb-4 block">
            Trusted by Industry Leaders
          </span>
          <h2 className="text-4xl md:text-7xl lg:text-8xl font-bold mb-6 tracking-tight leading-[1.1]">
            Excellence in
            <span className="block text-accent mt-2">Every Detail</span>
          </h2>
          <div className="w-24 h-1 bg-accent mx-auto mb-8" />
          <p className="text-base md:text-xl lg:text-2xl font-light max-w-3xl leading-relaxed text-white/90">
            From <strong className="text-white font-semibold">Paradise</strong> to <strong className="text-white font-semibold">Le Meridien</strong>, from <strong className="text-white font-semibold">ITC Kohenur</strong> to <strong className="text-white font-semibold">Ramoji Film City</strong> — Regal equips the finest.
          </p>
        </div>
      </section>

      {/* New Arrivals Section */}
      <section className="py-20 bg-white hover:bg-gray-50 transition-colors duration-700">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 px-2 border-b border-black/10 pb-6">
            <div>
              <span className="text-accent text-xs font-bold tracking-widest uppercase mb-2 block">
                Just In
              </span>
              <h2 className="text-3xl md:text-4xl font-serif text-black">
                New Arrivals
              </h2>
            </div>
            <Link
              href="/catalog?sort=newest"
              className="hidden md:inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest hover:text-accent transition-colors"
            >
              See All New Items
              <span>→</span>
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
            {loading ? (
              // Show skeleton loaders while loading
              Array.from({ length: 4 }).map((_, index) => (
                <ProductCardSkeleton key={`new-arrival-skeleton-${index}`} />
              ))
            ) : newArrivals.length > 0 ? (
              newArrivals.map((product, index) => (
                <ProductCard
                  key={product._id || product.id || `new-arrival-${index}`}
                  product={product}
                />
              ))
            ) : (
              <div className="col-span-full text-center py-8 text-black/60">
                No new arrivals available
              </div>
            )}
          </div>
          <div className="flex justify-center mt-12 md:hidden">
            <Link
              href="/catalog?sort=newest"
              className="inline-flex items-center gap-2 border-b border-black pb-1 text-sm font-bold uppercase tracking-widest hover:text-accent hover:border-accent transition-colors"
            >
              See All New Items
            </Link>
          </div>
        </div>
      </section>

      {/* Brands Section */}
      <section className="my-12 bg-black w-full flex justify-center items-center ">
        <div className="container bg-black  ">
          <Brands />
        </div>
      </section>

      {/* Whom We Serve Section */}
      <section className="bg-white">
        <div className="container mx-auto px-4">
          <WhomWeServe />
        </div>
      </section>

      {/* About Teaser - Redesigned */}
      <section className="py-12 md:py-16 lg:py-20 bg-black text-white relative overflow-hidden">
        {/* Background Pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="container mx-auto px-4 relative z-10">
          {/* Main Content */}
          <div className="text-center mb-6 md:mb-10">
            <div className="text-accent mb-2 md:mb-4">
              <span className="text-4xl md:text-7xl lg:text-8xl font-black tracking-tighter italic">45+</span>
            </div>
            <h2 className="text-2xl md:text-5xl lg:text-6xl font-bold mb-3 md:mb-6 tracking-tight leading-tight">
              Years of <span className="italic font-serif">Unmatched</span>
              <span className="block text-accent mt-1 italic font-serif">Legacy & Trust</span>
            </h2>
            <div className="w-16 md:w-20 h-0.5 md:h-1 bg-accent mx-auto mb-3 md:mb-6" />
            <p className="max-w-3xl mx-auto text-white/80 text-sm md:text-lg lg:text-xl leading-relaxed font-light px-2">
              Regal Brass & Steelware powers hospitality excellence across India. <br className="hidden md:block" />
              <strong className="text-white font-semibold">250+ dedicated professionals.</strong> <strong className="text-white font-semibold">6,000+ premium products.</strong> <br className="hidden md:block" />
              Distributing <strong className="text-white font-semibold italic">Ariane, Pasabahce, Ocean, Hawkins, Prestige</strong> and more.
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3 md:gap-6 max-w-4xl mx-auto mb-6 md:mb-8">
            <div className="text-center p-3 md:p-5 border border-white/10 hover:border-accent transition-colors duration-300">
              <p className="text-xl md:text-3xl font-bold text-accent mb-0.5 md:mb-1 italic">250+</p>
              <p className="text-[9px] md:text-sm uppercase tracking-wider md:tracking-widest text-white/60 font-semibold">Team Members</p>
            </div>
            <div className="text-center p-3 md:p-5 border border-white/10 hover:border-accent transition-colors duration-300">
              <p className="text-xl md:text-3xl font-bold text-accent mb-0.5 md:mb-1 italic">6,000+</p>
              <p className="text-[9px] md:text-sm uppercase tracking-wider md:tracking-widest text-white/60 font-semibold">Products</p>
            </div>
            <div className="text-center p-3 md:p-5 border border-white/10 hover:border-accent transition-colors duration-300">
              <p className="text-xl md:text-3xl font-bold text-accent mb-0.5 md:mb-1 italic">Pan-India</p>
              <p className="text-[9px] md:text-sm uppercase tracking-wider md:tracking-widest text-white/60 font-semibold">Reach</p>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <Link
              href="/about"
              className="inline-block px-6 py-3 md:px-8 md:py-4 border-2 border-accent bg-accent text-black font-bold uppercase tracking-widest hover:bg-transparent hover:text-accent transition-all duration-300 text-[10px] md:text-sm"
            >
              Discover Our Story
            </Link>
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <WhyChooseUs />

      {/* Numbers/Stats Section */}
      <Numbers />

      {/* Visit Us Section */}
      <Locations />

      {/* Contact Us Section */}
      <ContactUs />

      {/* FAQs Section */}
      <FAQs />
    </div>
  );
}
