'use client';

import { useState } from 'react';
import { parseProductTitleParts } from '@/lib/shared/formatProductDisplay';
import { TrashIcon } from '@/components/Icons';
import SalesProductDetailModal from '@/components/sales/SalesProductDetailModal';

/**
 * Compact collection line — qty + add to quote only.
 * Catalog bookmark / info / SKU stay off this page; tap the thumb for detail.
 * Card layout is CSS-only display; same add / remove / detail, no extra fetches.
 */
export default function SalesCollectionProductRow({
  product,
  layout = 'list',
  canAdd = false,
  onAdd,
  onRemove,
  removing = false,
}) {
  const [qty, setQty] = useState(Math.max(1, product.suggestedQty || 1));
  const [detailOpen, setDetailOpen] = useState(false);
  const { headline } = parseProductTitleParts(product.title, product.brand);
  const label = headline || product.title;

  const handleAdd = () => {
    const quantity = Math.max(1, parseInt(qty, 10) || 1);
    onAdd?.(product, { quantity });
    setQty(1);
  };

  return (
    <>
      {layout === 'card' ? (
        <div className="border border-black/[0.06] rounded-sm overflow-hidden bg-white">
          <button
            type="button"
            onClick={() => setDetailOpen(true)}
            className="block w-full aspect-square bg-warm-white"
            aria-label={`View ${label}`}
          >
            {product.heroImage ? (
              <img src={product.heroImage} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full" />
            )}
          </button>
          <div className="flex items-start gap-0.5 p-2">
            <button
              type="button"
              onClick={() => setDetailOpen(true)}
              className="flex-1 min-w-0 text-left"
            >
              <p className="text-[13px] font-medium text-rich-black line-clamp-2 leading-snug">
                {label}
              </p>
            </button>
            <button
              type="button"
              disabled={!canAdd}
              onClick={handleAdd}
              className="shrink-0 min-h-[44px] px-2 text-[10px] font-semibold uppercase tracking-[0.12em] bg-rich-black text-white disabled:opacity-35 rounded-sm"
            >
              Add
            </button>
            <button
              type="button"
              disabled={removing}
              onClick={() => onRemove?.(product.id, product.title)}
              className="shrink-0 min-w-[36px] min-h-[44px] inline-flex items-center justify-center text-black/30 hover:text-accent disabled:opacity-40"
              aria-label={`Remove ${label} from collection`}
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 py-2.5 border-b border-black/[0.06] last:border-b-0">
          <button
            type="button"
            onClick={() => setDetailOpen(true)}
            className="shrink-0 w-14 h-14 bg-white border border-black/[0.06] rounded-sm overflow-hidden"
            aria-label={`View ${label}`}
          >
            {product.heroImage ? (
              <img src={product.heroImage} alt="" className="w-full h-full object-contain p-1" />
            ) : (
              <div className="w-full h-full bg-warm-white" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setDetailOpen(true)}
            className="min-w-0 flex-1 text-left"
          >
            <p className="text-[13px] font-medium text-rich-black line-clamp-2 leading-snug">
              {label}
            </p>
          </button>

          <div className="inline-flex items-center shrink-0 bg-warm-white rounded-sm overflow-hidden">
            <button
              type="button"
              disabled={!canAdd || qty <= 1}
              className="min-h-[44px] min-w-[36px] text-sm text-rich-black hover:bg-black/5 disabled:opacity-30"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              aria-label="Decrease quantity"
            >
              −
            </button>
            <input
              type="number"
              min={1}
              disabled={!canAdd}
              className="w-8 bg-transparent text-center text-sm tabular-nums min-h-[44px] focus:outline-none disabled:opacity-40 text-rich-black"
              value={qty}
              onChange={(e) => setQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
            />
            <button
              type="button"
              disabled={!canAdd}
              className="min-h-[44px] min-w-[36px] text-sm text-rich-black hover:bg-black/5 disabled:opacity-30"
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
            className="shrink-0 min-h-[44px] px-3 text-[10px] font-semibold uppercase tracking-[0.14em] bg-rich-black text-white disabled:opacity-35 rounded-sm hover:opacity-90"
          >
            Add
          </button>

          <button
            type="button"
            disabled={removing}
            onClick={() => onRemove?.(product.id, product.title)}
            className="shrink-0 min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-black/30 hover:text-accent disabled:opacity-40"
            aria-label={`Remove ${label} from collection`}
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {detailOpen && (
        <SalesProductDetailModal
          productId={product.id}
          preview={product}
          onClose={() => setDetailOpen(false)}
          canAdd={canAdd}
          onAdd={(p, opts) => onAdd?.(p, opts)}
        />
      )}
    </>
  );
}
