'use client';

import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

/**
 * Compact scannable barcode for inventory list testing.
 * Encodes the product barcode value only (not SKU).
 */
export default function MiniBarcode({
  value,
  className = 'block w-full max-w-[110px] h-[22px] mt-1',
  height = 22,
}) {
  const svgRef = useRef(null);
  const code = String(value || '').trim();

  useEffect(() => {
    if (!svgRef.current || !code) return;
    try {
      JsBarcode(svgRef.current, code, {
        format: 'CODE128',
        width: 1,
        height,
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
  }, [code, height]);

  if (!code) return null;

  return (
    <svg
      ref={svgRef}
      className={className}
      aria-label={`Barcode ${code}`}
    />
  );
}
