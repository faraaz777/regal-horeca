"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";

const categories = [
  {
    title: "Hotels",
    slug: "hotels",
    image:
      "https://images.unsplash.com/photo-1606490203669-94bd3f0d8b5d?auto=format&fit=crop&w=1600&q=80",
  },
  {
    title: "Restaurants",
    slug: "restaurants",
    image:
      "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Catering",
    slug: "catering",
    image:
      "https://images.unsplash.com/photo-1616627984393-ade1843f0aac?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Gifting",
    slug: "gifting",
    image:
      "https://images.unsplash.com/photo-1606490203669-94bd3f0d8b5d?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Cafes",
    slug: "cafes",
    image:
      "https://images.unsplash.com/photo-1541534401786-f9a9fb3c1cdf?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Bakeries",
    slug: "bakeries",
    image:
      "https://images.unsplash.com/photo-1603808033198-937c4864c1a5?auto=format&fit=crop&w=1200&q=80",
  },
];


export default function OurCategories() {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  // Determine if a card's button should be active (accent colored)
  const isButtonActive = (index) => {
    if (hoveredIndex !== null) {
      // If any card is hovered, only that card's button is active
      return index === hoveredIndex;
    }
    // If no card is hovered, first card is active by default
    return index === 0;
  };

  return (
    <section className="max-w-7xl mx-auto px-4 py-6 ">
      <h2 className="text-center text-2xl md:text-3xl font-semibold mb-8 md:mb-10">
        Whom We Serve
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {categories.map((cat, index) => (
          <Link
            key={cat.slug}
            href={`/whom-we-serve/${cat.slug}`}
            className="group relative"
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {/* Card Container */}
            <div className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden">
              {/* Image with grayscale filter */}
              <Image
                src={cat.image}
                alt={cat.title}
                fill
                sizes="(min-width:1024px) 16vw, (min-width:640px) 33vw, 50vw"
                className="object-cover grayscale group-hover:grayscale-0 transition-all duration-500 ease-out group-hover:scale-105"
              />

              {/* Dark overlay */}
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-300" />

              {/* Title at bottom left */}
              <div className="absolute bottom-4 left-4 right-4">
                <h3 className="text-white text-sm md:text-base font-medium leading-tight">
                  {cat.title}
                </h3>
              </div>
            </div>

            {/* Arrow Button - positioned at bottom right, overlapping the card */}
            <div 
              className={`absolute -bottom-3 -right-1 w-10 h-10 rounded-full flex items-center justify-center 
                transition-all duration-300 shadow-lg text-white
                ${hoveredIndex === index ? 'scale-110' : ''}
                ${isButtonActive(index) ? 'bg-accent' : 'bg-[#3D2314]'}`}
            >
              <ArrowUpRight size={18} strokeWidth={2.5} />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
