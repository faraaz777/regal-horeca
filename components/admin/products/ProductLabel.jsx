'use client';

import { PrintIcon } from '@/components/Icons';
import { LABEL_SIZE } from '@/lib/shared/productLabel';

/**
 * Physical sticker face — always 50 × 40 mm.
 *
 * No screen-only chrome on the face (no border). Preview/print/PDF must
 * render the identical box so what you see is what the sticker prints.
 *
 * QR is a high-DPI PNG <img>; PNG at ~512px stays visible and sharp with
 * crisp-edges rendering.
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

const QR_MM = 16;
const PAD = '2mm 2.2mm';

export default function ProductLabel({ item, size = LABEL_SIZE, qrDataUrl }) {
  const widthMm = Number(size?.widthMm) || LABEL_SIZE.widthMm;
  const heightMm = Number(size?.heightMm) || LABEL_SIZE.heightMm;

  return (
    <div
      className="product-label-face"
      style={{
        width: `${widthMm}mm`,
        height: `${heightMm}mm`,
        boxSizing: 'border-box',
        padding: PAD,
        display: 'flex',
        alignItems: 'stretch',
        background: '#ffffff',
        color: '#111111',
        overflow: 'hidden',
        fontFamily: 'Arial, Helvetica, sans-serif',
        // No border — preview used to keep one that print stripped, so they mismatched.
        border: 'none',
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
            fontSize: '7.5pt',
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
            fontSize: '9pt',
            fontWeight: 700,
            lineHeight: 1.15,
            marginTop: '1mm',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {item.title}
        </div>
        <div style={{ marginTop: 'auto' }}>
          {item.sku ? (
            <div
              style={{
                fontSize: '7pt',
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
                fontSize: '6.5pt',
                color: '#444444',
                marginTop: '0.4mm',
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
            width: `${QR_MM}mm`,
            height: `${QR_MM}mm`,
            marginLeft: '1.8mm',
            alignSelf: 'center',
            flexShrink: 0,
            imageRendering: 'pixelated',
          }}
        />
      ) : (
        <div
          style={{
            width: `${QR_MM}mm`,
            height: `${QR_MM}mm`,
            marginLeft: '1.8mm',
            alignSelf: 'center',
            flexShrink: 0,
            background: '#f3f4f6',
          }}
        />
      )}
    </div>
  );
}
