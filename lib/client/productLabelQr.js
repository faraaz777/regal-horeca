/**
 * QR as SVG data URL so the tiny sticker stays sharp in preview, print, and PDF.
 */

export async function qrSvgDataUrl(text) {
  const value = String(text || '').trim();
  if (!value) return '';

  const qrModule = await import('qrcode');
  const QRCode = qrModule.default || qrModule;
  const svg = await QRCode.toString(value, {
    type: 'svg',
    margin: 0,
    errorCorrectionLevel: 'M',
    color: { dark: '#111111', light: '#ffffff' },
  });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
