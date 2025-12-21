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

export default function HomePage() {
  const { products, categories, loading } = useAppContext();
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [newArrivals, setNewArrivals] = useState([]);
  const [mainCategories, setMainCategories] = useState([]);
  const scrollContainerRef = useRef(null);

  // Filter featured products, new arrivals & main categories
  useEffect(() => {
    const featured = products.filter((p) => p.featured).slice(0, 4);
    setFeaturedProducts(featured);

    // Get new arrivals sorted by createdAt (newest first)
    const arrivals = [...products]
      .sort((a, b) => {
        const dateA = new Date(a.createdAt || a.created_at || 0);
        const dateB = new Date(b.createdAt || b.created_at || 0);
        return dateB - dateA;
      })
      .slice(0, 4);
    setNewArrivals(arrivals);

    const mainCats = categories
      .filter((c) => c.level === "department")
    setMainCategories(mainCats);
  }, [products, categories]);

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -320, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 320, behavior: 'smooth' });
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
              <span className="transform group-hover:translate-x-1 transition-transform">→</span>
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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 19L8 12L15 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Right Arrow - Only Desktop */}
          <button
            onClick={scrollRight}
            className="hidden md:flex absolute right-4 top-[60%] -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-white/80 backdrop-blur-sm border border-black/10 items-center justify-center text-black hover:bg-black hover:text-white transition-all duration-300 shadow-lg opacity-0 group-hover/section:opacity-100"
            aria-label="Scroll Right"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 5L16 12L9 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div
            ref={scrollContainerRef}
            className={`flex w-full overflow-x-auto pb-12 gap-6 snap-x snap-mandatory px-4 md:px-12 hide-scrollbar ${mainCategories.length <= 5 ? 'md:justify-center' : ''
              }`}
          >
            {mainCategories.map((cat, i) => (
              <Link
                key={cat._id || cat.id || `category-${i}`}
                href={`/catalog?category=${cat.slug}`}
                className="flex-none snap-center group relative w-[280px] h-[420px] rounded-[100px] border border-black/10 bg-white overflow-hidden hover:border-accent hover:shadow-2xl transition-all duration-500"
              >
                {/* Hover Background Fill */}
                <div className="absolute inset-0 bg-accent scale-y-0 origin-bottom group-hover:scale-y-100 transition-transform duration-500 ease-in-out z-0" />

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
                          className="object-cover group-hover:scale-110 transition-transform duration-700"
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
                    <span className="text-xs font-bold tracking-[0.25em] uppercase text-accent mb-2 group-hover:text-white/80 transition-colors duration-300">
                      Collection
                    </span>
                    <h3 className="text-2xl font-serif text-black group-hover:text-white transition-colors duration-300 mb-6">
                      {cat.name}
                    </h3>

                    {/* Arrow Icon */}
                    <div className="w-10 h-10 rounded-full border border-black/10 flex items-center justify-center group-hover:border-white/40 group-hover:bg-white/20 transition-all duration-300">
                      <svg
                        width="20" height="20" viewBox="0 0 24 24" fill="none"
                        className="text-black group-hover:text-white transform group-hover:-rotate-45 transition-all duration-300"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Parallax Image Section */}
      <section className="w-full relative h-[500px] lg:h-[600px] overflow-hidden">
        <div className="absolute inset-0 bg-fixed" style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=2000')",
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}>
          <div className="absolute inset-0 bg-black/30" />
        </div>
        <div className="relative h-full flex flex-col items-center justify-center text-center text-white p-6">
          <h2 className="text-4xl md:text-6xl font-serif mb-6">Excellence in Service</h2>
          <p className="text-lg md:text-xl font-light max-w-2xl">Providing world-class hospitality solutions for over 4 decades.</p>
        </div>
      </section>

      {/* New Arrivals Section */}
      <section className="py-20 bg-white hover:bg-gray-50 transition-colors duration-700">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 px-2 border-b border-black/10 pb-6">
            <div>
              <span className="text-accent text-xs font-bold tracking-widest uppercase mb-2 block">Just In</span>
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
      <section className="py-20 bg-white border-t border-black/5">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <span className="text-xs text-gray-400 font-bold tracking-[0.3em] uppercase">Trusted Partners</span>
          </div>
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
      <section className="py-24 bg-black text-white relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }} />

        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="text-accent mb-6">
            <span className="text-5xl md:text-7xl font-serif">45+</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-serif mb-8 tracking-tight">
            Years of Excellence
          </h2>
          <div className="w-16 h-1 bg-accent mx-auto mb-8" />
          <p className="mt-4 max-w-3xl mx-auto text-white/70 text-lg leading-relaxed font-light">
            Regal HoReCa has been a prominent manufacturer and distributor in
            the hospitality industry, delivering quality and trust to esteemed
            clients across national and international markets.
          </p>
          <Link
            href="/about"
            className="mt-12 inline-block px-8 py-4 border border-white text-white font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-all duration-300"
          >
            Our Story
          </Link>
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
