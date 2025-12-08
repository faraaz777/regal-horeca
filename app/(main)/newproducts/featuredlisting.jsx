"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { ProductCard } from "./newlisting";

import products from "@/data/products"; // Filter or update based on your featured logic

export default function FeaturedProducts() {
  const { addItem } = useCart();
  const scrollRef = useRef(null);
  const router = useRouter();

  const scrollLeft = () => {
    scrollRef.current.scrollBy({ left: -500, behavior: "smooth" });
  };

  const scrollRight = () => {
    scrollRef.current.scrollBy({ left: 500, behavior: "smooth" });
  };

  // 👉 If you want only selected featured products:
  // const featured = products.filter((product) => product.featured === true);

  return (
    <section className="w-full px-4 md:px-10 py-12">
      {/* Heading */}
      <p className="text-center text-sm text-gray-500 tracking-wide">
        HANDPICKED FOR YOU
      </p>
      <h2 className="text-center text-3xl md:text-4xl font-semibold mb-12">
        Featured Products
      </h2>

      <div className="relative">
        {/* Left Arrow */}
        <button
          onClick={scrollLeft}
          className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-20
          w-10 h-10 items-center justify-center rounded-full bg-white shadow hover:bg-gray-100"
        >
          ←
        </button>

        {/* Product Scroller */}
        <div
          ref={scrollRef}
          className="flex gap-8 overflow-x-auto scrollbar-hide pb-4 mt-20 snap-x snap-mandatory"
        >
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAdd={(prod) => addItem(prod, 1)}
            />
          ))}
        </div>

        {/* Right Arrow */}
        <button
          onClick={scrollRight}
          className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-20
          w-10 h-10 items-center justify-center rounded-full bg-white shadow hover:bg-gray-100"
        >
          →
        </button>
      </div>

      {/* View All Button */}
      <div className="flex justify-center mt-10">
        <button
          onClick={() => router.push("/products")}
          className="px-6 py-2 bg-black text-white rounded hover:bg-gray-800"
        >
          View all
        </button>
      </div>
    </section>
  );
}
