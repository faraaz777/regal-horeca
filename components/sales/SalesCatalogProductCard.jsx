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

function MetaRow({ label, value, mono = false }) {
  if (!value) return null;
  return (
    <p className="text-xs text-gray-600 flex gap-1.5 min-w-0">
      <span className="text-gray-400 shrink-0 w-14">{label}</span>
      <span className={`truncate ${mono ? 'font-mono text-[11px] text-gray-800' : ''}`}>{value}</span>
    </p>
  );
}

export default function SalesCatalogProductCard({ product, canAdd, onAdd }) {
  const [detailOpen, setDetailOpen] = useState(false);

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
    maxDiscountPercent,
    minOfferPricePaise,
  } = product;

  const { headline, brandHint } = parseProductTitleParts(title, brand);
  const displayBrand = brand || brandHint;
  const { code: skuCode, note: skuNote } = parseSkuForDisplay(sku);

  const hasDiscount = maxDiscountPercent > 0 && listPricePaise > 0;
  const listLabel = listPricePaise > 0 ? formatPaise(listPricePaise) : 'Not set';

  const showBarcode = barcode && barcode !== skuCode;

  return (
    <>
      <article className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col h-full relative">
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
          <SalesSaveToCollectionMenu productId={id} productTitle={title} />
          <button
            type="button"
            onClick={() => setDetailOpen(true)}
            className="p-1 rounded-full bg-white/90 border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-white shadow-sm"
            title="View product details"
            aria-label="View product details"
          >
            <InfoIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-3 p-3 flex-1">
        <div className="shrink-0 w-20 h-20 rounded-md border border-gray-100 bg-gray-50 overflow-hidden">
          {heroImage ? (
            <img src={heroImage} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400 text-center px-1">
              No image
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 flex flex-col gap-1 pr-6">
          <h3 className="font-medium text-gray-900 text-sm leading-snug line-clamp-2">{headline}</h3>

          {(categoryName || displayBrand) && (
            <p className="text-xs text-gray-500 truncate">
              {[categoryName, displayBrand].filter(Boolean).join(' · ')}
            </p>
          )}

          {skuNote && !skuCode && <MetaRow label="Variant" value={skuNote} />}

          {skuCode && <MetaRow label="SKU" value={skuCode} mono />}

          {skuNote && skuCode && skuNote.length < 60 && (
            <p className="text-[11px] text-gray-400 truncate pl-[3.75rem]">{skuNote}</p>
          )}

          <MetaRow label="Barcode" value={showBarcode ? barcode : ''} mono />

          <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-1">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${stockStatusClass(stockStatus)}`}
            >
              <span>
                {sellableQty} {stockUnit}
              </span>
              <span className="opacity-75">·</span>
              <span>{stockStatusLabel(stockStatus)}</span>
            </span>
            {(product.isDeadStock || product.condition === 'HAS_DEAD_STOCK') && (
              <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-900">
                ⚠ Dead stock
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="px-3 pb-3 space-y-2">
        <div className="rounded-md bg-gray-50 border border-gray-100 px-2.5 py-2 text-xs">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-gray-500">List price</span>
            <span
              className={`font-semibold text-sm ${listPricePaise > 0 ? 'text-gray-900' : 'text-gray-400'}`}
            >
              {listLabel}
            </span>
          </div>

          {hasDiscount ? (
            <>
              <div className="flex items-baseline justify-between gap-2 mt-1">
                <span className="text-gray-500">Max discount</span>
                <span className="font-medium text-blue-700">Up to {maxDiscountPercent}%</span>
              </div>
              <div className="flex items-baseline justify-between gap-2 mt-1 pt-1 border-t border-gray-200/80">
                <span className="text-gray-500">Lowest offer</span>
                <span className="font-medium text-emerald-800">
                  {formatPaise(minOfferPricePaise)}
                </span>
              </div>
            </>
          ) : listPricePaise > 0 ? (
            <p className="text-gray-400 mt-1">No discount below list price</p>
          ) : null}
        </div>

        <button
          type="button"
          disabled={!canAdd}
          onClick={onAdd}
          className="w-full py-2 text-xs font-medium bg-primary text-white rounded-md disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          Add to bucket
        </button>
      </div>
    </article>

      {detailOpen && (
        <SalesProductDetailModal
          productId={id}
          preview={product}
          onClose={() => setDetailOpen(false)}
          canAdd={canAdd}
          onAdd={onAdd}
        />
      )}
    </>
  );
}
