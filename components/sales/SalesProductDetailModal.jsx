'use client';

import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import useSWR from 'swr';
import { adminJson } from '@/lib/client/adminFetch';
import { formatPaise } from '@/lib/shared/formatMoney';
import { parseProductTitleParts, parseSkuForDisplay } from '@/lib/shared/formatProductDisplay';
import { getCatalogColorSwatchStyle } from '@/lib/shared/catalogColors';
import {
  buildColorVariantsForPicker,
  filterVariantsByColor,
  normalizeVariantAttr,
  variantChipLabel,
  variantsHaveSecondaryDimension,
} from '@/lib/shared/productVariantPicker';
import { XIcon, ChevronLeftIcon, ChevronRightIcon } from '@/components/Icons';
import SalesSaveToCollectionMenu from '@/components/sales/SalesSaveToCollectionMenu';

const fetcher = (url) => adminJson(url);
const SWIPE_THRESHOLD = 40;

/** Hairline technical row — empty values stay soft so real data stands out */
function SpecRow({ label, value, mono = false, empty = false }) {
  return (
    <div className="flex justify-between gap-4 py-2.5 border-b border-black/[0.06] last:border-b-0">
      <span className="text-[10px] font-medium uppercase tracking-widest text-black/40 shrink-0 pt-0.5">
        {label}
      </span>
      <span
        className={`text-right text-sm tabular-nums ${
          empty ? 'font-normal text-black/25' : 'font-semibold text-rich-black'
        } ${mono ? 'font-mono text-xs tracking-tight' : ''}`}
      >
        {value}
      </span>
    </div>
  );
}

function colorSwatchStyle(variant) {
  const hex = variant?.colorHex;
  if (hex && /^#[0-9A-Fa-f]{6}$/.test(hex)) {
    return { backgroundColor: hex };
  }
  return getCatalogColorSwatchStyle(variant?.colorName);
}

