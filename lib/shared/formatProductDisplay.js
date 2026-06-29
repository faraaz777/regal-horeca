/**
 * Display-only formatters for sales floor product cards.
 * Cleans legacy/messy catalog data without mutating stored values.
 */

const SKU_CODE_PATTERN = /^[A-Z0-9][A-Z0-9.+_\-/]*$/i;

/** Title-case shouty ALL-CAPS titles while keeping common abbreviations. */
export function formatReadableProductTitle(title) {
  if (!title) return '';
  const letters = title.replace(/[^a-zA-Z]/g, '');
  if (!letters) return title;

  const upperCount = (letters.match(/[A-Z]/g) || []).length;
  if (upperCount / letters.length < 0.65) return title;

  return title
    .split(/\s+/)
    .map((word) => {
      const bare = word.replace(/[^a-zA-Z0-9]/g, '');
      if (/^(pcs|pvc|otg|sku|ml|cm|mm|qsr|set)$/i.test(bare)) {
        return word.replace(bare, bare.toUpperCase());
      }
      if (bare.length <= 2) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Split pipe-separated titles: "NAME | CATEGORY | BRAND" → headline + optional brand hint.
 */
export function parseProductTitleParts(title, knownBrand = '') {
  if (!title) return { headline: '', brandHint: knownBrand || '' };

  const parts = title
    .split('|')
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    return {
      headline: formatReadableProductTitle(title),
      brandHint: knownBrand || '',
    };
  }

  const last = parts[parts.length - 1];
  const brandMatches =
    knownBrand && last.toLowerCase() === knownBrand.toLowerCase();
  const lastLooksLikeBrand =
    !knownBrand &&
    last.length <= 32 &&
    !/\d{3,}/.test(last) &&
    parts.length >= 2;

  if (brandMatches || lastLooksLikeBrand) {
    const body = parts.slice(0, -1);
    const deduped = body.filter((part, i) => i === 0 || part.toLowerCase() !== body[i - 1].toLowerCase());
    return {
      headline: formatReadableProductTitle(deduped.join(' · ')),
      brandHint: knownBrand || last,
    };
  }

  return {
    headline: formatReadableProductTitle(parts.join(' · ')),
    brandHint: knownBrand || '',
  };
}

/**
 * Extract a clean SKU code from legacy values like:
 * "Round Condiment Set 255 ml : IB1334-2.5+ISP1037+IT1334-5"
 */
export function parseSkuForDisplay(sku) {
  if (!sku) return { code: '', note: '' };

  const trimmed = String(sku).trim();

  const colonMatch = trimmed.match(/^(.+?)\s*:\s*(.+)$/);
  if (colonMatch) {
    const note = colonMatch[1].trim();
    const code = colonMatch[2].trim();
    if (code.length >= 2) return { code, note };
  }

  const dashSkuMatch = trimmed.match(/sku\s*[-–]\s*(.+)$/i);
  if (dashSkuMatch) {
    return { code: dashSkuMatch[1].trim(), note: '' };
  }

  if (trimmed.length <= 28 && SKU_CODE_PATTERN.test(trimmed.replace(/\s/g, ''))) {
    return { code: trimmed, note: '' };
  }

  if (/[A-Z]{2,}\d/.test(trimmed) || /[A-Z0-9]+-[A-Z0-9.+-]+/i.test(trimmed)) {
    const token = trimmed.split(/\s+/).find((t) => SKU_CODE_PATTERN.test(t) && /\d/.test(t));
    if (token) return { code: token, note: trimmed.replace(token, '').trim() };
  }

  return { code: '', note: trimmed };
}
