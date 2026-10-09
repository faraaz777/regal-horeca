import 'server-only';

/**
 * Shared Mongo match builders for catalog brand/color filters.
 *
 * Used by:
 * - Manage Products / storefront (`queryProducts`)
 * - Add-to-inventory discovery (`buildInventoryProductQuery`)
 *
 * Keep one semantics so admin inventory intake and the product list
 * never disagree on what “Black” or a brand name means.
 */

export function parseCsvParam(param) {
  if (!param) return [];
  return String(param)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Exact brand `$in` — facet UIs pass the stored brand strings,
 * so casing matches what admin/catalog facets already expose.
 */
export function buildBrandMatch(brandsParam) {
  const brands = Array.isArray(brandsParam)
    ? brandsParam.map((b) => String(b || '').trim()).filter(Boolean)
    : parseCsvParam(brandsParam);
  if (brands.length === 0) return null;
  return { brand: { $in: brands } };
}

/**
 * Color match across the three places colour lives on Product:
 * - child `variationAttributes.color` (majority of catalog rows)
 * - parent `colorVariants.colorName` swatches
 * - top-level `colour` (inventory/import field; often empty today)
 *
 * Comparison is case-insensitive so Cream/CREAM both match.
 */
export function buildColorMatch(colorsParam) {
  const colors = Array.isArray(colorsParam)
    ? colorsParam.map((c) => String(c || '').trim()).filter(Boolean)
    : parseCsvParam(colorsParam);
  if (colors.length === 0) return null;

  const lower = colors.map((c) => c.toLowerCase());
  return {
    $or: [
      {
        $expr: {
          $gt: [
            {
              $size: {
                $filter: {
                  input: { $ifNull: ['$colorVariants', []] },
                  as: 'cv',
                  cond: {
                    $in: [
                      {
                        $toLower: {
                          $trim: { input: { $ifNull: ['$$cv.colorName', ''] } },
                        },
                      },
                      lower,
                    ],
                  },
                },
              },
            },
            0,
          ],
        },
      },
      {
        $expr: {
          $in: [
            {
              $toLower: {
                $trim: { input: { $ifNull: ['$variationAttributes.color', ''] } },
              },
            },
            lower,
          ],
        },
      },
      {
        $expr: {
          $in: [
            {
              $toLower: {
                $trim: { input: { $ifNull: ['$colour', ''] } },
              },
            },
            lower,
          ],
        },
      },
    ],
  };
}
