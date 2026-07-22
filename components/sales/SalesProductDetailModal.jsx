'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { XIcon } from '@/components/Icons';
import SalesSaveToCollectionMenu from '@/components/sales/SalesSaveToCollectionMenu';

const fetcher = (url) => adminJson(url);

function DetailRow({ label, value, mono = false }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-gray-100 text-sm">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className={`text-right font-medium text-gray-900 ${mono ? 'font-mono text-xs' : ''}`}>
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
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!productId) return null;

  const title = detail?.title || preview?.title || '';
  const brand = detail?.brand || preview?.brand || '';
  const { headline } = parseProductTitleParts(title, brand);
  const { code: skuCode } = parseSkuForDisplay(detail?.sku || preview?.sku || '');
  const images = detail?.images?.length
    ? detail.images
    : preview?.heroImage
      ? [preview.heroImage]
      : [];
  const mainImage = images[activeImage] || images[0];
  const formatMoney = (paise) => (paise > 0 ? formatPaise(paise) : '—');

  const handleSelectVariant = (variant) => {
    if (variant?.id && variant.id !== activeProductId) {
      setActiveProductId(variant.id);
    }
  };

  const handleAddClick = () => {
    if (!onAdd) return;
    onAdd({
      id: detail?.id || activeProductId,
      title: detail?.title || preview?.title || 'Product',
    });
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      <div
        className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[min(90vh,720px)] flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sales-product-detail-title"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
          <h2 id="sales-product-detail-title" className="text-sm font-semibold text-gray-900 truncate pr-4">
            Product details
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {isLoading && !detail ? (
            <p className="p-8 text-sm text-gray-500 text-center">Loading product…</p>
          ) : error ? (
            <p className="p-8 text-sm text-red-600 text-center">
              Could not load product details.
            </p>
          ) : (
            <div className={`grid md:grid-cols-2 gap-0 md:gap-6 p-4 md:p-6 ${canAdd && onAdd ? 'pb-2' : ''}`}>
              <div className="space-y-3 md:sticky md:top-0 self-start">
                <div className="aspect-square rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
                  {mainImage ? (
                    <img src={mainImage} alt="" className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm text-gray-400">
                      No image
                    </div>
                  )}
                </div>

                {images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {images.map((url, idx) => (
                      <button
                        key={`${url}-${idx}`}
                        type="button"
                        onClick={() => setActiveImage(idx)}
                        className={`shrink-0 w-14 h-14 rounded-md border overflow-hidden ${
                          idx === activeImage ? 'border-black ring-1 ring-black' : 'border-gray-200'
                        }`}
                      >
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 md:mt-0 space-y-4 min-w-0">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 leading-snug">{headline}</h3>
                  {(detail?.categoryName || brand) && (
                    <p className="text-sm text-gray-500 mt-1">
                      {[detail?.categoryName, brand].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>

                {colorVariantsForPicker.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-gray-800 mb-2">
                      Colour:{' '}
                      <span className="font-normal text-gray-500">
                        {selectedColor?.colorName || '—'}
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {colorVariantsForPicker.map((cv) => (
                        <button
                          key={cv.colorName}
                          type="button"
                          onClick={() => setSelectedColor(cv)}
                          title={cv.colorName}
                          aria-pressed={selectedColor?.colorName === cv.colorName}
                          className={`h-9 w-9 rounded-lg border-2 overflow-hidden shrink-0 ${
                            selectedColor?.colorName === cv.colorName
                              ? 'border-black ring-1 ring-black'
                              : 'border-gray-300 hover:border-gray-500'
                          }`}
                        >
                          <span className="block w-full h-full" style={colorSwatchStyle(cv)} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {showVariantChips && (
                  <div>
                    <p className="text-sm font-semibold text-gray-800 mb-2">Options</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {(selectedColor ? variantsForColor : detail?.variants || []).map(
                        (variant, idx) => {
                          const active = variant.id === detail?.id;
                          return (
                            <button
                              key={variant.id}
                              type="button"
                              onClick={() => handleSelectVariant(variant)}
                              className={`min-h-[2.5rem] px-3 py-2 text-xs font-semibold rounded-md border transition-colors ${
                                active
                                  ? 'bg-primary text-white border-primary'
                                  : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
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
                  <div>
                    <p className="text-sm font-semibold text-gray-800 mb-2">Variants</p>
                    <div className="space-y-1 max-h-40 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
                      {detail.variants.map((variant, idx) => {
                        const active = variant.id === detail?.id;
                        const label =
                          [variant.color, variantChipLabel(variant, idx)].filter(Boolean).join(' · ') ||
                          variant.title;
                        return (
                          <button
                            key={variant.id}
                            type="button"
                            onClick={() => handleSelectVariant(variant)}
                            className={`w-full text-left px-3 py-2 text-xs flex justify-between gap-2 ${
                              active ? 'bg-gray-100 font-semibold' : 'hover:bg-gray-50'
                            }`}
                          >
                            <span className="truncate">{label}</span>
                            <span className="text-gray-500 shrink-0">{variant.sellableQty} in stock</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="rounded-lg border border-gray-200 px-3">
                  <DetailRow label="SKU" value={skuCode || detail?.sku || '—'} mono />
                  <DetailRow
                    label="Barcode"
                    value={detail?.barcode?.trim() ? detail.barcode : '—'}
                    mono
                  />
                </div>

                <div className="rounded-lg border border-gray-200 px-3">
                  <DetailRow label="MRP" value={formatMoney(detail?.mrpPaise)} />
                  <DetailRow label="Selling price" value={formatMoney(detail?.sellingPricePaise)} />
                  <DetailRow
                    label="Max discount"
                    value={
                      detail?.maxDiscountPercent > 0
                        ? `${detail.maxDiscountPercent}%`
                        : '0%'
                    }
                  />
                  {detail?.maxDiscountPercent > 0 && detail?.minOfferPricePaise > 0 && (
                    <DetailRow
                      label="Lowest offer"
                      value={formatMoney(detail.minOfferPricePaise)}
                    />
                  )}
                  <DetailRow
                    label="GST"
                    value={
                      detail?.gstPercent != null && detail.gstPercent > 0
                        ? `${detail.gstPercent}%`
                        : '—'
                    }
                  />
                </div>

                <div className="rounded-lg border border-gray-200 px-3 py-2.5 flex justify-between items-center text-sm">
                  <span className="text-gray-500">Sellable stock</span>
                  <span className="font-semibold text-gray-900 flex items-center gap-2">
                    {(detail?.isDeadStock || detail?.condition === 'HAS_DEAD_STOCK') && (
                      <span className="px-1.5 py-px rounded text-[10px] font-semibold bg-amber-100 text-amber-900">
                        ⚠ Dead stock
                      </span>
                    )}
                    {detail?.sellableQty ?? preview?.sellableQty ?? 0}{' '}
                    {detail?.stockUnit || preview?.stockUnit || 'Pcs'}
                  </span>
                </div>

                {detail?.specifications?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                      Specifications
                    </h4>
                    <ul className="rounded-lg border border-gray-200 divide-y divide-gray-100 text-sm">
                      {detail.specifications.map((spec) => (
                        <li
                          key={`${spec.label}-${spec.value}`}
                          className="px-3 py-2 flex justify-between gap-3"
                        >
                          <span className="text-gray-500">{spec.label}</span>
                          <span className="text-gray-900 text-right font-medium">{spec.value}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                    Stock locations
                  </h4>
                  {detail?.stockLocations?.length > 0 ? (
                    <ul className="rounded-lg border border-gray-200 divide-y divide-gray-100">
                      {detail.stockLocations.map((loc) => (
                        <li
                          key={loc.locationId}
                          className="px-3 py-2.5 text-sm flex justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">{loc.name}</p>
                            {loc.code && (
                              <p className="text-xs text-gray-400 font-mono">{loc.code}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0 text-xs text-gray-600">
                            <p>
                              {loc.sellableQty} {detail.stockUnit}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-400 rounded-lg border border-dashed border-gray-200 px-3 py-4 text-center">
                      No location stock on file
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {(!isLoading && !error && detail) && (
          <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-3 sm:px-6 flex flex-col sm:flex-row gap-2">
            <SalesSaveToCollectionMenu
              productId={activeProductId}
              productTitle={detail.title}
              variant="text"
              className="sm:flex-1"
            />
            {canAdd && onAdd && (
              <button
                type="button"
                onClick={handleAddClick}
                className="sm:flex-1 py-2.5 text-sm font-medium bg-primary text-white rounded-md hover:opacity-90"
              >
                Add to bucket
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
