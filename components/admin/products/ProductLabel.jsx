'use client';

import { PrintIcon } from '@/components/Icons';

/**
 * Physical sticker face. Width/height are millimetres so @page and jsPDF
 * match the preview. 50×25 keeps the name to one line; 50×30 allows two.
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
  const tight = Number(size?.heightMm) <= 25;
  const qrMm = tight ? 11 : 13;

  return (
    <div
      className="product-label-face"
      style={{
        width: `${size.widthMm}mm`,
        height: `${size.heightMm}mm`,
        boxSizing: 'border-box',
        padding: tight ? '1.2mm 1.4mm' : '1.6mm 1.8mm',
        display: 'flex',
        alignItems: 'stretch',
        background: '#ffffff',
        color: '#111111',
        overflow: 'hidden',
        fontFamily: 'Arial, Helvetica, sans-serif',
        border: '0.15mm solid #e5e7eb',
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
            fontSize: tight ? '5.5pt' : '6.5pt',
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
            fontSize: tight ? '6.5pt' : '7.5pt',
            fontWeight: 700,
            lineHeight: 1.15,
            marginTop: '0.7mm',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: tight ? 1 : 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {item.title}
        </div>
        <div style={{ marginTop: 'auto' }}>
          {item.sku ? (
            <div
              style={{
                fontSize: tight ? '5.5pt' : '6pt',
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
                fontSize: tight ? '5pt' : '5.5pt',
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
        // QR is a data URL so print/PDF never wait on a network image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={qrDataUrl}
          alt=""
          style={{
            width: `${qrMm}mm`,
            height: `${qrMm}mm`,
            marginLeft: '1.2mm',
            alignSelf: 'center',
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: `${qrMm}mm`,
            height: `${qrMm}mm`,
            marginLeft: '1.2mm',
            alignSelf: 'center',
            flexShrink: 0,
            background: '#f3f4f6',
          }}
        />
      )}
    </div>
  );
}
