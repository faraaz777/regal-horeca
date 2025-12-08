/**
 * Product Card Skeleton Component
 * 
 * Loading skeleton that matches the ProductCard layout
 * for a smooth loading experience.
 */

export default function ProductCardSkeleton() {
  return (
    <article className="group relative h-full w-full">
      <div className="relative flex h-full w-full flex-col rounded-2xl border bg-white border-gray-200 overflow-hidden shadow-sm animate-pulse">
        {/* IMAGE SECTION SKELETON */}
        <div className="relative w-full aspect-[4/3] bg-slate-100">
          <div className="absolute inset-0 p-3 sm:p-4">
            <div className="relative w-full h-full bg-gray-200 rounded"></div>
          </div>
          
          {/* Badge skeleton */}
          <div className="absolute top-2 sm:top-3 left-2 sm:left-3">
            <div className="h-5 w-24 bg-gray-200 rounded-full"></div>
          </div>

          {/* Wishlist button skeleton */}
          <div className="absolute top-2 sm:top-3 right-2 sm:right-3">
            <div className="w-9 h-9 bg-gray-200 rounded-full"></div>
          </div>
        </div>

        {/* CONTENT SECTION SKELETON */}
        <div className="flex flex-1 flex-col justify-between p-3 sm:p-4 md:p-5 gap-2">
          <div className="space-y-2">
            {/* Brand + SKU skeleton */}
            <div className="flex items-center justify-between gap-2">
              <div className="h-3 w-20 bg-gray-200 rounded"></div>
              <div className="h-3 w-12 bg-gray-200 rounded"></div>
            </div>

            {/* Title skeleton */}
            <div className="space-y-2 mt-0.5">
              <div className="h-4 w-full bg-gray-200 rounded"></div>
              <div className="h-4 w-3/4 bg-gray-200 rounded"></div>
            </div>

            {/* Sub-info skeleton */}
            <div className="mt-1 space-y-1">
              <div className="h-3 w-full bg-gray-100 rounded"></div>
              <div className="h-3 w-2/3 bg-gray-100 rounded"></div>
            </div>
          </div>

          {/* Price + CTA skeleton */}
          <div className="mt-2 flex items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="h-5 w-24 bg-gray-200 rounded"></div>
              <div className="h-3 w-16 bg-gray-100 rounded"></div>
            </div>

            <div className="h-7 w-24 bg-gray-200 rounded-full"></div>
          </div>
        </div>
      </div>
    </article>
  );
}

