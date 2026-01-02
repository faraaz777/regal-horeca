/**
 * Home Page
 *
 * The main landing page of the application.
 * Displays hero slider, categories, and featured products.
 */

import Link from "next/link";
import { headers } from "next/headers";
import ProductCard from "@/components/ProductCard";
import WhomWeServe from "@/components/new/WhomWeServe";
import Brands from "@/components/Brands";
import ContactUs from "@/components/ContactUs";
import FAQs from "@/app/(main)/faqs/FAQs";
import Hero from "@/components/Hero";
import Numbers from "@/components/Numbers";
import WhyChooseUs from "@/components/WhyChooseUs";
import Locations from "@/components/about/Locations";
import CategoriesSection from "@/components/CategoriesSection";
import CircularCategories from "@/components/CircularCategories";
import { flattenCategories } from "@/lib/utils/categoryUtils";

// Metadata for SEO
export const metadata = {
  title: 'Regal HoReCa - Premium Hospitality Supplies | Hotel, Restaurant & Café Equipment',
  description: 'Discover premium hospitality supplies from Regal HoReCa. Quality tableware, kitchenware, and equipment for hotels, restaurants, and cafés. Over 45 years of excellence.',
  keywords: 'hospitality supplies, hotel equipment, restaurant supplies, HoReCa, commercial kitchen equipment, tableware, kitchenware',
};

// Enable ISR (Incremental Static Regeneration) - revalidate every 5 minutes
// This allows the page to be statically generated and cached, then revalidated periodically
export const revalidate = 300;

export default async function HomePage() {
  // Fetch data server-side in parallel
  let featuredProducts = [];
  let newArrivals = [];
  let categories = [];

  try {
    // Get base URL from headers or environment variable
    const headersList = headers();
    const host = headersList.get('host') || 'localhost:3000';
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

    const [featuredResponse, arrivalsResponse, categoriesResponse] = await Promise.all([
      fetch(`${baseUrl}/api/products?featured=true&limit=4`, {
        cache: 'force-cache',
        next: { revalidate: 300 } // Cache for 5 minutes
      }).catch(() => null),
      fetch(`${baseUrl}/api/products?limit=4`, {
        cache: 'force-cache',
        next: { revalidate: 300 } // Cache for 5 minutes
      }).catch(() => null),
      fetch(`${baseUrl}/api/categories?tree=true`, {
        cache: 'force-cache',
        next: { revalidate: 3600 } // Cache for 1 hour
      }).catch(() => null)
    ]);

    // Parse responses - only if responses are valid
    const [featuredData, arrivalsData, categoriesData] = await Promise.all([
      featuredResponse ? featuredResponse.json().catch(() => ({ success: false })) : Promise.resolve({ success: false }),
      arrivalsResponse ? arrivalsResponse.json().catch(() => ({ success: false })) : Promise.resolve({ success: false }),
      categoriesResponse ? categoriesResponse.json().catch(() => ({ success: false })) : Promise.resolve({ success: false })
    ]);

    // Extract data with error handling
    if (featuredData?.success) {
      featuredProducts = featuredData.products || [];
    }

    if (arrivalsData?.success) {
      newArrivals = arrivalsData.products || [];
    }

    if (categoriesData?.success) {
      // Flatten the category tree structure
      const flattenedCategories = flattenCategories(categoriesData.categories || []);
      categories = flattenedCategories;
    }
  } catch (error) {
    console.error('Error fetching homepage data:', error);
    // Continue with empty arrays - page will still render
  }

  return (
    <div>
      {/* Hero Slider Section */}
      <Hero />

      {/* Circular Categories Section */}
      <CircularCategories categories={categories} />

      {/* Featured Products Section */}
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
            {featuredProducts.length > 0 ? (
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

      {/* Categories Section - Client Component */}
      <CategoriesSection categories={categories} />

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
          <span className="text-white text-xs md:text-sm font-bold tracking-[0.3em] uppercase mb-4 block">
            Trusted by Industry Leaders
          </span>
          <h2 className="text-4xl md:text-7xl lg:text-8xl font-bold mb-6 tracking-tight leading-[1.1]">
            Excellence in
            <span className="block text-accent mt-2">Every Detail</span>
          </h2>
          <div className="w-24 h-1 bg-accent mx-auto mb-8" />
          <p className="text-base md:text-xl lg:text-2xl font-light max-w-3xl leading-relaxed text-white/90">
  Trusted by leading hospitality spaces across regions <br />— Regal equips the finest.
</p>

        </div>
      </section>

      {/* New Arrivals Section */}
      <section className="py-6 bg-white hover:bg-gray-50 transition-colors duration-700">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 px-2 border-b border-black/10 pb-6">
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
            {newArrivals.length > 0 ? (
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
