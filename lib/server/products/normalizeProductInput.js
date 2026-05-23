/**
 * Shared POST/PUT body normalization for product API routes.
 * Mutates the provided object in place.
 */

import { normalizeFilterValues } from '@/lib/shared/normalizeFilterValue';

export function stripVariantRows(data) {
  if (data._variantRows) {
    delete data._variantRows;
  }
  if (data._initialChildIds) {
    delete data._initialChildIds;
  }
}

function pruneEmptyRef(value) {
  if (value === '' || value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  return false;
}

/**
 * @param {object} data
 * @param {{ partial?: boolean }} [opts]
 *   partial: only normalize keys that are own-properties of `data` (PUT semantics)
 */
export function normalizeCategoryAndBrandRefs(data, opts = {}) {
  const { partial = false } = opts;

  const touch = (key) => !partial || Object.prototype.hasOwnProperty.call(data, key);

  if (touch('categoryId')) {
    if (pruneEmptyRef(data.categoryId)) {
      delete data.categoryId;
    }
  }

  if (touch('categoryIds')) {
    if (!data.categoryIds || !Array.isArray(data.categoryIds)) {
      data.categoryIds = [];
    } else {
      data.categoryIds = data.categoryIds.filter((id) => id && id.trim() !== '');
    }
  }

  if (touch('brandCategoryId')) {
    if (pruneEmptyRef(data.brandCategoryId)) {
      delete data.brandCategoryId;
    }
  }

  if (touch('brandCategoryIds')) {
    if (!data.brandCategoryIds || !Array.isArray(data.brandCategoryIds)) {
      data.brandCategoryIds = [];
    } else {
      data.brandCategoryIds = data.brandCategoryIds.filter((id) => id && id.trim() !== '');
    }
  }
}

/**
 * Normalize `filters` to array of { key, values[] }.
 * @param {unknown} filters
 * @returns {Array<{ key: string, values: string[] }>}
 */
export function normalizeFiltersField(filters) {
  if (!filters) {
    return [];
  }
  if (!Array.isArray(filters)) {
    const oldFilters = filters;
    if (typeof oldFilters !== 'object' || oldFilters === null) {
      return [];
    }
    const out = [];
    if (oldFilters.material && Array.isArray(oldFilters.material) && oldFilters.material.length > 0) {
      out.push({ key: 'Material', values: normalizeFilterValues(oldFilters.material) });
    }
    if (oldFilters.size && Array.isArray(oldFilters.size) && oldFilters.size.length > 0) {
      out.push({ key: 'Size', values: normalizeFilterValues(oldFilters.size) });
    }
    if (oldFilters.color && Array.isArray(oldFilters.color) && oldFilters.color.length > 0) {
      out.push({ key: 'Color', values: normalizeFilterValues(oldFilters.color) });
    }
    if (oldFilters.usage && Array.isArray(oldFilters.usage) && oldFilters.usage.length > 0) {
      out.push({ key: 'Usage', values: normalizeFilterValues(oldFilters.usage) });
    }
    Object.keys(oldFilters).forEach((key) => {
      if (['material', 'size', 'color', 'usage'].includes(key.toLowerCase())) return;
      if (Array.isArray(oldFilters[key]) && oldFilters[key].length > 0) {
        out.push({
          key: key.charAt(0).toUpperCase() + key.slice(1),
          values: normalizeFilterValues(oldFilters[key]),
        });
      }
    });
    return out;
  }
  return filters
    .filter((f) => f && f.key && Array.isArray(f.values))
    .map((f) => ({
      key: f.key.trim(),
      values: normalizeFilterValues(f.values.filter((v) => v && String(v).trim())),
    }));
}

export function normalizePriceBySizeField(arr) {
  if (!Array.isArray(arr)) {
    return [];
  }
  return arr
    .filter((row) => row && typeof row === 'object')
    .map((row) => ({
      price: Number(row.price || 0),
      size: String(row.size || '').trim(),
      unit: String(row.unit || '').trim(),
    }))
    .filter((row) => Number.isFinite(row.price) && row.price > 0);
}

export function normalizeDetailPhotosField(arr) {
  if (!Array.isArray(arr)) {
    return [];
  }
  return arr.map(String).filter(Boolean).slice(0, 3);
}

export function normalizeTestimonialsField(arr) {
  if (!Array.isArray(arr)) {
    return [];
  }
  return arr
    .filter((t) => t && typeof t === 'object')
    .map((t) => ({
      quote: String(t.quote || '').trim(),
      authorName: String(t.authorName || '').trim(),
      authorRole: String(t.authorRole || '').trim(),
      companyName: String(t.companyName || '').trim(),
      companyLogo: String(t.companyLogo || '').trim(),
    }))
    .filter((t) => t.quote);
}

export function normalizeFaqsField(arr) {
  if (!Array.isArray(arr)) {
    return [];
  }
  return arr
    .filter((f) => f && typeof f === 'object')
    .map((f) => ({
      question: String(f.question || '').trim(),
      answer: String(f.answer || '').trim(),
    }))
    .filter((f) => f.question && f.answer);
}

export function normalizeIdArrayField(arr) {
  if (!Array.isArray(arr)) {
    return [];
  }
  return arr.filter((id) => id && String(id).trim() !== '');
}

/**
 * Full create payload (POST) — same defaults as legacy route.
 */
export function normalizeProductPayloadForCreate(data) {
  stripVariantRows(data);
  normalizeCategoryAndBrandRefs(data, { partial: false });

  if (data.price === undefined || data.price === null || data.price === '') {
    data.price = 0;
  }
  if (!data.status) {
    data.status = 'In Stock';
  }

  data.filters = normalizeFiltersField(data.filters);

  if (!data.tags) {
    data.tags = [];
  }

  data.priceBySize = normalizePriceBySizeField(data.priceBySize);

  if (data.availableSizes === undefined || data.availableSizes === null) {
    data.availableSizes = '';
  } else {
    data.availableSizes = String(data.availableSizes).trim();
  }

  if (!data.gallery) {
    data.gallery = [];
  }
  if (!data.detailPhotos) {
    data.detailPhotos = [];
  } else if (!Array.isArray(data.detailPhotos)) {
    data.detailPhotos = [];
  } else {
    data.detailPhotos = normalizeDetailPhotosField(data.detailPhotos);
  }

  if (!data.specifications) {
    data.specifications = [];
  }

  if (!data.testimonials) {
    data.testimonials = [];
  } else if (!Array.isArray(data.testimonials)) {
    data.testimonials = [];
  } else {
    data.testimonials = normalizeTestimonialsField(data.testimonials);
  }

  if (!data.faqs) {
    data.faqs = [];
  } else if (!Array.isArray(data.faqs)) {
    data.faqs = [];
  } else {
    data.faqs = normalizeFaqsField(data.faqs);
  }

  if (!data.colorVariants) {
    data.colorVariants = [];
  }
  if (!data.businessTypeSlugs) {
    data.businessTypeSlugs = [];
  }
  if (!data.relatedProductIds) {
    data.relatedProductIds = [];
  }
  if (!data.frequentlyOrderedTogetherProductIds) {
    data.frequentlyOrderedTogetherProductIds = [];
  } else if (!Array.isArray(data.frequentlyOrderedTogetherProductIds)) {
    data.frequentlyOrderedTogetherProductIds = [];
  } else {
    data.frequentlyOrderedTogetherProductIds = normalizeIdArrayField(data.frequentlyOrderedTogetherProductIds);
  }
}

/**
 * Partial update (PUT) — only keys present on `data` are normalized (except slug
 * removal which stays in the route).
 */
export function normalizeProductPayloadForUpdate(data) {
  stripVariantRows(data);
  normalizeCategoryAndBrandRefs(data, { partial: true });

  if (Object.prototype.hasOwnProperty.call(data, 'availableSizes')) {
    if (data.availableSizes === null || data.availableSizes === '') {
      data.availableSizes = '';
    } else {
      data.availableSizes = String(data.availableSizes).trim();
    }
  }

  if (Object.prototype.hasOwnProperty.call(data, 'detailPhotos')) {
    if (!Array.isArray(data.detailPhotos)) {
      data.detailPhotos = [];
    } else {
      data.detailPhotos = normalizeDetailPhotosField(data.detailPhotos);
    }
  }

  if (Object.prototype.hasOwnProperty.call(data, 'faqs')) {
    if (!Array.isArray(data.faqs)) {
      data.faqs = [];
    } else {
      data.faqs = normalizeFaqsField(data.faqs);
    }
  }

  if (Object.prototype.hasOwnProperty.call(data, 'frequentlyOrderedTogetherProductIds')) {
    if (!Array.isArray(data.frequentlyOrderedTogetherProductIds)) {
      data.frequentlyOrderedTogetherProductIds = [];
    } else {
      data.frequentlyOrderedTogetherProductIds = normalizeIdArrayField(data.frequentlyOrderedTogetherProductIds);
    }
  }

  if (Object.prototype.hasOwnProperty.call(data, 'testimonials')) {
    if (!Array.isArray(data.testimonials)) {
      data.testimonials = [];
    } else {
      data.testimonials = normalizeTestimonialsField(data.testimonials);
    }
  }

  if (Object.prototype.hasOwnProperty.call(data, 'filters')) {
    data.filters = normalizeFiltersField(data.filters);
  }

  if (Object.prototype.hasOwnProperty.call(data, 'priceBySize')) {
    data.priceBySize = normalizePriceBySizeField(data.priceBySize);
  }

  if (Object.prototype.hasOwnProperty.call(data, 'tags')) {
    if (!data.tags) {
      data.tags = [];
    }
  }

  if (Object.prototype.hasOwnProperty.call(data, 'gallery')) {
    if (!data.gallery) {
      data.gallery = [];
    }
  }

  if (Object.prototype.hasOwnProperty.call(data, 'specifications')) {
    if (!data.specifications) {
      data.specifications = [];
    }
  }

  if (Object.prototype.hasOwnProperty.call(data, 'colorVariants')) {
    if (!data.colorVariants) {
      data.colorVariants = [];
    }
  }

  if (Object.prototype.hasOwnProperty.call(data, 'businessTypeSlugs')) {
    if (!data.businessTypeSlugs) {
      data.businessTypeSlugs = [];
    }
  }

  if (Object.prototype.hasOwnProperty.call(data, 'relatedProductIds')) {
    if (!data.relatedProductIds || !Array.isArray(data.relatedProductIds)) {
      data.relatedProductIds = [];
    } else {
      data.relatedProductIds = normalizeIdArrayField(data.relatedProductIds);
    }
  }
}
