'use client';

import Image from 'next/image';
import { CheckCircle2, Package } from 'lucide-react';

const blurDataURL =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q==';

/**
 * Single compact strip: product on the left, opening / allocated / remaining on the right.
 * Title wraps after the first "|" so long names stay readable without growing the pill much.
 */
export default function ProductAllocateHeader({
  product,
  openingQty,
  onOpeningChange,
  openingQtyNum,
  allocatedTotal,
  remaining,
  poolReady,
  isFullyAllocated,
  stockUnit,
  onChangeProduct,
  onHand,
}) {
  const progressPct =
    poolReady && openingQtyNum > 0
      ? Math.min(100, Math.round((allocatedTotal / openingQtyNum) * 100))
      : 0;

  const meta = product
    ? [product.sku && `SKU ${product.sku}`, product.brand].filter(Boolean).join(' · ')
    : '';

  const rawTitle = product?.title || '';
  const pipeIdx = rawTitle.indexOf('|');
  const titleLine1 =
    pipeIdx >= 0 ? rawTitle.slice(0, pipeIdx).trimEnd() : rawTitle;
  const titleLine2 =
    pipeIdx >= 0 ? rawTitle.slice(pipeIdx + 1).trimStart() : '';

  return (
    <section className="bg-white rounded-lg border border-gray-200 px-3 py-2.5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
        {product?.title ? (
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="relative h-14 w-14 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
              {product.heroImage ? (
                <Image
                  src={product.heroImage}
                  alt={product.title}
                  fill
                  sizes="56px"
                  unoptimized
                  className="object-cover"
                  placeholder="blur"
                  blurDataURL={blurDataURL}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300">
                  <Package size={22} />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-gray-900 leading-snug">
                <span className="block truncate">{titleLine1}</span>
                {titleLine2 ? (
                  <span className="block truncate text-gray-800 font-semibold">
                    {titleLine2}
                  </span>
                ) : null}
              </h3>
              <p className="text-[11px] text-gray-500 truncate mt-0.5">
                {meta}
                {onHand != null && Number(onHand) > 0 ? (
                  <span className="text-emerald-700 font-medium">
                    {meta ? ' · ' : ''}
                    {onHand} on hand
                  </span>
                ) : null}
                {onChangeProduct ? (
                  <>
                    {meta || (onHand != null && Number(onHand) > 0) ? ' · ' : ''}
                    <button
                      type="button"
                      onClick={onChangeProduct}
                      className="font-semibold text-accent hover:underline"
                    >
                      Change
                    </button>
                  </>
                ) : null}
              </p>
            </div>
          </div>
        ) : null}

        <div className="shrink-0 w-[19.5rem] space-y-1.5">
          <div className="grid grid-cols-3 gap-px rounded-md overflow-hidden border border-gray-200 bg-gray-200">
            <label className="bg-red-600 px-1 py-1 flex flex-col items-center cursor-text min-w-0">
              <p className="text-[8px] font-bold uppercase tracking-wide text-red-100 leading-none">
                Opening
              </p>
              <input
                type="number"
                min="1"
                className="mt-0.5 w-8 px-0 py-0 text-sm font-bold tabular-nums text-center bg-transparent text-white border-0 border-b-2 border-white/80 focus:outline-none focus:border-white placeholder:text-white/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={openingQty}
                onChange={(e) => onOpeningChange(e.target.value)}
                placeholder="0"
              />
              <p className="text-[8px] text-red-100/90 leading-none mt-0.5">{stockUnit}</p>
            </label>

            <div className="bg-white px-1 py-1 text-center min-w-0">
              <p className="text-[8px] font-bold uppercase tracking-wide text-gray-500 leading-none">
                Allocated
              </p>
              <p className="text-sm font-bold tabular-nums text-emerald-600 leading-tight mt-0.5">
                {poolReady ? allocatedTotal : '—'}
              </p>
              <p className="text-[8px] text-emerald-500/80 leading-none">{stockUnit}</p>
            </div>

            <div className="bg-white px-1 py-1 text-center min-w-0">
              <p className="text-[8px] font-bold uppercase tracking-wide text-gray-500 leading-none">
                Remaining
              </p>
              {isFullyAllocated ? (
                <p className="text-xs font-semibold text-emerald-600 leading-tight mt-0.5 inline-flex items-center justify-center gap-0.5">
                  <CheckCircle2 size={11} />
                  Done
                </p>
              ) : (
                <p
                  className={`text-sm font-bold tabular-nums leading-tight mt-0.5 ${
                    poolReady && remaining > 0 ? 'text-red-600' : 'text-gray-400'
                  }`}
                >
                  {poolReady ? remaining : '—'}
                </p>
              )}
              {!isFullyAllocated ? (
                <p className="text-[8px] text-red-500/80 leading-none">{stockUnit}</p>
              ) : null}
            </div>
          </div>

          <div>
            <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-red-500 transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-[9px] text-gray-500 mt-0.5 text-right leading-none">
              {poolReady
                ? isFullyAllocated
                  ? 'Done'
                  : `${remaining} left`
                : 'Set qty'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
