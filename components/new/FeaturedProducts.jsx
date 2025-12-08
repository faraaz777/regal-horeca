"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAppContext } from "@/context/AppContext";
import Image from "next/image";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { HeartIcon } from "../Icons";

/* ---------------------------------------------------
   SECTION HEADER
--------------------------------------------------- */
function SectionHeader({ title, subtitle }) {
  return (
    <>
      <p className="text-center text-sm text-gray-500 tracking-wide">{subtitle}</p>
      <h2 className="text-center text-3xl md:text-4xl font-semibold mb-12">{title}</h2>
    </>
  );
}

/* ---------------------------------------------------
   SKELETON LOADER
--------------------------------------------------- */
function ProductCardSkeleton() {
  return (
    <div className="min-w-[300px] snap-start">
      <div className="relative w-[300px] h-[350px] bg-gray-200 rounded-xl overflow-hidden animate-pulse" />
      <div className="mt-3 space-y-2">
        <div className="h-4 w-20 bg-gray-200 rounded mx-auto animate-pulse" />
        <div className="h-5 w-48 bg-gray-200 rounded mx-auto animate-pulse" />
      </div>
    </div>
  );
}

/* ---------------------------------------------------
   PRODUCT CARD (heroImage + gallery support)
--------------------------------------------------- */
function ProductCard({ product }) {
  const { addToWishlist, removeFromWishlist, isInWishlist } = useAppContext();

  const productId = product._id || product.id;
  const wished = isInWishlist(productId);

  // Collect product images
  const images = [
    product.heroImage,
    ...(product.gallery || []),
  ].filter(Boolean);

  const [index, setIndex] = useState(0);

  const nextImg = () => setIndex((i) => (i === images.length - 1 ? 0 : i + 1));
  const prevImg = () => setIndex((i) => (i === 0 ? images.length - 1 : i - 1));

  return (
    <Link href={`/products/${product.slug}`} className="min-w-[300px] snap-start block">
      <div className="relative w-[300px] h-[350px] bg-white rounded-xl shadow overflow-hidden group">

        {/* MAIN IMAGE */}
        <Image
          src={images[index] || "/placeholder.png"}
          width={350}
          height={350}
          alt={product.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* ARROWS */}
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => { e.preventDefault(); prevImg(); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100
              bg-white shadow-lg rounded-full p-2 transition hover:scale-110"
            >
              <ArrowLeft size={18} />
            </button>

            <button
              onClick={(e) => { e.preventDefault(); nextImg(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100
              bg-white shadow-lg rounded-full p-2 transition hover:scale-110"
            >
              <ArrowRight size={18} />
            </button>
          </>
        )}

        {/* WISHLIST */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            wished ? removeFromWishlist(productId) : addToWishlist(productId);
          }}
          className="absolute top-3 right-3 bg-white/90 backdrop-blur shadow 
                     rounded-full p-2 hover:scale-110 transition z-10"
        >
          <HeartIcon isFilled={wished} className={`w-6 h-6 ${wished ? "text-red-500" : ""}`} />
        </button>

      </div>

      <p className="text-center text-sm text-gray-500 mt-3">{product.brand}</p>
      <h3 className="text-center text-[17px] font-medium">{product.title}</h3>
    </Link>
  );
}

/* ---------------------------------------------------
   SLIDER ARROWS
--------------------------------------------------- */
function SliderArrow({ side, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`hidden md:flex absolute top-1/2 -translate-y-1/2 z-30
         w-12 h-12 bg-white rounded-full shadow hover:bg-gray-100 hover:scale-110 
         items-center justify-center ${side === "left" ? "left-2" : "right-2"}`}
    >
      {side === "left" ? "←" : "→"}
    </button>
  );
}

/* ---------------------------------------------------
   ⭐ FEATURED PRODUCTS (DEFAULT EXPORT)
--------------------------------------------------- */
export default function FeaturedProducts({ limit = null }) {
  const { products, loading } = useAppContext();
  const router = useRouter();
  const scrollRef = useRef(null);

  let featured = products.filter((p) => p.featured === true);
  if (limit) featured = featured.slice(0, limit);

  const scrollLeft = () => scrollRef.current?.scrollBy({ left: -400, behavior: "smooth" });
  const scrollRight = () => scrollRef.current?.scrollBy({ left: 400, behavior: "smooth" });

  return (
    <section className="w-full px-4 md:px-10 py-16">
      <SectionHeader title="Featured Products" subtitle="HANDPICKED FOR YOU" />

      <div className="relative mt-10">
        {!loading && featured.length > 0 && (
          <>
            <SliderArrow side="left" onClick={scrollLeft} />
            <SliderArrow side="right" onClick={scrollRight} />
          </>
        )}

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-6 hide-scrollbar"
        >
          {loading
            ? Array.from({ length: limit || 6 }).map((_, i) => <ProductCardSkeleton key={i} />)
            : featured.length > 0
            ? featured.map((p) => <ProductCard key={p._id} product={p} />)
            : <div className="w-full text-center py-12 text-gray-500">No featured products available</div>}
        </div>
      </div>

      <div className="flex justify-center mt-10">
        <button
          onClick={() => router.push("/catalog")}
          className="px-6 py-2 bg-black text-white rounded hover:bg-gray-800"
        >
          View all
        </button>
      </div>
    </section>
  );
}

/* ---------------------------------------------------
   ⭐ NEW ARRIVALS (NAMED EXPORT)
--------------------------------------------------- */
export function NewArrivals({ limit = 8 }) {
  const { products, loading } = useAppContext();
  const router = useRouter();
  const scrollRef = useRef(null);

  let newArrivals = [...products].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  newArrivals = newArrivals.slice(0, limit);

  const scrollLeft = () => scrollRef.current?.scrollBy({ left: -400, behavior: "smooth" });
  const scrollRight = () => scrollRef.current?.scrollBy({ left: 400, behavior: "smooth" });

  return (
    <section className="w-full px-4 md:px-10 py-16">
      <SectionHeader title="New Arrivals" subtitle="JUST ARRIVED" />

      <div className="relative mt-10">
        {!loading && newArrivals.length > 0 && (
          <>
            <SliderArrow side="left" onClick={scrollLeft} />
            <SliderArrow side="right" onClick={scrollRight} />
          </>
        )}

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-6 hide-scrollbar"
        >
          {loading
            ? Array.from({ length: limit }).map((_, i) => <ProductCardSkeleton key={i} />)
            : newArrivals.length > 0
            ? newArrivals.map((p) => <ProductCard key={p._id} product={p} />)
            : <div className="w-full text-center py-12 text-gray-500">No new arrivals</div>}
        </div>
      </div>

      <div className="flex justify-center mt-10">
        <button
          onClick={() => router.push("/catalog")}
          className="px-6 py-2 bg-black text-white rounded hover:bg-gray-800"
        >
          View all
        </button>
      </div>
    </section>
  );
}
