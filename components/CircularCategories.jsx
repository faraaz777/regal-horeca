'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function CircularCategories({ categories }) {
  // Filter categories (level === "category") - not departments
  const categoryList = categories?.filter((c) => c.level === "category") || [];

  // Sort categories: tableware first, then alphabetically
  const sortedCategories = [...categoryList].sort((a, b) => {
    const nameA = (a.name || '').toLowerCase();
    const nameB = (b.name || '').toLowerCase();
    
    // Check if either is "tableware"
    const isTablewareA = nameA.includes('tableware');
    const isTablewareB = nameB.includes('tableware');
    
    // If one is tableware, it comes first
    if (isTablewareA && !isTablewareB) return -1;
    if (!isTablewareA && isTablewareB) return 1;
    
    // Otherwise sort alphabetically
    return nameA.localeCompare(nameB);
  });

  // Limit to first 12 categories for better display
  const displayCategories = sortedCategories.slice(0, 12);

  if (displayCategories.length === 0) {
    return null;
  }

  return (
    <section className=" md:py-4 bg-white border-b border-black/5">
      <div className="container mx-auto px-4 ">
        <div className="flex py-4 overflow-x-auto hide-scrollbar gap-4 sm:gap-5 md:gap-6 lg:gap-8 pb-4 snap-x snap-mandatory">
          {displayCategories.map((cat, index) => {
            const categoryId = cat._id || cat.id || `category-${index}`;
            const categorySlug = cat.slug || categoryId?.toString();

            return (
              <Link
                key={categoryId}
                href={`/catalog?category=${categorySlug}`}
                className="group flex flex-col items-center gap-2 transition-all duration-300 hover:-translate-y-1 flex-shrink-0 snap-center"
              >
                {/* Circular Category Container - Smaller sizes */}
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 lg:w-28 lg:h-28 rounded-full border-2 border-black/10 group-hover:border-accent transition-all duration-300 overflow-hidden bg-white shadow-sm group-hover:shadow-md group-hover:border-[3px]">
                  {cat.image ? (
                    <Image
                      src={cat.image}
                      alt={cat.name}
                      fill
                      sizes="(max-width: 640px) 64px, (max-width: 768px) 80px, (max-width: 1024px) 96px, 112px"
                      className="object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 text-gray-500 text-sm sm:text-base md:text-lg font-bold">
                      {cat.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                
                {/* Category Name - Smaller text */}
                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-black group-hover:text-accent transition-colors duration-300 text-center max-w-[70px] sm:max-w-[80px] md:max-w-[100px] line-clamp-2">
                  {cat.name}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

