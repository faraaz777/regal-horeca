import Link from "next/link";
import Image from "next/image";

const categories = [
  {
    title: "Crockery",
    slug: "crockery",
    image:
      "https://images.unsplash.com/photo-1606490203669-94bd3f0d8b5d?auto=format&fit=crop&w=1600&q=80",
    layout: "md:col-span-2 md:row-span-2 md:col-start-1 md:row-start-1",
  },
  {
    title: "Cutlery",
    slug: "cutlery",
    image:
      "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1200&q=80",
    layout: "md:col-span-1 md:row-span-1 md:col-start-3 md:row-start-1",
  },
  {
    title: "Glassware",
    slug: "glassware",
    image:
      "https://images.unsplash.com/photo-1541534401786-f9a9fb3c1cdf?auto=format&fit=crop&w=1200&q=80",
    layout: "md:col-span-1 md:row-span-1 md:col-start-3 md:row-start-2",
  },
  {
    title: "Barware",
    slug: "barware",
    image:
      "https://images.unsplash.com/photo-1532635227-44b3e003b2a7?auto=format&fit=crop&w=1200&q=80",
    layout: "md:col-span-1 md:row-span-1 md:col-start-1 md:row-start-3",
  },
  {
    title: "Wooden Accessories",
    slug: "wooden-accessories",
    image:
      "https://images.unsplash.com/photo-1603808033198-937c4864c1a5?auto=format&fit=crop&w=1200&q=80",
    layout: "md:col-span-1 md:row-span-1 md:col-start-2 md:row-start-3",
  },
  {
    title: "Metalware",
    slug: "metalware",
    image:
      "https://images.unsplash.com/photo-1616627984393-ade1843f0aac?auto=format&fit=crop&w=1200&q=80",
    layout: "md:col-span-1 md:row-span-1 md:col-start-3 md:row-start-3",
  },
];

export default function OurCategories() {
  return (
    <section className="max-w-7xl mx-auto px-4 py-12 md:py-16">
      <h2 className="text-center text-2xl md:text-3xl font-semibold mb-8 md:mb-10">
        Whom We Serve
      </h2>

      {/* 
        - 1 col on mobile
        - 2 cols on small screens
        - 3 cols + masonry layout on md+
      */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 auto-rows-[220px] md:auto-rows-[160px] lg:auto-rows-[250px]">
        {categories.map((cat) => (
          <Link
            key={cat.slug}
            href={`/enquiry?category=${cat.title}`}
            className={`relative group overflow-hidden transform-gpu w-full h-full ${cat.layout}
              shadow-sm hover:shadow-2xl hover:shadow-black/25
              transition-all duration-700 ease-out
            `}
          >
            {/* parent needs height for Image fill → auto-rows + min-h on mobile */}
            <div className="relative w-full h-full min-h-[220px] md:min-h-0">
              <Image
                src={cat.image}
                alt={cat.title}
                fill
                sizes="(min-width:1024px) 33vw, (min-width:768px) 50vw, 100vw"
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />

              {/* Overlay */}
              <div className="absolute inset-0 bg-black/25 group-hover:bg-black/40 transition-colors duration-700 ease-out" />

              {/* Centered title */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-white text-base sm:text-lg md:text-xl font-medium drop-shadow-md tracking-wide transition-transform duration-700 ease-out translate-y-0.5 group-hover:translate-y-0 group-hover:scale-[1.02]">
                  {cat.title}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