export default function SalesProductDetailModal({
  productId,
  preview,
  onClose,
  canAdd,
  onAdd,
}) {
  const [activeProductId, setActiveProductId] = useState(productId);
  const [activeImage, setActiveImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState(null);
  const [addQty, setAddQty] = useState(1);
  const touchStartX = useRef(null);

  useEffect(() => {
    setActiveProductId(productId);
    setActiveImage(0);
    setSelectedColor(null);
  }, [productId]);

  const { data, error, isLoading } = useSWR(
    activeProductId ? `/api/sales/catalog/${activeProductId}` : null,
    fetcher,
    { revalidateOnFocus: false, keepPreviousData: true }
  );

  const detail = data?.product;

  const colorVariantsForPicker = useMemo(
    () => buildColorVariantsForPicker(detail?.colorVariants, detail?.variants),
    [detail?.colorVariants, detail?.variants]
  );

  const showVariantChips = useMemo(
    () => detail?.hasVariants && variantsHaveSecondaryDimension(detail?.variants),
    [detail?.hasVariants, detail?.variants]
  );

  const variantsForColor = useMemo(
    () => filterVariantsByColor(detail?.variants, selectedColor),
    [detail?.variants, selectedColor]
  );

  const images = useMemo(() => {
    if (detail?.images?.length) return detail.images;
    if (preview?.heroImage) return [preview.heroImage];
    return [];
  }, [detail?.images, preview?.heroImage]);

  const goPrevImage = useCallback(() => {
    setActiveImage((i) => (images.length ? (i - 1 + images.length) % images.length : 0));
  }, [images.length]);

  const goNextImage = useCallback(() => {
    setActiveImage((i) => (images.length ? (i + 1) % images.length : 0));
  }, [images.length]);

  useEffect(() => {
    if (!detail?.hasVariants) return;
    const current = detail.variants?.find((v) => v.id === detail.id);
    const colorKey = normalizeVariantAttr(current?.color);
    if (!colorKey) return;
    const match =
      colorVariantsForPicker.find(
        (cv) => normalizeVariantAttr(cv.colorName) === colorKey
      ) || null;
    if (match && normalizeVariantAttr(selectedColor?.colorName) !== colorKey) {
      setSelectedColor(match);
    }
  }, [detail, colorVariantsForPicker, selectedColor?.colorName]);

  useEffect(() => {
    if (!productId) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [productId]);

  useEffect(() => {
    setActiveImage(0);
  }, [activeProductId, detail?.images]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (e.key === 'ArrowLeft') goPrevImage();
      if (e.key === 'ArrowRight') goNextImage();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, goPrevImage, goNextImage]);

  if (!productId) return null;

  const title = detail?.title || preview?.title || '';
  const brand = detail?.brand || preview?.brand || '';
  const { headline } = parseProductTitleParts(title, brand);
  const { code: skuCode } = parseSkuForDisplay(detail?.sku || preview?.sku || '');
  const mainImage = images[activeImage] || images[0];
  const formatMoney = (paise) => (paise > 0 ? formatPaise(paise) : '—');
  const moneyEmpty = (paise) => !(paise > 0);

  const hasConfigure =
    colorVariantsForPicker.length > 0 ||
    showVariantChips ||
    (detail?.hasVariants && !showVariantChips && (detail.variants?.length || 0) > 1);

  const barcodeValue = detail?.barcode?.trim() || '';
  const gstValue =
    detail?.gstPercent != null && detail.gstPercent > 0 ? `${detail.gstPercent}%` : '';

  const handleSelectVariant = (variant) => {
    if (variant?.id && variant.id !== activeProductId) {
      setActiveProductId(variant.id);
    }
  };

  const handleAddClick = () => {
    if (!onAdd) return;
    const quantity = Math.max(1, parseInt(addQty, 10) || 1);
    onAdd(
      {
        id: detail?.id || activeProductId,
        title: detail?.title || preview?.title || 'Product',
      },
      { quantity }
    );
    setAddQty(1);
    onClose?.();
  };

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const onTouchEnd = (e) => {
    if (touchStartX.current == null || images.length < 2) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < SWIPE_THRESHOLD) return;
    if (delta < 0) goNextImage();
    else goPrevImage();
  };

  const imagePanel = (
    <div
      className="relative h-64 min-h-[40vh] md:h-full md:min-h-0 bg-white overflow-hidden shrink-0 select-none border-b md:border-b-0 md:border-r border-black/5"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {mainImage ? (
        <img
          src={mainImage}
          alt=""
          draggable={false}
          className="absolute inset-0 w-full h-full object-contain"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-black/30">
          No image
        </div>
      )}

      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={goPrevImage}
            aria-label="Previous image"
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-white text-rich-black shadow-md ring-1 ring-black/10 flex items-center justify-center hover:bg-warm-white transition-colors"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={goNextImage}
            aria-label="Next image"
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-white text-rich-black shadow-md ring-1 ring-black/10 flex items-center justify-center hover:bg-warm-white transition-colors"
          >
            <ChevronRightIcon className="w-5 h-5" />
          </button>

          <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center gap-2 pointer-events-none">
            <p className="text-[10px] font-medium tracking-widest text-black/50 tabular-nums bg-white/90 px-2 py-0.5 ring-1 ring-black/5 shadow-sm">
              {activeImage + 1} / {images.length}
            </p>
            <div className="flex gap-1.5">
              {images.map((_, idx) => (
                <span
                  key={idx}
                  className={`h-1 rounded-full transition-all ${
                    idx === activeImage ? 'w-4 bg-rich-black' : 'w-1.5 bg-black/25'
                  }`}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );

  const infoBody = (
    <>
      {isLoading && !detail ? (
        <p className="py-16 text-sm text-black/40 text-center">Loading product…</p>
      ) : error ? (
        <p className="py-16 text-sm text-accent text-center">Could not load product details.</p>
      ) : (
        <div className="space-y-5">
          {/* 1. Identity */}
          <section className="pb-5 border-b border-black/10">
            {brand && (
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent mb-2">
                {brand}
              </p>
            )}
            <h3
              id="sales-product-detail-title"
              className="font-semibold text-2xl md:text-[1.75rem] text-rich-black leading-tight"
            >
              {headline}
            </h3>
            {detail?.categoryName && (
              <p className="text-sm text-black/45 mt-2">{detail.categoryName}</p>
            )}
          </section>

          {/* 2. Configure — bold, distinct options block */}
          {hasConfigure && (
            <section className="border border-black/10 bg-warm-white overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-rich-black text-white">
                <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em]">
                  Choose options
                </p>
              </div>

              <div className="px-4 py-4 space-y-5">
                {colorVariantsForPicker.length > 0 && (
                  <div>
                    <div className="flex items-baseline justify-between gap-2 mb-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-rich-black">
                        Colour
                      </p>
                      {selectedColor?.colorName ? (
                        <p className="text-xs font-medium text-black/55 truncate">
                          {selectedColor.colorName}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {colorVariantsForPicker.map((cv) => {
                        const active = selectedColor?.colorName === cv.colorName;
                        return (
                          <button
                            key={cv.colorName}
                            type="button"
                            onClick={() => setSelectedColor(cv)}
                            title={cv.colorName}
                            aria-pressed={active}
                            className={`h-11 w-11 overflow-hidden shrink-0 transition-all ${
                              active
                                ? 'ring-2 ring-offset-2 ring-accent scale-105'
                                : 'ring-1 ring-black/20 hover:ring-black/40'
                            }`}
                          >
                            <span className="block w-full h-full" style={colorSwatchStyle(cv)} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {showVariantChips && (
                  <div className={colorVariantsForPicker.length > 0 ? 'pt-4 border-t border-black/10' : ''}>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-rich-black mb-3">
                      Size / option
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {(selectedColor ? variantsForColor : detail?.variants || []).map(
                        (variant, idx) => {
                          const active = variant.id === detail?.id;
                          return (
                            <button
                              key={variant.id}
                              type="button"
                              onClick={() => handleSelectVariant(variant)}
                              className={`min-h-[2.75rem] px-3 py-2 text-xs font-semibold transition-colors ${
                                active
                                  ? 'bg-rich-black text-white'
                                  : 'bg-white text-rich-black ring-1 ring-black/10 hover:ring-black/25'
                              }`}
                            >
                              {variantChipLabel(variant, idx)}
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>
                )}

                {detail?.hasVariants && !showVariantChips && detail.variants.length > 1 && (
                  <div className={colorVariantsForPicker.length > 0 ? 'pt-4 border-t border-black/10' : ''}>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-rich-black mb-3">
                      Variants
                    </p>
                    <div className="max-h-40 overflow-y-auto divide-y divide-black/10 bg-white ring-1 ring-black/10">
                      {detail.variants.map((variant, idx) => {
                        const active = variant.id === detail?.id;
                        const label =
                          [variant.color, variantChipLabel(variant, idx)]
                            .filter(Boolean)
                            .join(' | ') || variant.title;
                        return (
                          <button
                            key={variant.id}
                            type="button"
                            onClick={() => handleSelectVariant(variant)}
                            className={`w-full text-left px-3 py-2.5 text-xs flex justify-between gap-2 transition-colors ${
                              active
                                ? 'font-semibold text-rich-black bg-black/[0.04]'
                                : 'text-black/60 hover:text-rich-black'
                            }`}
                          >
                            <span className="truncate">{label}</span>
                            <span className="text-black/40 shrink-0">
                              {variant.sellableQty} in stock
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 3. Facts */}
          <section className="border border-black/10 px-4 py-4">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-black/5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/50">
                Technical data
              </p>
            </div>
            <div>
              <SpecRow label="SKU" value={skuCode || detail?.sku || '—'} mono />
              {barcodeValue ? (
                <SpecRow label="Barcode" value={barcodeValue} mono />
              ) : null}
              <SpecRow
                label="MRP"
                value={formatMoney(detail?.mrpPaise)}
                empty={moneyEmpty(detail?.mrpPaise)}
              />
              <SpecRow
                label="Selling price"
                value={formatMoney(detail?.sellingPricePaise)}
                empty={moneyEmpty(detail?.sellingPricePaise)}
              />
              {detail?.negotiablePercent > 0 ? (
                <SpecRow
                  label="Negotiation range"
                  value={`Up to ${detail.negotiablePercent}%`}
                />
              ) : null}
              {gstValue ? <SpecRow label="GST" value={gstValue} /> : null}
              <SpecRow
                label="Sellable stock"
                value={
                  <>
                    {(detail?.isDeadStock || detail?.condition === 'HAS_DEAD_STOCK') && (
                      <span className="inline-block mr-2 px-1.5 py-px text-[10px] font-semibold bg-amber-50 text-amber-800 align-middle">
                        Dead stock
                      </span>
                    )}
                    {detail?.sellableQty ?? preview?.sellableQty ?? 0}{' '}
                    {detail?.stockUnit || preview?.stockUnit || 'Pcs'}
                  </>
                }
              />
            </div>
          </section>

          {detail?.specifications?.length > 0 && (
            <section className="border border-black/10 px-4 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/50 mb-3 pb-2 border-b border-black/5">
                Specifications
              </p>
              <ul>
                {detail.specifications.map((spec) => (
                  <li key={`${spec.label}-${spec.value}`}>
                    <SpecRow label={spec.label} value={spec.value} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 4. Stock locations — distinct inventory block */}
          <section className="border border-black/10 overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-warm-white border-b border-black/10">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rich-black">
                  Stock by location
                </p>
              </div>
              <p className="text-[11px] font-semibold tabular-nums text-black/55 shrink-0">
                {detail?.sellableQty ?? preview?.sellableQty ?? 0}{' '}
                {detail?.stockUnit || preview?.stockUnit || 'Pcs'} total
              </p>
            </div>
            {detail?.stockLocations?.length > 0 ? (
              <ul className="divide-y divide-black/5">
                {detail.stockLocations.map((loc) => (
                  <li
                    key={loc.locationId}
                    className="px-4 py-3 flex justify-between gap-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-rich-black truncate">{loc.name}</p>
                      {loc.code && (
                        <p className="text-[11px] text-black/35 font-mono mt-0.5">{loc.code}</p>
                      )}
                    </div>
                    <p className="text-sm font-semibold tabular-nums text-rich-black shrink-0">
                      {loc.sellableQty}{' '}
                      <span className="text-xs font-normal text-black/40">
                        {detail.stockUnit}
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-black/35 py-5 text-center px-4">
                No location stock on file
              </p>
            )}
          </section>
        </div>
      )}
    </>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div
        className="relative bg-white w-full sm:max-w-5xl h-[100dvh] sm:h-[min(90vh,760px)] sm:max-h-[min(90vh,760px)] flex flex-col md:grid md:grid-cols-2 overflow-hidden shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sales-product-detail-title"
      >
        {/* Fixed full-bleed image stage — does not scroll with specs */}
        <div className="md:h-full md:min-h-0 shrink-0">{imagePanel}</div>

        <div className="flex flex-col min-h-0 flex-1 bg-white">
          <div className="shrink-0 flex items-center justify-between px-5 sm:px-7 pt-4 pb-3 border-b border-black/5">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-black/40">
              Product specifications
            </p>
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-black/50 hover:text-rich-black transition-colors"
            >
              Close
              <XIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-7 py-5">{infoBody}</div>

          {/* 4. Actions — visually distinct footer */}
          {!isLoading && !error && detail && (
            <div className="shrink-0 px-5 sm:px-7 py-4 bg-warm-white border-t border-black/10 flex flex-col sm:flex-row gap-2.5">
              <SalesSaveToCollectionMenu
                productId={activeProductId}
                productTitle={detail.title}
                variant="text"
                className="sm:flex-1"
              />
              {canAdd && onAdd && (
                <div className="sm:flex-1 flex items-center gap-2">
                  <div className="inline-flex items-center bg-white overflow-hidden shrink-0 ring-1 ring-black/10">
                    <button
                      type="button"
                      disabled={addQty <= 1}
                      className="min-h-[44px] min-w-[44px] px-3 text-lg text-rich-black hover:bg-black/5 disabled:opacity-40"
                      onClick={() => setAddQty((q) => Math.max(1, q - 1))}
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      className="w-12 bg-transparent px-1 min-h-[44px] text-base text-center tabular-nums focus:outline-none"
                      value={addQty}
                      onChange={(e) => setAddQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    />
                    <button
                      type="button"
                      className="min-h-[44px] min-w-[44px] px-3 text-lg text-rich-black hover:bg-black/5"
                      onClick={() => setAddQty((q) => q + 1)}
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddClick}
                    className="flex-1 min-h-[48px] py-3 text-base font-semibold bg-rich-black text-white hover:opacity-90 transition-opacity"
                  >
                    Add to bucket
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
