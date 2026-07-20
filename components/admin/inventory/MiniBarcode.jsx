'use client';

import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

/**
 * Compact scannable barcode for inventory list testing.
 * Encodes the product barcode value only (not SKU).
 */
export default function MiniBarcode({ value }) {
  const svgRef = useRef(null);
  const code = String(value || '').trim();

  useEffect(() => {
    if (!svgRef.current || !code) return;
    try {
      JsBarcode(svgRef.current, code, {
        format: 'CODE128',
        width: 1,
        height: 22,
        displayValue: false,
        margin: 0,
        background: 'transparent',
      });
    } catch {
      // Invalid barcode value — leave cell without bars
      if (svgRef.current) {
        svgRef.current.innerHTML = '';
      }
    }
  }, [code]);

  if (!code) return null;

  return (
    <svg
      ref={svgRef}
      className="block w-full max-w-[110px] h-[22px] mt-1"
      aria-label={`Barcode ${code}`}
    />
  );
}
