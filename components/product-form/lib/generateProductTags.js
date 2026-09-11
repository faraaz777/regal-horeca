/**
 * Auto-tags from title, brand, SKU, taxonomy, filters, specs, colours, and featured.
 * Used for search — tags are not catalog sidebar filters.
 */

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does',
  'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that',
  'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who',
  'whom', 'whose', 'where', 'when', 'why', 'how', 'all', 'each', 'every', 'both', 'few',
  'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
  'than', 'too', 'very', 's', 't', 'just', 'don', 'now',
]);

export function normalizeTag(tag) {
  if (!tag || typeof tag !== 'string') return null;
  return tag.toLowerCase().trim();
}

function splitCompoundValue(value) {
  if (!value || typeof value !== 'string') return [];
  const normalized = value.toLowerCase().trim();
  if (!normalized) return [];

  const parts = new Set([normalized]);
  const numbers = normalized.match(/\d+(\.\d+)?/g);
  if (numbers) numbers.forEach((num) => parts.add(num));

  const words = normalized.match(/[a-z]+/gi);
  if (words) {
    words.forEach((word) => {
      if (word.length > 1) parts.add(word.toLowerCase());
    });
  }

  const compound = normalized.match(/(\d+)\s*[-]?\s*([a-z]+)/gi);
  if (compound) {
    compound.forEach((comp) => parts.add(comp.replace(/\s+/g, '')));
  }

  return Array.from(parts).filter(Boolean);
}

function extractKeywordsFromTitle(title) {
  if (!title || typeof title !== 'string') return [];
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function extractCategoryTags(categoryId, categoryIds, categories) {
  const tags = new Set();

  const extractCategoryName = (catId) => {
    if (!catId) return;
    const category = categories.find((c) => {
      const cId = c._id || c.id;
      return cId?.toString() === catId.toString();
    });
    if (category) {
      tags.add(category.name.toLowerCase().trim());
      const parentId = category.parent?._id || category.parent;
      if (parentId) extractCategoryName(parentId);
    }
  };

  if (categoryId) extractCategoryName(categoryId);
  if (Array.isArray(categoryIds)) categoryIds.forEach((catId) => extractCategoryName(catId));
  return Array.from(tags);
}

function extractBrandCategoryTags(brandCategoryId, brandCategoryIds, brands) {
  const tags = new Set();

  const extractBrandName = (brandId) => {
    if (!brandId) return;
    const brand = brands.find((b) => {
      const bId = b._id || b.id;
      return bId?.toString() === brandId.toString();
    });
    if (brand) {
      tags.add(brand.name.toLowerCase().trim());
      const parentId = brand.parent?._id || brand.parent;
      if (parentId) extractBrandName(parentId);
    }
  };

  if (brandCategoryId) extractBrandName(brandCategoryId);
  if (Array.isArray(brandCategoryIds)) brandCategoryIds.forEach((id) => extractBrandName(id));
  return Array.from(tags);
}

function extractFilterTags(filters) {
  const tags = new Set();
  if (!Array.isArray(filters)) return Array.from(tags);

  filters.forEach((filter) => {
    if (filter.key && Array.isArray(filter.values)) {
      filter.values.forEach((value) => {
        if (value && value.trim()) {
          const normalized = normalizeTag(value);
          if (normalized) {
            tags.add(normalized);
            tags.add(`${normalizeTag(filter.key)}-${normalized}`);
            splitCompoundValue(value).forEach((part) => {
              if (part && part !== normalized) tags.add(part);
            });
          }
        }
      });
    }
  });
  return Array.from(tags);
}

function extractSpecificationTags(specifications) {
  const tags = new Set();
  if (!Array.isArray(specifications)) return Array.from(tags);

  specifications.forEach((spec) => {
    if (spec.value && spec.value.trim()) {
      const normalizedValue = normalizeTag(spec.value);
      if (normalizedValue) {
        tags.add(normalizedValue);
        if (spec.label && spec.label.trim()) {
          tags.add(`${normalizeTag(spec.label)}-${normalizedValue}`);
        }
        splitCompoundValue(spec.value).forEach((part) => {
          if (part && part !== normalizedValue) tags.add(part);
        });
      }
    }
    if (spec.unit && spec.unit.trim()) {
      const normalizedUnit = normalizeTag(spec.unit);
      if (normalizedUnit) tags.add(normalizedUnit);
    }
  });
  return Array.from(tags);
}

export function generateTags(formData, categories, brands, businessTypes) {
  const tags = new Set();

  extractKeywordsFromTitle(formData.title).forEach((keyword) => tags.add(keyword));

  if (formData.brand && formData.brand.trim()) {
    const brandTag = normalizeTag(formData.brand);
    if (brandTag) tags.add(brandTag);
  }

  if (formData.sku && formData.sku.trim()) {
    const skuTag = normalizeTag(formData.sku);
    if (skuTag) tags.add(skuTag);
  }

  extractCategoryTags(formData.categoryId, formData.categoryIds, categories).forEach((tag) =>
    tags.add(tag)
  );
  extractBrandCategoryTags(formData.brandCategoryId, formData.brandCategoryIds, brands).forEach(
    (tag) => tags.add(tag)
  );
  extractFilterTags(formData.filters).forEach((tag) => tags.add(tag));
  extractSpecificationTags(formData.specifications).forEach((tag) => tags.add(tag));

  if (Array.isArray(formData.colorVariants)) {
    formData.colorVariants.forEach((variant) => {
      if (variant.colorName && variant.colorName.trim()) {
        const colorTag = normalizeTag(variant.colorName);
        if (colorTag) tags.add(colorTag);
      }
    });
  }

  if (Array.isArray(formData.businessTypeSlugs) && Array.isArray(businessTypes)) {
    formData.businessTypeSlugs.forEach((slug) => {
      const businessType = businessTypes.find((bt) => bt.slug === slug);
      if (businessType && businessType.name) {
        const btTag = normalizeTag(businessType.name);
        if (btTag) tags.add(btTag);
      }
    });
  }

  if (formData.featured) tags.add('featured');

  return Array.from(tags)
    .filter((tag) => tag && tag.trim().length > 0)
    .sort();
}
