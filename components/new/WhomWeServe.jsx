import Link from "next/link";
import Image from "next/image";

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
  return (
    <section className="max-w-7xl mx-auto px-4 py-12 md:py-16">
      <h2 className="text-center text-2xl md:text-3xl font-semibold mb-8 md:mb-10">
        Whom We Serve
      </h2>

      <div className="flex flex-col gap-4 lg:gap-6">
        {/* First row: 4 cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {categories.slice(0, 4).map((cat) => (
          <Link
            key={cat.slug}
            href={`/enquiry?category=${cat.title}`}
              className="relative group overflow-hidden transform-gpu w-full h-[400px] sm:h-[350px] lg:h-[450px]
                shadow-sm hover:shadow-xl hover:shadow-black/20
                transition-all duration-300 ease-out
              "
          >
              <div className="relative w-full h-full">
              <Image
                src={cat.image}
                alt={cat.title}
                fill
                  sizes="(min-width:1024px) 25vw, (min-width:640px) 50vw, 100vw"
                  className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
              />

              {/* Overlay */}
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors duration-300 ease-out" />

                {/* Title and button at bottom-left */}
                <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col items-start gap-3">
                  <h3 className="text-white text-xl md:text-2xl font-semibold drop-shadow-lg">
                  {cat.title}
                  </h3>
                  <button className="px-6 py-2 border border-white text-white text-sm md:text-base font-medium
                    hover:bg-white hover:text-black transition-all duration-300 ease-out
                    backdrop-blur-sm bg-white/10
                  ">
                    Learn More
                  </button>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Second row: 2 cards centered */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {/* Empty column on left for centering on large screens */}
          <div className="hidden lg:block"></div>
          {categories.slice(4, 6).map((cat) => (
            <Link
              key={cat.slug}
              href={`/enquiry?category=${cat.title}`}
              className="relative group overflow-hidden transform-gpu w-full h-[400px] sm:h-[350px] lg:h-[450px]
                shadow-sm hover:shadow-xl hover:shadow-black/20
                transition-all duration-300 ease-out
              "
            >
              <div className="relative w-full h-full">
                <Image
                  src={cat.image}
                  alt={cat.title}
                  fill
                  sizes="(min-width:1024px) calc(25vw - 1.5rem), (min-width:640px) calc(50vw - 2rem), 100vw"
                  className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                />

                {/* Overlay */}
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors duration-300 ease-out" />

                {/* Title and button at bottom-left */}
                <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col items-start gap-3">
                  <h3 className="text-white text-xl md:text-2xl font-semibold drop-shadow-lg">
                    {cat.title}
                  </h3>
                  <button className="px-6 py-2 border border-white text-white text-sm md:text-base font-medium
                    hover:bg-white hover:text-black transition-all duration-300 ease-out
                    backdrop-blur-sm bg-white/10
                  ">
                    Learn More
                  </button>
              </div>
            </div>
          </Link>
        ))}
          {/* Empty column on right for centering on large screens */}
          <div className="hidden lg:block"></div>
        </div>
      </div>
    </section>
  );
}
