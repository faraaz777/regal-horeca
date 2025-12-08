"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight  , ArrowLeft , Handbag } from "lucide-react";
import {  useCart } from "@/context/CartContext";

import products from "@/data/products";

export default function BestLovedCreations() {
  const { addItem } = useCart();

  const scrollRef = useRef(null);
  const router = useRouter();

  const scrollLeft = () => {
    scrollRef.current.scrollBy({ left: -500, behavior: "smooth" });
  };

  const scrollRight = () => {
    scrollRef.current.scrollBy({ left: 500, behavior: "smooth" });
  };

  return (
    <section className="w-full px-4 md:px-10 py-12">
      {/* Heading */}
      <p className="text-center text-sm text-gray-500 tracking-wide">
        DON’T MISS OUT ON OUR COMMUNITY FAVORITES
      </p>
      <h2 className="text-center text-3xl md:text-4xl font-semibold mb-12">
        New Best-Selling Products
      </h2>

      <div className="relative ">
        {/* Left arrow */}
        <button
          onClick={scrollLeft}
          className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-20
          w-10 h-10 items-center justify-center rounded-full bg-white shadow-lg hover:bg-gray-100"
        >
          <ArrowLeft size={18} />
        </button>

        {/* Scroll section */}
        <div
          ref={scrollRef}
          className="flex gap-8 overflow-x-auto scrollbar-hide pb-4 mt-20 snap-x snap-mandatory hover"
        >
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAdd={(prod) => addItem(prod, 1)}
            />
          ))}
        </div>

        {/* Right arrow */}
        <button
          onClick={scrollRight}
          className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-20
          w-10 h-10 items-center justify-center rounded-full bg-white shadow hover:bg-gray-100"
        >
          <ArrowRight size={18} />  
        </button>
      </div>

      {/* View all */}
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

/* -------------------------
   PRODUCT CARD (Hover slider)
-------------------------- */
function ProductCard({ product, onAdd }) {
  const [index, setIndex] = useState(0);
  
  
  const nextImg = () => {
    console.log(product.images.length);
    setIndex((prev) => (prev === product.images.length - 1 ? 0 : prev + 1));
  };
  
  const prevImg = () => {
    console.log(product.images.length);
    setIndex((prev) => (prev === 0 ? product.images.length - 1 : prev - 1));
  };

  return (
    <div className="min-w-[330px] snap-start">
      <div className="relative w-[330px] h-[330px] rounded-lg overflow-hidden shadow group">
        {/* Product Image */}
        <Image
          src={product.images[index]}
          width={330}
          height={330}
          alt={product.name}
          className="w-full h-full object-cover transition-all duration-300"
        />

        {/* Hover arrows */}
        <button
          onClick={prevImg}
          className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100
            bg-white shadow rounded-full p-1"
        >
          <ArrowLeft size={18} />
        </button>

        <button
          onClick={nextImg}
          className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100
            bg-white shadow rounded-full p-1"
        >
          <ArrowRight size={18} />
        </button>

        {/* ⭐ BOTTOM-RIGHT ADD TO CART BUTTON */}
        <button
          onClick={() => onAdd(product)}
          className="absolute bottom-3 right-3 flex items-center justify-center w-9 h-9 rounded-full bg-slate-600 text-white shadow transform transition duration-300 ease-out opacity-0 scale-70 pointer-events-none group-hover:opacity-100 group-hover:scale-105 group-hover:pointer-events-auto hover:bg-gray-800  "
        >
          <Handbag size={18}  />
        </button>
      </div>

      {/* Bottom text */}
      <p className="text-center text-sm text-gray-500 mt-2">
        Popup Stone Ceramics
      </p>

      <h3 className="text-center text-[16px] mt-1">{product.name}</h3>
    </div>
  );
}

export { ProductCard };
