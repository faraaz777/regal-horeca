/**
 * Shared number/text helpers for product commerce fields.
 * Indian grouping is used because MRP / selling are entered in INR.
 */

export function getTextLength(str) {
  if (!str || typeof str !== 'string') return 0;
  return str.replace(/<[^>]*>/g, '').trim().length;
}

export function plainTextToHtml(text) {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (!trimmed) return '';
  return trimmed
    .split(/\n\n+/)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export function sanitizeNumberInput(value) {
  return String(value ?? '')
    .replace(/,/g, '')
    .replace(/[^\d.]/g, '');
}

export function generatePersistedVariantId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Variant-row images are optional overrides.
 * Empty inherits that colour's Media gallery, then the parent hero, so operators
 * upload colour photos once instead of repeating them on every size/weight row.
 */
export function resolveVariantRowImages(row, colorVariants, heroImage) {
  const explicit = Array.isArray(row?.images) ? row.images.filter(Boolean) : [];
  if (explicit.length > 0) return explicit;

  const colorName = String(row?.color || '').trim().toLowerCase();
  if (colorName) {
    const match = (colorVariants || []).find(
      (cv) => String(cv?.colorName || '').trim().toLowerCase() === colorName
    );
    const colorImages = Array.isArray(match?.images) ? match.images.filter(Boolean) : [];
    if (colorImages.length > 0) return colorImages;
  }

  return heroImage ? [heroImage] : [];
}

export function formatIndianNumberInput(value) {
  const cleaned = sanitizeNumberInput(value);
  if (!cleaned) return '';
  const [integerPartRaw, decimalPart] = cleaned.split('.');
  const integerPart = integerPartRaw || '0';
  const lastThree = integerPart.slice(-3);
  const otherNumbers = integerPart.slice(0, -3);
  const formattedInteger = otherNumbers
    ? `${otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${lastThree}`
    : lastThree;
  return decimalPart !== undefined ? `${formattedInteger}.${decimalPart}` : formattedInteger;
}
