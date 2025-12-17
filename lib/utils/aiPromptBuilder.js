/**
 * AI Prompt Builder Utility
 * 
 * Builds structured prompts for AI description generation
 * using product data (title, brand, category, specs, tags, etc.)
 */

/**
 * Gets category name from ID (including hierarchy)
 */
async function getCategoryName(categoryId, Category) {
  if (!categoryId) return null;
  
  const category = await Category.findById(categoryId).lean();
  if (!category) return null;
  
  // Build full path: Department > Category > Subcategory > Type
  const path = [category.name];
  let current = category;
  
  while (current.parent) {
    const parent = await Category.findById(current.parent).lean();
    if (parent) {
      path.unshift(parent.name);
      current = parent;
    } else {
      break;
    }
  }
  
  return path.join(' > ');
}

/**
 * Gets brand name from ID (including hierarchy)
 */
async function getBrandName(brandId, Brand) {
  if (!brandId) return null;
  
  const brand = await Brand.findById(brandId).lean();
  if (!brand) return null;
  
  // Build full path: Department > Category > Subcategory
  const path = [brand.name];
  let current = brand;
  
  while (current.parent) {
    const parent = await Brand.findById(current.parent).lean();
    if (parent) {
      path.unshift(parent.name);
      current = parent;
    } else {
      break;
    }
  }
  
  return path.join(' > ');
}

/**
 * Gets business type names from slugs
 */
async function getBusinessTypeNames(businessTypeSlugs, BusinessType) {
  if (!businessTypeSlugs || businessTypeSlugs.length === 0) return [];
  
  const businessTypes = await BusinessType.find({
    slug: { $in: businessTypeSlugs }
  }).lean();
  
  return businessTypes.map(bt => bt.name);
}

/**
 * Formats specifications for prompt
 */
function formatSpecifications(specifications) {
  if (!specifications || specifications.length === 0) return 'None specified';
  
  return specifications
    .map(spec => {
      const parts = [spec.label || 'Specification', spec.value || ''];
      if (spec.unit) parts.push(spec.unit);
      return parts.filter(Boolean).join(': ');
    })
    .join('\n- ');
}

/**
 * Formats filters for prompt
 */
function formatFilters(filters) {
  if (!filters || filters.length === 0) return 'None specified';
  
  return filters
    .map(filter => {
      if (!filter.key || !filter.values || filter.values.length === 0) return null;
      return `${filter.key}: ${filter.values.join(', ')}`;
    })
    .filter(Boolean)
    .join('\n- ');
}

/**
 * Builds a structured prompt for AI description generation
 * 
 * @param {Object} productData - Product data object
 * @param {string} mode - 'generate' or 'enhance'
 * @param {string} field - 'summary' or 'description'
 * @param {string} existingText - Existing text (for enhance mode)
 * @returns {Promise<string>} Formatted prompt
 */
export async function buildAIPrompt(productData, mode, field, existingText = '') {
  const { connectToDatabase } = await import('@/lib/db/connect');
  await connectToDatabase();
  
  const Category = (await import('@/lib/models/Category')).default;
  const Brand = (await import('@/lib/models/Brand')).default;
  const BusinessType = (await import('@/lib/models/BusinessType')).default;
  
  // Extract product information
  const title = productData.title || 'Product';
  const brand = productData.brand || '';
  const sku = productData.sku || '';
  
  // Get category name
  let categoryName = null;
  if (productData.categoryId) {
    categoryName = await getCategoryName(productData.categoryId, Category);
  }
  
  // Get brand category name
  let brandCategoryName = null;
  if (productData.brandCategoryId) {
    brandCategoryName = await getBrandName(productData.brandCategoryId, Brand);
  }
  
  // Get business types
  const businessTypeNames = await getBusinessTypeNames(
    productData.businessTypeSlugs || [],
    BusinessType
  );
  
  // Format specifications
  const specsText = formatSpecifications(productData.specifications || []);
  
  // Format filters
  const filtersText = formatFilters(productData.filters || []);
  
  // Format tags
  const tagsText = (productData.tags || []).length > 0
    ? productData.tags.join(', ')
    : 'None specified';
  
  // Build prompt based on mode
  if (mode === 'generate') {
    const fieldType = field === 'summary' ? 'short description (2-3 lines)' : 'long description (150-200 words)';
    
    return `You are writing a professional product description for a Horeca equipment catalog.

Product Information:
- Product name: ${title}
- Brand: ${brand || 'Not specified'}
${brandCategoryName ? `- Brand category: ${brandCategoryName}` : ''}
${categoryName ? `- Product category: ${categoryName}` : ''}
${businessTypeNames.length > 0 ? `- Used for: ${businessTypeNames.join(', ')}` : ''}
${sku ? `- SKU: ${sku}` : ''}
${tagsText !== 'None specified' ? `- Key features/tags: ${tagsText}` : ''}
${specsText !== 'None specified' ? `- Specifications:\n  - ${specsText}` : ''}
${filtersText !== 'None specified' ? `- Filters:\n  - ${filtersText}` : ''}

Write a ${fieldType} for this product.

Requirements:
- Professional and clear tone
- Suitable for business buyers (restaurants, hotels, cafes, etc.)
- Highlight key features and benefits
- No prices mentioned
- No emojis
- Focus on quality, durability, and commercial use
${field === 'description' ? '- Include details about materials, dimensions, and usage scenarios' : '- Keep it concise and impactful'}

Generate the ${fieldType} now:`;
  } else {
    // Enhance mode
    return `Improve and professionally rewrite the following product description.

Keep the meaning the same but make it clearer, more structured, and more appealing for Horeca business buyers.

Product Context:
- Product name: ${title}
- Brand: ${brand || 'Not specified'}
${brandCategoryName ? `- Brand category: ${brandCategoryName}` : ''}
${categoryName ? `- Product category: ${categoryName}` : ''}
${businessTypeNames.length > 0 ? `- Used for: ${businessTypeNames.join(', ')}` : ''}
${tagsText !== 'None specified' ? `- Key features: ${tagsText}` : ''}

Current Description:
"""
${existingText}
"""

Requirements:
- Maintain the original meaning and key information
- Improve clarity and structure
- Make it more professional and appealing
- Suitable for business buyers
- No prices mentioned
- No emojis
- Better formatting and flow

Provide the improved version:`;
  }
}

