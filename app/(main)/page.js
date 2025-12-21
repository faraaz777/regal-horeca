/**
 * Home Page
 *
 * The main landing page of the application.
 * Displays hero slider, categories, and featured products.
 */

"use client";

import { useEffect, useState } from "react";
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
      .filter((c) => c.level === "category")
      .slice(0, 6);
    setMainCategories(mainCats);
  }, [products, categories]);

  return (
    <div>
      {/* Hero Slider Section */}
      <Hero />

      {/* Categories Section */}
      <section className="py-6 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <p className="text-sm text-gray-500 tracking-wide mb-2">
              Browse by Category
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold">
              Curated Excellence
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8">
            {mainCategories.map((cat, i) => (
              <Link
                key={cat._id || cat.id}
                href={`/catalog?category=${cat.slug}`}
                className={`group text-center reveal transform transition-all duration-700`}
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div className="aspect-square overflow-hidden mb-4 border border-black/5 bg-gray-50 rounded-full scale-90 group-hover:scale-100 transition-transform duration-500 hover:border-accent   ">
                  {cat.image ? (
                    <Image
                      src={cat.image}
                      alt={cat.name}
                      width={300}
                      height={300}
                      className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-50" />
                  )}
                </div>
                <h3 className="text-xs font-black uppercase tracking-[0.15em] transition-colors group-hover:text-accent">
                  {cat.name}
                </h3>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products Section */}
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12 tracking-tight">
            Featured Products
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
            {loading ? (
              // Show skeleton loaders while loading
              Array.from({ length: 4 }).map((_, index) => (
                <ProductCardSkeleton key={`skeleton-${index}`} />
              ))
            ) : featuredProducts.length > 0 ? (
              featuredProducts.map((product) => (
                <ProductCard
                  key={product._id || product.id}
                  product={product}
                />
              ))
            ) : (
              <div className="col-span-full text-center py-8 text-black/60">
                No featured products available
              </div>
            )}
          </div>
          <div className="flex justify-center mt-12">
            <Link
              href="/catalog"
              className="px-5 py-2 text-md font-bold text-black border border-black/50 rounded-md hover:bg-accent hover:text-white hover:border-accent transition-colors"
            >
              View All
            </Link>
          </div>
        </div>
      </section>

      {/* Full Width Image Section */}
      <section className="w-full">
        <div className="relative w-full h-[400px] md:h-[400px] lg:h-[500px]">
          <Image
            src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=2000"
            alt="Premium Hospitality"
            fill
            className="object-cover"
            priority={false}
            sizes="100vw"
          />
        </div>
      </section>

      {/* New Arrivals Section */}
      <section className="py-6 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12 tracking-tight">
            New Arrivals
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
            {loading ? (
              // Show skeleton loaders while loading
              Array.from({ length: 4 }).map((_, index) => (
                <ProductCardSkeleton key={`new-arrival-skeleton-${index}`} />
              ))
            ) : newArrivals.length > 0 ? (
              newArrivals.map((product) => (
                <ProductCard
                  key={product._id || product.id}
                  product={product}
                />
              ))
            ) : (
              <div className="col-span-full text-center py-8 text-black/60">
                No new arrivals available
              </div>
            )}
          </div>
          <div className="flex justify-center mt-12">
            <Link
              href="/catalog"
              className="px-5 py-2 text-md font-bold text-black border border-black rounded-md hover:bg-accent hover:text-white hover:border-accent transition-colors"
            >
              View All
            </Link>
          </div>
        </div>
      </section>

      {/* Full Width Image Section */}
      <section className="w-full">
        <div className="relative w-full h-[400px] md:h-[400px] lg:h-[500px]">
          <Image
            src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=2000"
            alt="Premium Hospitality"
            fill
            className="object-cover"
            priority={false}
            sizes="100vw"
          />
        </div>
      </section>

      {/* Brands Section */}
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4">
          <Brands />
        </div>
      </section>

      {/* Whom We Serve Section */}
      <section className=" bg-white">
        <div className="container mx-auto px-4">
          {/* <Brands /> */}
          <WhomWeServe />
        </div>
      </section>
      {/* About Teaser */}
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            45+ Years of Excellence
          </h2>
          <p className="mt-4 max-w-3xl mx-auto text-black/70">
            Regal HoReCa has been a prominent manufacturer and distributor in
            the hospitality industry, delivering quality and trust to esteemed
            clients across national and international markets.
          </p>
          <Link
            href="/about"
            className="mt-6 inline-block text-accent font-semibold hover:text-black transition-colors"
          >
            Learn More About Us
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
