"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import hotel from "./hotel.webp"
import restaurant from "./restaurant.webp"
import cafes from "./cafes.webp"
import bakeries from "./bakeries.webp"
  import catering from "./image-2.webp"
import banquets from "./banquets.webp"

const categories = [

  {
    title: "Restaurants",
    slug: "restaurants",
    image:restaurant,
  },
  {
    title: "Catering",
    slug: "catering",
    image:catering,
  },
  {
    title: "Banquets",
    slug: "banquets",
    image:banquets,
  },
  {
    title: "Cafes",
    slug: "cafes",
    image:cafes,
  },
  {
    title: "Bakeries",
    slug: "bakeries",
    image:bakeries,
  },
  {
    title: "Hotels",
    slug: "hotels",
    image:hotel,
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
    <section className="max-w-7xl mx-auto px-4  pb-20 ">
      <h2 className="text-center text-3xl md:text-4xl font-serif ">Whom We Serve</h2>
           <p className="text-center text-sm text-gray-500 tracking-wide mb-12"> We serve a wide range of businesses in the hospitality industry </p>
 

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {categories.map((cat, index) => (
          <Link
            key={cat.slug}
            href={`/whom-we-serve/${cat.slug}`}
            className="group relative flex flex-col"
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {/* Card Container with Arrow Wrapper */}
            <div className="relative">
              <div className="relative w-full aspect-[6/10] rounded-2xl overflow-hidden">
                {/* Image */}
                <Image
                  src={cat.image}
                  alt={cat.title}
                  fill
                  sizes="(min-width:1024px) 16vw, (min-width:640px) 33vw, 50vw"
                  className="object-cover transition-all duration-500 ease-out group-hover:scale-105"
                />
              </div>

              {/* Arrow Button - positioned at bottom right of image, overlapping the card */}
              <div 
                className={`absolute -bottom-3 -right-1 w-10 h-10 rounded-full flex items-center justify-center 
                  transition-all duration-300 shadow-lg text-white z-20
                  ${hoveredIndex === index ? 'scale-110' : ''}
                  ${isButtonActive(index) ? 'bg-accent' : 'bg-[#3D2314]'}`}
              >
                <ArrowUpRight size={18} strokeWidth={2.5} />
              </div>
            </div>

            {/* Title below image, centered */}
            <h3 className="text-center text-black text-sm md:text-base font-medium leading-tight mt-3">
              {cat.title}
            </h3>
          </Link>
        ))}
      </div>
    </section>
  );
}
