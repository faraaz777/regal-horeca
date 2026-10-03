'use client';

import { PrintIcon } from '@/components/Icons';

/**
 * Physical sticker face. Width/height are millimetres so @page and jsPDF
 * match the preview. Default stock is 60×40; tighter 50×25 / 50×30 still work.
 *
 * QR is a high-DPI PNG <img> (not inline SVG). Inline SVG had no intrinsic
 * size in the mm box and disappeared in preview; PNG at ~512px stays visible
 * and sharp with crisp-edges rendering.
 */

export function PrintLabelButton({ onClick, disabled, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-slate-600 hover:text-slate-900 disabled:opacity-50 ${className}`}
      disabled={disabled}
      title="Print label"
    >
      <PrintIcon />
    </button>
  );
}

export default function ProductLabel({ item, size, qrDataUrl }) {
  const heightMm = Number(size?.heightMm) || 40;
  const tight = heightMm <= 25;
  const roomy = heightMm >= 40;
  const qrMm = tight ? 11 : roomy ? 18 : 13;
  const pad = tight ? '1.2mm 1.4mm' : roomy ? '2.2mm 2.4mm' : '1.6mm 1.8mm';

  return (
    <div
      className="product-label-face"
      style={{
        width: `${size.widthMm}mm`,
        height: `${size.heightMm}mm`,
        boxSizing: 'border-box',
        padding: pad,
        display: 'flex',
        alignItems: 'stretch',
        background: '#ffffff',
        color: '#111111',
        overflow: 'hidden',
        fontFamily: 'Arial, Helvetica, sans-serif',
        border: '0.15mm solid #e5e7eb',
        WebkitFontSmoothing: 'antialiased',
        textRendering: 'geometricPrecision',
      }}
    >
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
        }}
      >
        <div
          style={{
            fontSize: tight ? '5.5pt' : roomy ? '8pt' : '6.5pt',
            fontWeight: 800,
            letterSpacing: '0.16em',
            color: '#EE4023',
            lineHeight: 1,
          }}
        >
          REGAL
        </div>
        <div
          style={{
            fontSize: tight ? '6.5pt' : roomy ? '10pt' : '7.5pt',
            fontWeight: 700,
            lineHeight: 1.15,
            marginTop: roomy ? '1.2mm' : '0.7mm',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: tight ? 1 : roomy ? 3 : 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {item.title}
        </div>
        <div style={{ marginTop: 'auto' }}>
          {item.sku ? (
            <div
              style={{
                fontSize: tight ? '5.5pt' : roomy ? '8pt' : '6pt',
                fontWeight: 600,
                letterSpacing: '0.02em',
              }}
            >
              SKU {item.sku}
            </div>
          ) : null}
          {item.variantLine ? (
            <div
              style={{
                fontSize: tight ? '5pt' : roomy ? '7pt' : '5.5pt',
                color: '#444444',
                marginTop: '0.3mm',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
              }}
            >
              {item.variantLine}
            </div>
          ) : null}
        </div>
      </div>
      {qrDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={qrDataUrl}
          alt=""
          width={512}
          height={512}
          style={{
            width: `${qrMm}mm`,
            height: `${qrMm}mm`,
            marginLeft: roomy ? '2mm' : '1.2mm',
            alignSelf: 'center',
            flexShrink: 0,
            imageRendering: 'pixelated',
          }}
        />
      ) : (
        <div
          style={{
            width: `${qrMm}mm`,
            height: `${qrMm}mm`,
            marginLeft: roomy ? '2mm' : '1.2mm',
            alignSelf: 'center',
            flexShrink: 0,
            background: '#f3f4f6',
          }}
        />
      )}
    </div>
  );
}
