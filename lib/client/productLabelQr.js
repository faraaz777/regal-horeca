/**
 * QR for product stickers.
 *
 * Use a high-DPI PNG in <img> — reliable in preview/print/PDF.
 * Inline SVG looked sharp in theory but collapsed to an empty box in the
 * mm-sized label face (no intrinsic size after stripping width/height).
 *
 * 512px over ~12 mm ≈ 1000 dpi, so thermal stock stays crisp with
 * image-rendering: crisp-edges on the <img>.
 */

const QR_COLOR = { dark: '#111111', light: '#ffffff' };
const DEFAULT_PNG_PX = 512;

async function loadQrCode() {
  const qrModule = await import('qrcode');
  return qrModule.default || qrModule;
}

/**
 * High-DPI PNG data URL for <img src>.
 */
export async function qrPngDataUrl(text, sizePx = DEFAULT_PNG_PX) {
  const value = String(text || '').trim();
  if (!value) return '';

  const QRCode = await loadQrCode();
  return QRCode.toDataURL(value, {
    type: 'image/png',
    width: sizePx,
    margin: 0,
    errorCorrectionLevel: 'M',
    color: QR_COLOR,
  });
}

/**
 * @deprecated Use qrPngDataUrl — kept so older imports do not break.
 */
export async function qrSvgDataUrl(text) {
  return qrPngDataUrl(text);
}

/**
 * @deprecated Use qrPngDataUrl.
 */
export async function qrSvgMarkup(text) {
  return qrPngDataUrl(text);
}
