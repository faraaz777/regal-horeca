'use client';

import { useState } from 'react';
import { formatPaise, stockStatusClass } from '@/lib/shared/formatMoney';
import {
  parseProductTitleParts,
  parseSkuForDisplay,
} from '@/lib/shared/formatProductDisplay';
import { InfoIcon } from '@/components/Icons';
import SalesProductDetailModal from '@/components/sales/SalesProductDetailModal';
import SalesSaveToCollectionMenu from '@/components/sales/SalesSaveToCollectionMenu';

function stockStatusLabel(status) {
  if (status === 'in_stock') return 'In stock';
  if (status === 'low') return 'Low stock';
  return 'Out of stock';
}

export default function SalesCatalogProductCard({ product, canAdd, onAdd }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [qty, setQty] = useState(1);

  const {
    id,
    title,
    sku,
    barcode,
    brand,
    categoryName,
    heroImage,
    stockUnit,
    sellableQty,
    stockStatus,
    listPricePaise,
    negotiablePercent,
  } = product;

  const { headline, brandHint } = parseProductTitleParts(title, brand);
  const displayBrand = brand || brandHint;
  const { code: skuCode, note: skuNote } = parseSkuForDisplay(sku);

  const hasRoom = negotiablePercent > 0 && listPricePaise > 0;
  const listLabel = listPricePaise > 0 ? formatPaise(listPricePaise) : 'Not set';
  const showBarcode = barcode && barcode !== skuCode;

  const handleAdd = () => {
    const quantity = Math.max(1, parseInt(qty, 10) || 1);
    onAdd?.(product, { quantity });
    setQty(1);
  };

  return (
    <>
      <article className="group bg-white flex flex-col h-full relative transition-shadow hover:shadow-sm">
        <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
          <SalesSaveToCollectionMenu productId={id} productTitle={title} />
          <button
            type="button"
            onClick={() => setDetailOpen(true)}
            className="p-2.5 lg:p-1.5 rounded-full bg-white/95 text-black/50 hover:text-rich-black shadow-sm"
            title="View product details"
            aria-label="View product details"
          >
            <InfoIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-4 p-4 flex-1">
          <button
            type="button"
            onClick={() => setDetailOpen(true)}
            className="shrink-0 w-24 h-24 sm:w-28 sm:h-28 bg-white border border-black/[0.06] rounded-sm overflow-hidden focus:outline-none focus-visible:ring-1 focus-visible:ring-black"
          >
            {heroImage ? (
              <img src={heroImage} alt="" className="w-full h-full object-contain p-1.5" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[10px] text-black/30 text-center px-1">
                No image
              </div>
            )}
          </button>

          <div className="min-w-0 flex-1 flex flex-col gap-1.5 pr-8">
            {displayBrand && (
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent truncate">
                {displayBrand}
              </p>
            )}
            <h3 className="font-semibold text-[15px] text-rich-black leading-snug line-clamp-2">
              {headline}
            </h3>

            {categoryName && (
              <p className="text-xs text-black/40 truncate">{categoryName}</p>
            )}

            {(skuCode || showBarcode || skuNote) && (
              <p className="text-[11px] text-black/35 font-mono truncate">
                {[skuCode, showBarcode ? barcode : null].filter(Boolean).join(' | ')}
                {skuNote && skuNote.length < 50 ? ` | ${skuNote}` : ''}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-2">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium ${stockStatusClass(stockStatus)}`}
              >
                {sellableQty} {stockUnit}
                <span className="opacity-60">|</span>
                {stockStatusLabel(stockStatus)}
              </span>
              {(product.isDeadStock || product.condition === 'HAS_DEAD_STOCK') && (
                <span className="inline-flex px-1.5 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-800">
                  Dead stock
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-black/5">
          {hasRoom ? (
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-black/35">List price</p>
                <p className="text-base font-semibold tabular-nums text-rich-black">
                  {listLabel}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-widest text-black/35">
                  Negotiation range
                </p>
                <p className="text-sm font-medium text-emerald-800 tabular-nums">
                  Up to {negotiablePercent}%
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[10px] uppercase tracking-widest text-black/35 shrink-0">
                List price
              </p>
              <p
                className={`text-base font-semibold tabular-nums ${
                  listPricePaise > 0 ? 'text-rich-black' : 'text-black/30'
                }`}
              >
                {listLabel}
              </p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center bg-warm-white overflow-hidden shrink-0">
              <button
                type="button"
                disabled={!canAdd || qty <= 1}
                className="min-h-[44px] min-w-[44px] px-3 text-lg lg:min-h-0 lg:min-w-0 lg:px-2.5 lg:py-2 lg:text-sm text-rich-black hover:bg-black/5 disabled:opacity-40"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                aria-label="Decrease quantity"
              >
                −
              </button>
              <input
                type="number"
                min={1}
                disabled={!canAdd}
                className="w-10 lg:w-9 bg-transparent px-0.5 min-h-[44px] lg:min-h-0 lg:py-2 text-sm lg:text-xs text-center tabular-nums focus:outline-none disabled:opacity-40"
                value={qty}
                onChange={(e) => setQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
              />
              <button
                type="button"
                disabled={!canAdd}
                className="min-h-[44px] min-w-[44px] px-3 text-lg lg:min-h-0 lg:min-w-0 lg:px-2.5 lg:py-2 lg:text-sm text-rich-black hover:bg-black/5 disabled:opacity-40"
                onClick={() => setQty((q) => q + 1)}
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
            <button
              type="button"
              disabled={!canAdd}
              onClick={handleAdd}
              className="flex-1 min-h-[44px] py-3 lg:min-h-0 lg:py-2.5 text-sm lg:text-xs font-semibold tracking-wide bg-rich-black text-white disabled:opacity-35 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            >
              Add to bucket
            </button>
          </div>
        </div>
      </article>

      {detailOpen && (
        <SalesProductDetailModal
          productId={id}
          preview={product}
          onClose={() => setDetailOpen(false)}
          canAdd={canAdd}
          onAdd={(p, opts) => onAdd?.(p, opts)}
        />
      )}
    </>
  );
}
