"use client";
import ariane from "../lib/ariane.png"
import bybone from "../lib/bybone.png"
import ocean from "../lib/ocean.png"
import Image from "next/image";

export default function Brands({ speed = 30000 }) {
  const images = [
    // { id: 1, image: "https://i.imgur.com/n7UQdsOUh.jpg" },
    // { id: 2, image: "https://i.imgur.com/0Z8FdsQZC.jpg" },
    // { id: 3, image: "https://i.imgur.com/TKZQyds2x.jpg" },
    // { id: 4, image: "https://i.imgur.com/D93ZdsQ8K.jpg" },
    // { id: 5, image: "https://i.imgur.com/8DqO4dsfsddsD.jpg" },
    // { id: 6, image: "https://i.imgur.com/xuFqNdsRS.jpg" },
    { id: 1, image: ariane },
    { id: 2, image: bybone },
    { id: 3, image: ocean },
    { id: 4, image: ariane },
    { id: 5, image: ariane },
    { id: 6, image: ariane },
    { id: 7, image: ariane },
  ];

  return (
    <div className="">
      <h1 className="text-center text-2xl md:text-4xl font-semibold mb-6 md:mb-12 ">
        Brands 
      </h1>

      <div className="relative w-full overflow-hidden h-28 sm:h-32 md:h-40 my-8">
        <div className="absolute flex">
          {[1, 2, 3, 4].map((n) => (
            <section
              key={n}
              style={{ "--speed": `${speed}ms` }}
              className="flex animate-marquee"
            >
              {images.map(({ id, image, alt }) => (
                <div
                  key={id}
                  className="
                    flex items-center justify-center 
                    w-24 h-24 
                    sm:w-28 sm:h-28 
                    md:w-40 md:h-40
                  "
                >
                  <Image
                    src={image}
                    alt={alt || `Brand ${id}`}
                    className="
                       object-fill 
                      w-20 h-20
                      sm:w-24 sm:h-24
                      md:w-36 md:h-36
                    "
                  />
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

