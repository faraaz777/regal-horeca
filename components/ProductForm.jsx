/**
 * Product Form Component
 * 
 * Comprehensive product creation/editing form with:
 * - Image uploads to Cloudflare R2
 * - Category hierarchy selection
 * - Color variants management
 * - Specifications management
 * - Related products with auto-suggestions
 * - All product metadata fields
 */

'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useAppContext } from '@/context/AppContext';
import { PlusIcon, TrashIcon, MagicIcon, StarIcon } from './Icons';
import Image from 'next/image';
import ColorPicker from './ColorPicker';

const AVAILABLE_COLORS = [
  { name: 'Blue', hex: '#0000FF' }, 
  { name: 'Green', hex: '#008000' }, 
  { name: 'Red', hex: '#FF0000' },
  { name: 'Yellow', hex: '#FFFF00' }, 
  { name: 'Purple', hex: '#800080' }, 
  { name: 'Orange', hex: '#FFA500' },
  { name: 'Pink', hex: '#FFC0CB' }, 
  { name: 'Brown', hex: '#A52A2A' }, 
  { name: 'Gray', hex: '#808080' },
  { name: 'Black', hex: '#000000' }, 
  { name: 'White', hex: '#FFFFFF' }, 
  { name: 'Silver', hex: '#C0C0C0' }
];

/**
 * Uploads a file to Cloudflare R2 via the API
 */
async function uploadToR2(file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/upload?folder=products', {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();
  
  if (!response.ok || !data.success) {
    const errorMessage = data.error || 'Upload failed';
    const errorDetails = data.details ? `: ${data.details}` : '';
    throw new Error(`${errorMessage}${errorDetails}`);
  }

  return data.url;
}

/**
 * Gets category ancestry (all parent categories)
 */
function getCategoryAncestry(categoryId, categories) {
  const ancestry = {};
  let current = categories.find(c => {
    const cId = c._id || c.id;
    return cId?.toString() === categoryId?.toString();
  });
  
  while (current) {
    ancestry[current.level] = current._id || current.id;
    const parentId = current.parent?._id || current.parent;
    if (parentId) {
      current = categories.find(c => {
        const cId = c._id || c.id;
        return cId?.toString() === parentId.toString();
      });
    } else {
      break;
    }
  }
  return ancestry;
}

/**
 * Stop words to filter out from title keywords
 */
const STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should', 'now']);

/**
 * Normalize a tag: lowercase, trim, and filter empty strings
 */
function normalizeTag(tag) {
  if (!tag || typeof tag !== 'string') return null;
  return tag.toLowerCase().trim();
}

/**
 * Split compound values into parts (e.g., "30cm" → ["30cm", "30", "cm"])
 */
function splitCompoundValue(value) {
  if (!value || typeof value !== 'string') return [];
  const normalized = value.toLowerCase().trim();
  if (!normalized) return [];
  
  const parts = new Set([normalized]); // Always include the full value
  
  // Extract numbers
  const numbers = normalized.match(/\d+(\.\d+)?/g);
  if (numbers) {
    numbers.forEach(num => parts.add(num));
  }
  
  // Extract alphabetic parts
  const words = normalized.match(/[a-z]+/gi);
  if (words) {
    words.forEach(word => {
      if (word.length > 1) parts.add(word.toLowerCase());
    });
  }
  
  // Extract combinations like "30-cm", "30cm", "30 cm"
  const compound = normalized.match(/(\d+)\s*[-]?\s*([a-z]+)/gi);
  if (compound) {
    compound.forEach(comp => parts.add(comp.replace(/\s+/g, '')));
  }
  
  return Array.from(parts).filter(Boolean);
}

/**
 * Extract keywords from title (remove stop words, split into words)
 */
function extractKeywordsFromTitle(title) {
  if (!title || typeof title !== 'string') return [];
  
  // Split by spaces, punctuation, and special characters
  const words = title
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word));
  
  return words.filter(Boolean);
}

/**
 * Extract category names from category IDs (including hierarchy)
 */
function extractCategoryTags(categoryId, categoryIds, categories) {
  const tags = new Set();
  
  const extractCategoryName = (catId) => {
    if (!catId) return;
    const category = categories.find(c => {
      const cId = c._id || c.id;
      return cId?.toString() === catId.toString();
    });
    
    if (category) {
      tags.add(category.name.toLowerCase().trim());
      
      // Also add parent categories recursively
      const parentId = category.parent?._id || category.parent;
      if (parentId) {
        extractCategoryName(parentId);
      }
    }
  };
  
  // Extract from primary category
  if (categoryId) {
    extractCategoryName(categoryId);
  }
  
  // Extract from additional categories
  if (Array.isArray(categoryIds)) {
    categoryIds.forEach(catId => extractCategoryName(catId));
  }
  
  return Array.from(tags);
}

/**
 * Extract brand category names
 */
function extractBrandCategoryTags(brandCategoryId, brandCategoryIds, brands) {
  const tags = new Set();
  
  const extractBrandName = (brandId) => {
    if (!brandId) return;
    const brand = brands.find(b => {
      const bId = b._id || b.id;
      return bId?.toString() === brandId.toString();
    });
    
    if (brand) {
      tags.add(brand.name.toLowerCase().trim());
      
      // Also add parent brands recursively
      const parentId = brand.parent?._id || brand.parent;
      if (parentId) {
        extractBrandName(parentId);
      }
    }
  };
  
  // Extract from primary brand category
  if (brandCategoryId) {
    extractBrandName(brandCategoryId);
  }
  
  // Extract from additional brand categories
  if (Array.isArray(brandCategoryIds)) {
    brandCategoryIds.forEach(brandId => extractBrandName(brandId));
  }
  
  return Array.from(tags);
}

/**
 * Extract tags from filters
 */
function extractFilterTags(filters) {
  const tags = new Set();
  
  if (!Array.isArray(filters)) return Array.from(tags);
  
  filters.forEach(filter => {
    if (filter.key && Array.isArray(filter.values)) {
      filter.values.forEach(value => {
        if (value && value.trim()) {
          const normalized = normalizeTag(value);
          if (normalized) {
            tags.add(normalized);
            // Add key-value combination
            tags.add(`${normalizeTag(filter.key)}-${normalized}`);
            
            // Split compound values
            const compoundParts = splitCompoundValue(value);
            compoundParts.forEach(part => {
              if (part && part !== normalized) tags.add(part);
            });
          }
        }
      });
    }
  });
  
  return Array.from(tags);
}

/**
 * Extract tags from specifications
 */
function extractSpecificationTags(specifications) {
  const tags = new Set();
  
  if (!Array.isArray(specifications)) return Array.from(tags);
  
  specifications.forEach(spec => {
    if (spec.value && spec.value.trim()) {
      const normalizedValue = normalizeTag(spec.value);
      if (normalizedValue) {
        tags.add(normalizedValue);
        
        // Add key-value combination if label exists
        if (spec.label && spec.label.trim()) {
          const normalizedLabel = normalizeTag(spec.label);
          tags.add(`${normalizedLabel}-${normalizedValue}`);
        }
        
        // Split compound values (e.g., "30cm" → ["30cm", "30", "cm"])
        const compoundParts = splitCompoundValue(spec.value);
        compoundParts.forEach(part => {
          if (part && part !== normalizedValue) tags.add(part);
        });
      }
    }
    
    // Also add unit if it exists
    if (spec.unit && spec.unit.trim()) {
      const normalizedUnit = normalizeTag(spec.unit);
      if (normalizedUnit) tags.add(normalizedUnit);
    }
  });
  
  return Array.from(tags);
}

/**
 * Auto-generate tags from all product fields
 */
function generateTags(formData, categories, brands, businessTypes) {
  const tags = new Set();
  
  // 1. Extract from title
  const titleKeywords = extractKeywordsFromTitle(formData.title);
  titleKeywords.forEach(keyword => tags.add(keyword));
  
  // 2. Add brand
  if (formData.brand && formData.brand.trim()) {
    const brandTag = normalizeTag(formData.brand);
    if (brandTag) tags.add(brandTag);
  }
  
  // 3. Add SKU
  if (formData.sku && formData.sku.trim()) {
    const skuTag = normalizeTag(formData.sku);
    if (skuTag) tags.add(skuTag);
  }
  
  // 4. Extract from categories (including hierarchy)
  const categoryTags = extractCategoryTags(formData.categoryId, formData.categoryIds, categories);
  categoryTags.forEach(tag => tags.add(tag));
  
  // 5. Extract from brand categories
  const brandCategoryTags = extractBrandCategoryTags(formData.brandCategoryId, formData.brandCategoryIds, brands);
  brandCategoryTags.forEach(tag => tags.add(tag));
  
  // 6. Extract from filters
  const filterTags = extractFilterTags(formData.filters);
  filterTags.forEach(tag => tags.add(tag));
  
  // 7. Extract from specifications
  const specTags = extractSpecificationTags(formData.specifications);
  specTags.forEach(tag => tags.add(tag));
  
  // 8. Extract from color variants
  if (Array.isArray(formData.colorVariants)) {
    formData.colorVariants.forEach(variant => {
      if (variant.colorName && variant.colorName.trim()) {
        const colorTag = normalizeTag(variant.colorName);
        if (colorTag) tags.add(colorTag);
      }
    });
  }
  
  // 9. Extract from business types
  if (Array.isArray(formData.businessTypeSlugs) && Array.isArray(businessTypes)) {
    formData.businessTypeSlugs.forEach(slug => {
      const businessType = businessTypes.find(bt => bt.slug === slug);
      if (businessType && businessType.name) {
        const btTag = normalizeTag(businessType.name);
        if (btTag) tags.add(btTag);
      }
    });
  }
  
  // 10. Add featured tag
  if (formData.featured) {
    tags.add('featured');
  }
  
  // Filter out empty strings and return sorted array
  return Array.from(tags)
    .filter(tag => tag && tag.trim().length > 0)
    .sort();
}

/**
 * Moved OUTSIDE ProductForm so it's not recreated every render.
 * This prevents inputs inside from losing focus on each keystroke.
 */
const FormSection = ({ title, children }) => (
  <div className="bg-white p-5 sm:p-6 border border-gray-200 rounded-lg shadow-sm">
    <h3 className="text-base sm:text-lg font-semibold mb-4 sm:mb-5 text-gray-800 border-b border-gray-200 pb-2">{title}</h3>
    <div className="space-y-4">{children}</div>
  </div>
);

export default function ProductForm({ product, allProducts, onSave, onCancel }) {
  const { categories, brands, businessTypes } = useAppContext();
  
  const [formData, setFormData] = useState({
    title: '',
    brand: '',
    sku: '',
    brandCategoryId: '',
    brandCategoryIds: [],
    categoryId: '',
    categoryIds: [],
    summary: '',
    description: '',
    price: 0,
    businessTypeSlugs: [],
    heroImage: '',
    gallery: [],
    specifications: [],
    relatedProductIds: [],
    featured: false,
    isPremium: false,
    tags: [],
    tagsInput: '',
    status: 'In Stock',
    colorVariants: [],
    filters: [{ key: 'Material', values: [] }, { key: 'Size', values: [] }],
  });

  const [isUploading, setIsUploading] = useState(false);
  const [categorySelection, setCategorySelection] = useState({});
  const [additionalCategorySelections, setAdditionalCategorySelections] = useState([]);
  const [brandSelection, setBrandSelection] = useState({});
  const [additionalBrandSelections, setAdditionalBrandSelections] = useState([]);
  const [brandSuggestions, setBrandSuggestions] = useState([]);
  const [showBrandSuggestions, setShowBrandSuggestions] = useState(false);
  const [brandInputFocused, setBrandInputFocused] = useState(false);
  const brandInputRef = useRef(null);
  const brandSuggestionsRef = useRef(null);
  const [error, setError] = useState('');
  const initializedProductIdRef = useRef(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [customColorHex, setCustomColorHex] = useState('#000000');
  const [customColorName, setCustomColorName] = useState('');
  const [generatedTagsPreview, setGeneratedTagsPreview] = useState([]);
  const [showTagsPreview, setShowTagsPreview] = useState(false);
  const autoTagDebounceRef = useRef(null);
  
  // AI generation state
  const [aiLoading, setAiLoading] = useState({ summary: false, description: false });
  const [aiCooldown, setAiCooldown] = useState({ summary: false, description: false });
  const lastAiCallRef = useRef({ summary: 0, description: 0 });
  
  // Reset color picker state when opening
  const handleOpenColorPicker = () => {
    setCustomColorHex('#000000');
    setCustomColorName('');
    setError('');
    setShowColorPicker(true);
  };

  /**
   * Handle auto-generate tags button click
   */
  const handleAutoGenerateTags = () => {
    const generatedTags = generateTags(formData, categories, brands, businessTypes);
    
    // Merge with existing tags
    const existingTags = formData.tagsInput 
      ? formData.tagsInput.split(',').map(t => normalizeTag(t)).filter(Boolean)
      : [];
    
    // Combine and remove duplicates
    const allTags = Array.from(new Set([...existingTags, ...generatedTags]));
    
    // Update form data
    setFormData(prev => ({
      ...prev,
      tagsInput: allTags.join(', ')
    }));
    
    // Show preview
    setGeneratedTagsPreview(generatedTags);
    setShowTagsPreview(true);
    
    // Auto-hide preview after 5 seconds
    setTimeout(() => {
      setShowTagsPreview(false);
    }, 5000);
  };

  /**
   * Handle AI description generation/enhancement
   */
  const handleAIGenerate = async (field) => {
    // Check cooldown (2 seconds between calls)
    const now = Date.now();
    const lastCall = lastAiCallRef.current[field] || 0;
    const timeSinceLastCall = now - lastCall;
    
    if (timeSinceLastCall < 2000) {
      const remaining = Math.ceil((2000 - timeSinceLastCall) / 1000);
      setError(`Please wait ${remaining} second${remaining > 1 ? 's' : ''} before generating again.`);
      setTimeout(() => setError(''), 3000);
      return;
    }

    // Validate minimum product data
    if (!formData.title || formData.title.trim().length < 3) {
      setError('Please enter a product title first (at least 3 characters).');
      setTimeout(() => setError(''), 3000);
      return;
    }

    // Determine mode: generate if empty/minimal, enhance if substantial text exists
    const currentText = field === 'summary' ? formData.summary : formData.description;
    const hasSubstantialText = currentText && currentText.trim().length > 20;
    const mode = hasSubstantialText ? 'enhance' : 'generate';

    // Set loading state
    setAiLoading(prev => ({ ...prev, [field]: true }));
    setError('');
    lastAiCallRef.current[field] = now;

    try {
      // Prepare product data for API
      const productDataForAI = {
        title: formData.title,
        brand: formData.brand || '',
        categoryId: formData.categoryId || '',
        brandCategoryId: formData.brandCategoryId || '',
        sku: formData.sku || '',
        specifications: formData.specifications || [],
        filters: formData.filters || [],
        tags: formData.tagsInput 
          ? formData.tagsInput.split(',').map(t => t.trim()).filter(Boolean)
          : (formData.tags || []),
        businessTypeSlugs: formData.businessTypeSlugs || [],
      };

      // Call AI API
      const response = await fetch('/api/ai/generate-description', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          field,
          mode,
          productData: productDataForAI,
          existingText: currentText || '',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate description');
      }

      if (!data.success || !data.text) {
        throw new Error('AI returned empty response');
      }

      // Update form data with generated text
      setFormData(prev => ({
        ...prev,
        [field]: data.text,
      }));

      // Set cooldown state
      setAiCooldown(prev => ({ ...prev, [field]: true }));
      setTimeout(() => {
        setAiCooldown(prev => ({ ...prev, [field]: false }));
      }, 2000);

    } catch (error) {
      console.error('AI generation error:', error);
      setError(error.message || 'Failed to generate description. Please try again.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setAiLoading(prev => ({ ...prev, [field]: false }));
    }
  };

  /**
   * Auto-trigger tag generation on field changes (debounced)
   * Only updates if tags are empty or minimal (non-intrusive)
   */
  useEffect(() => {
    // Clear previous debounce timer
    if (autoTagDebounceRef.current) {
      clearTimeout(autoTagDebounceRef.current);
    }
    
    // Don't auto-generate if user is manually editing tags or preview is shown
    if (showTagsPreview) return;
    
    // Check if user has manually added substantial tags
    const existingTags = formData.tagsInput 
      ? formData.tagsInput.split(',').map(t => normalizeTag(t)).filter(Boolean)
      : [];
    
    // If user has added 3+ tags manually, don't auto-trigger
    if (existingTags.length >= 3) return;
    
    // Debounce auto-generation by 3 seconds (longer delay to be less intrusive)
    autoTagDebounceRef.current = setTimeout(() => {
      // Only auto-generate if form has substantial data
      if (formData.title && formData.title.trim().length > 3) {
        const generatedTags = generateTags(formData, categories, brands, businessTypes);
        if (generatedTags.length > 0) {
          // Re-check existing tags (user might have edited in the meantime)
          const currentTags = formData.tagsInput 
            ? formData.tagsInput.split(',').map(t => normalizeTag(t)).filter(Boolean)
            : [];
          
          // Only update if tags input is still empty or minimal
          if (currentTags.length <= 2) {
            const allTags = Array.from(new Set([...currentTags, ...generatedTags]));
            setFormData(prev => ({
              ...prev,
              tagsInput: allTags.join(', ')
            }));
          }
        }
      }
    }, 3000);
    
    return () => {
      if (autoTagDebounceRef.current) {
        clearTimeout(autoTagDebounceRef.current);
      }
    };
  }, [
    formData.title,
    formData.brand,
    formData.sku,
    formData.categoryId,
    formData.categoryIds,
    formData.brandCategoryId,
    formData.brandCategoryIds,
    formData.filters,
    formData.specifications,
    formData.colorVariants,
    formData.businessTypeSlugs,
    formData.featured,
    formData.tagsInput, // Include to check if user manually edited
    categories,
    brands,
    businessTypes,
    showTagsPreview
  ]);

  // Helper function to get brand ancestry (similar to category ancestry)
  function getBrandAncestry(brandId, brands) {
    const ancestry = {};
    let current = brands.find(b => {
      const bId = b._id || b.id;
      return bId?.toString() === brandId?.toString();
    });
    
    while (current) {
      ancestry[current.level] = current._id || current.id;
      const parentId = current.parent?._id || current.parent;
      if (parentId) {
        current = brands.find(b => {
          const bId = b._id || b.id;
          return bId?.toString() === parentId.toString();
        });
      } else {
        break;
      }
    }
    return ancestry;
  }

  // Initialize form data when product is provided (edit mode) - only once per product
  useEffect(() => {
    const currentProductId = product?._id || product?.id;
    
    if (product && initializedProductIdRef.current !== currentProductId) {
      const categoryId = product.categoryId?._id || product.categoryId;
      const categoryIds = product.categoryIds || [];
      const brandCategoryId = product.brandCategoryId?._id || product.brandCategoryId;
      const brandCategoryIds = product.brandCategoryIds || [];
      
      // Convert old filter format to new format if needed
      let filters = product.filters || [];
      if (Array.isArray(filters) && filters.length === 0) {
        // If empty array, initialize with defaults
        filters = [{ key: 'Material', values: [] }, { key: 'Size', values: [] }];
      } else if (!Array.isArray(filters)) {
        // Convert old format {material: [], color: [], usage: []} to new format
        filters = [];
        if (product.filters?.material && product.filters.material.length > 0) {
          filters.push({ key: 'Material', values: product.filters.material });
        }
        if (product.filters?.size && product.filters.size.length > 0) {
          filters.push({ key: 'Size', values: product.filters.size });
        }
        // Add any other filters
        Object.keys(product.filters || {}).forEach(key => {
          if (key !== 'material' && key !== 'size' && key !== 'color' && key !== 'usage' && product.filters[key]?.length > 0) {
            filters.push({ key: key.charAt(0).toUpperCase() + key.slice(1), values: product.filters[key] });
          }
        });
        // If no filters found, use defaults
        if (filters.length === 0) {
          filters = [{ key: 'Material', values: [] }, { key: 'Size', values: [] }];
        }
      }
      
      setFormData({
        ...product,
        categoryId: categoryId?.toString() || '',
        categoryIds: categoryIds.map(cid => (cid?._id || cid)?.toString()).filter(Boolean),
        brandCategoryId: brandCategoryId?.toString() || '',
        brandCategoryIds: brandCategoryIds.map(bid => (bid?._id || bid)?.toString()).filter(Boolean),
        tagsInput: (product.tags || []).join(', '),
        filters: filters,
      });

      if (categoryId && categories.length > 0) {
        const ancestry = getCategoryAncestry(categoryId, categories);
        setCategorySelection(ancestry);
      }

      // Initialize additional category selections
      if (categoryIds.length > 0 && categories.length > 0) {
        const additionalSelections = categoryIds.map(cid => {
          const id = cid?._id || cid;
          return getCategoryAncestry(id, categories);
        });
        setAdditionalCategorySelections(additionalSelections);
      } else {
        setAdditionalCategorySelections([]);
      }

      if (brandCategoryId && brands.length > 0) {
        const ancestry = getBrandAncestry(brandCategoryId, brands);
        setBrandSelection(ancestry);
      }

      // Initialize additional brand selections
      if (brandCategoryIds.length > 0 && brands.length > 0) {
        const additionalSelections = brandCategoryIds.map(bid => {
          const id = bid?._id || bid;
          return getBrandAncestry(id, brands);
        });
        setAdditionalBrandSelections(additionalSelections);
      } else {
        setAdditionalBrandSelections([]);
      }
      
      initializedProductIdRef.current = currentProductId;
    } else if (!product) {
      // Reset when switching from edit to add mode
      initializedProductIdRef.current = null;
    }
  }, [product, categories, brands]); // depends on product, categories, and brands

  const handleCategoryChange = (level, id) => {
    const newSelection = { [level]: id };
    const levelOrder = ['department', 'category', 'subcategory', 'type'];
    const currentLevelIndex = levelOrder.indexOf(level);
    
    // Preserve parent selections
    for (let i = 0; i < currentLevelIndex; i++) {
      const parentLevel = levelOrder[i];
      if (categorySelection[parentLevel]) {
        newSelection[parentLevel] = categorySelection[parentLevel];
      }
    }
    
    setCategorySelection(newSelection);

    // Set categoryId to the most specific level selected
    // Priority: type > subcategory > category > department
    // This ensures products are assigned to the most specific category available
    if (id) {
      // When selecting a category, set categoryId to that category
      setFormData({ ...formData, categoryId: id });
    } else {
      // If clearing a selection, find the most specific remaining level
      // Check from most specific to least specific
      const mostSpecificLevel = ['type', 'subcategory', 'category', 'department'].find(l => newSelection[l]);
      if (mostSpecificLevel) {
        setFormData({ ...formData, categoryId: newSelection[mostSpecificLevel] });
      } else {
        setFormData({ ...formData, categoryId: '' });
      }
    }
  };

  const getCategoriesByParent = (parentId) => {
    if (!parentId) {
      return categories.filter(c => {
        const cParent = c.parent?._id || c.parent;
        return !cParent;
      });
    }
    
    return categories.filter(c => {
      const cParent = c.parent?._id || c.parent;
      return cParent?.toString() === parentId.toString();
    });
  };

  const getBrandsByParent = (parentId) => {
    if (!parentId) {
      return brands.filter(b => {
        const bParent = b.parent?._id || b.parent;
        return !bParent;
      });
    }
    
    return brands.filter(b => {
      const bParent = b.parent?._id || b.parent;
      return bParent?.toString() === parentId.toString();
    });
  };

  const departments = categories.filter(c => c.level === 'department');
  const categoriesList = categorySelection.department ? getCategoriesByParent(categorySelection.department) : [];
  const subcategories = categorySelection.category ? getCategoriesByParent(categorySelection.category) : [];
  const types = categorySelection.subcategory ? getCategoriesByParent(categorySelection.subcategory) : [];

  const brandDepartments = brands.filter(b => b.level === 'department');
  const brandCategoriesList = brandSelection.department ? getBrandsByParent(brandSelection.department) : [];
  const brandSubcategories = brandSelection.category ? getBrandsByParent(brandSelection.category) : [];

  const handleBrandCategoryChange = (level, id) => {
    const newSelection = { [level]: id };
    const levelOrder = ['department', 'category', 'subcategory'];
    const currentLevelIndex = levelOrder.indexOf(level);
    
    // Preserve parent selections
    for (let i = 0; i < currentLevelIndex; i++) {
      const parentLevel = levelOrder[i];
      if (brandSelection[parentLevel]) {
        newSelection[parentLevel] = brandSelection[parentLevel];
      }
    }
    
    setBrandSelection(newSelection);

    // Set brandCategoryId to the most specific level selected
    if (id) {
      setFormData({ ...formData, brandCategoryId: id });
    } else {
      const mostSpecificLevel = ['subcategory', 'category', 'department'].find(l => newSelection[l]);
      if (mostSpecificLevel) {
        setFormData({ ...formData, brandCategoryId: newSelection[mostSpecificLevel] });
      } else {
        setFormData({ ...formData, brandCategoryId: '' });
      }
    }
  };

  const handleAdditionalBrandCategoryChange = (index, level, id) => {
    const newSelections = [...additionalBrandSelections];
    const newSelection = { [level]: id };
    const levelOrder = ['department', 'category', 'subcategory'];
    const currentLevelIndex = levelOrder.indexOf(level);
    
    // Preserve parent selections
    if (newSelections[index]) {
      for (let i = 0; i < currentLevelIndex; i++) {
        const parentLevel = levelOrder[i];
        if (newSelections[index][parentLevel]) {
          newSelection[parentLevel] = newSelections[index][parentLevel];
        }
      }
    }
    
    newSelections[index] = newSelection;
    setAdditionalBrandSelections(newSelections);

    // Update brandCategoryIds array
    const updatedBrandCategoryIds = newSelections.map(sel => {
      const mostSpecificLevel = ['subcategory', 'category', 'department'].find(l => sel[l]);
      return mostSpecificLevel ? sel[mostSpecificLevel] : null;
    }).filter(Boolean);

    setFormData({ ...formData, brandCategoryIds: updatedBrandCategoryIds });
  };

  const addAdditionalBrandCategory = () => {
    setAdditionalBrandSelections([...additionalBrandSelections, {}]);
  };

  const removeAdditionalBrandCategory = (index) => {
    const newSelections = additionalBrandSelections.filter((_, i) => i !== index);
    setAdditionalBrandSelections(newSelections);
    
    // Update brandCategoryIds array
    const updatedBrandCategoryIds = newSelections.map(sel => {
      const mostSpecificLevel = ['subcategory', 'category', 'department'].find(l => sel[l]);
      return mostSpecificLevel ? sel[mostSpecificLevel] : null;
    }).filter(Boolean);

    setFormData({ ...formData, brandCategoryIds: updatedBrandCategoryIds });
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const { checked } = e.target;
      setFormData({ ...formData, [name]: checked });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  // Get brand suggestions based on input
  const getBrandSuggestions = (query) => {
    if (!query || query.trim().length < 2 || !brands || brands.length === 0) {
      return [];
    }
    const queryLower = query.toLowerCase().trim();
    
    // Search in all brand levels
    const matches = brands.filter(brand => {
      const brandName = (brand.name || '').toLowerCase();
      return brandName.includes(queryLower);
    });
    
    // Prioritize departments, then categories, then subcategories
    const sorted = matches.sort((a, b) => {
      const levelOrder = { department: 0, category: 1, subcategory: 2 };
      return (levelOrder[a.level] || 99) - (levelOrder[b.level] || 99);
    });
    
    return sorted.slice(0, 5); // Limit to 5 suggestions
  };

  // Handle brand input change with autocomplete
  const handleBrandInputChange = (e) => {
    const value = e.target.value;
    setFormData({ ...formData, brand: value });
    
    // Show suggestions if there's input
    if (value.trim().length >= 2) {
      const suggestions = getBrandSuggestions(value);
      setBrandSuggestions(suggestions);
      setShowBrandSuggestions(suggestions.length > 0);
    } else {
      setBrandSuggestions([]);
      setShowBrandSuggestions(false);
    }
  };

  // Handle selecting a brand suggestion
  const handleBrandSuggestionSelect = (brand) => {
    setFormData({ ...formData, brand: brand.name });
    setShowBrandSuggestions(false);
    setBrandInputFocused(false);
    
    // Auto-populate brand category selection based on brand level
    if (brand.level === 'department') {
      handleBrandCategoryChange('department', brand._id || brand.id);
    } else if (brand.level === 'category') {
      // Find parent department
      const parentDept = brands.find(b => {
        const bId = b._id || b.id;
        const parentId = brand.parent?._id || brand.parent;
        return bId?.toString() === parentId?.toString();
      });
      if (parentDept) {
        handleBrandCategoryChange('department', parentDept._id || parentDept.id);
        // Small delay to let state update
        setTimeout(() => {
          handleBrandCategoryChange('category', brand._id || brand.id);
        }, 100);
      }
    } else if (brand.level === 'subcategory') {
      // Find parent category and department
      const parentCat = brands.find(b => {
        const bId = b._id || b.id;
        const parentId = brand.parent?._id || brand.parent;
        return bId?.toString() === parentId?.toString();
      });
      if (parentCat) {
        const parentDept = brands.find(b => {
          const bId = b._id || b.id;
          const parentId = parentCat.parent?._id || parentCat.parent;
          return bId?.toString() === parentId?.toString();
        });
        if (parentDept && parentCat) {
          handleBrandCategoryChange('department', parentDept._id || parentDept.id);
          setTimeout(() => {
            handleBrandCategoryChange('category', parentCat._id || parentCat.id);
            setTimeout(() => {
              handleBrandCategoryChange('subcategory', brand._id || brand.id);
            }, 100);
          }, 100);
        }
      }
    }
  };

  // Auto-link brand category on form submit if brand text matches a department
  const autoLinkBrandCategory = () => {
    if (!formData.brand || !formData.brand.trim() || formData.brandCategoryId || !brands || brands.length === 0) {
      return; // Skip if no brand text, already linked, or no brands available
    }
    
    const brandText = formData.brand.trim();
    // Find exact match (case-insensitive) with brand departments
    const matchingBrand = brands.find(b => 
      b.level === 'department' && 
      b.name.toLowerCase() === brandText.toLowerCase()
    );
    
    if (matchingBrand) {
      // Auto-link if match found - update formData directly
      const brandId = matchingBrand._id || matchingBrand.id;
      setFormData(prev => ({
        ...prev,
        brandCategoryId: brandId.toString()
      }));
      // Also update brand selection for UI consistency
      setBrandSelection({ department: brandId.toString() });
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        brandInputRef.current && 
        !brandInputRef.current.contains(event.target) &&
        brandSuggestionsRef.current &&
        !brandSuggestionsRef.current.contains(event.target)
      ) {
        setShowBrandSuggestions(false);
        setBrandInputFocused(false);
      }
    };

    if (showBrandSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showBrandSuggestions]);

  const handleBusinessTypeChange = (slug) => {
    const currentSlugs = formData.businessTypeSlugs || [];
    if (currentSlugs.includes(slug)) {
      setFormData({ ...formData, businessTypeSlugs: currentSlugs.filter(s => s !== slug) });
    } else {
      setFormData({ ...formData, businessTypeSlugs: [...currentSlugs, slug] });
    }
  };

  const handleRelatedProductChange = (productId) => {
    const currentRelated = formData.relatedProductIds || [];
    const productIdStr = productId?.toString();
    if (currentRelated.some(id => id?.toString() === productIdStr)) {
      setFormData({ 
        ...formData, 
        relatedProductIds: currentRelated.filter(id => id?.toString() !== productIdStr) 
      });
    } else {
      setFormData({ ...formData, relatedProductIds: [...currentRelated, productId] });
    }
  };
  
  const getSortedRelatedCandidates = useMemo(() => {
    const currentProductId = product?._id || product?.id;
    
    // LAYER 1: Category = Candidate Pool (Filter, not score)
    // Get current product's category hierarchy to determine pool
    const formCategoryId = formData.categoryId;
    const formCategory = categories.find(c => {
      const cId = c._id || c.id;
      return cId?.toString() === formCategoryId?.toString();
    });
    
    // Get current product's category ancestry (to find subcategory/type)
    const formCategoryAncestry = formCategoryId ? getCategoryAncestry(formCategoryId, categories) : {};
    const formSubcategoryId = formCategoryAncestry.subcategory;
    const formTypeId = formCategoryAncestry.type;
    
    // Filter candidates by same subcategory OR same type (creates relevant pool)
    let candidatePool = allProducts.filter(p => {
      const pid = p._id || p.id;
      // Exclude current product
      if (pid?.toString() === currentProductId?.toString()) {
        return false;
      }
      
      // If no category selected, allow all products (fallback)
      if (!formCategoryId) {
        return true;
      }
      
      const candidateCategoryId = p.categoryId?._id || p.categoryId;
      if (!candidateCategoryId) return false;
      
      const candidateCategory = categories.find(c => {
        const cId = c._id || c.id;
        return cId?.toString() === candidateCategoryId?.toString();
      });
      
      if (!candidateCategory) return false;
      
      // Get candidate's category ancestry
      const candidateAncestry = getCategoryAncestry(candidateCategoryId, categories);
      const candidateSubcategoryId = candidateAncestry.subcategory;
      const candidateTypeId = candidateAncestry.type;
      
      // Pool rule: Same subcategory OR same type
      // This creates a relevant pool (e.g., "Dough Mixers" not "Ovens")
      if (formTypeId && candidateTypeId) {
        return formTypeId.toString() === candidateTypeId.toString();
      }
      if (formSubcategoryId && candidateSubcategoryId) {
        return formSubcategoryId.toString() === candidateSubcategoryId.toString();
      }
      
      // Fallback: if no subcategory/type, allow same category level
      if (formCategory && candidateCategory) {
        return formCategory.level === candidateCategory.level && 
               formCategoryId.toString() === candidateCategoryId.toString();
      }
      
      return false;
    });
    
    // Get current tags (normalized)
    const currentTags = formData.tagsInput 
      ? formData.tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
      : (formData.tags || []).map(t => t.toLowerCase()).filter(Boolean);

    // LAYER 2: Shared Signals = Relevance (Scoring)
    return candidatePool.map(candidate => {
      let score = 0;
      let reasons = [];

      // 👑 TAGS = PRIMARY SIGNAL (King of relationships)
      // Tags answer: "Why would someone look at THIS after seeing THAT?"
      const sharedTags = (candidate.tags || []).filter(t => 
        currentTags.includes(t.toLowerCase())
      );
      if (sharedTags.length > 0) {
        // Increased weight: 5 points per tag (was 3)
        // This makes tags the dominant signal
        score += sharedTags.length * 5;
        reasons.push(`${sharedTags.length} Shared Tag${sharedTags.length > 1 ? 's' : ''}`);
      }

      // Business Type = Secondary Signal
      // Same business usage = same context
      const sharedBusiness = (candidate.businessTypeSlugs || []).filter(s => 
        formData.businessTypeSlugs?.includes(s)
      );
      if (sharedBusiness.length > 0) {
        score += sharedBusiness.length * 2;
        if (!reasons.some(r => r.includes('Business'))) {
          reasons.push(`${sharedBusiness.length} Shared Business Type${sharedBusiness.length > 1 ? 's' : ''}`);
        }
      }

      // Category = Small Influence (Gatekeeper, not decision-maker)
      // Only give a small bonus if in same category (already filtered by pool)
      const candidateCategoryId = candidate.categoryId?._id || candidate.categoryId;
      const formCategoryId = formData.categoryId;
      if (candidateCategoryId?.toString() === formCategoryId?.toString()) {
        score += 3; // Small influence (was 10)
        if (!reasons.some(r => r.includes('Category'))) {
          reasons.push('Same Category');
        }
      }

      // Price Proximity = Nice-to-have
      // Similar price range suggests similar use case
      const currentPrice = Number(formData.price) || 0;
      if (currentPrice > 0 && candidate.price >= currentPrice * 0.7 && candidate.price <= currentPrice * 1.3) {
        score += 2;
        if (!reasons.some(r => r.includes('Price'))) {
          reasons.push('Similar Price');
        }
      }

      return {
        ...candidate,
        relevanceScore: score,
        relevanceReasons: reasons
      };
    }).sort((a, b) => {
      // LAYER 3: Manual Override = Always Wins
      // Selected products always appear first
      const aId = a._id || a.id;
      const bId = b._id || b.id;
      const aSelected = formData.relatedProductIds?.some(id => id?.toString() === aId?.toString());
      const bSelected = formData.relatedProductIds?.some(id => id?.toString() === bId?.toString());
      
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      
      // Then sort by relevance score (tags-driven)
      return b.relevanceScore - a.relevanceScore;
    });
  }, [
    allProducts, 
    product, 
    categories,
    formData.categoryId, 
    formData.tagsInput, 
    formData.businessTypeSlugs, 
    formData.price, 
    formData.relatedProductIds
  ]);

  const handleAutoSuggestRelated = () => {
    // Filter candidates that have meaningful relationships (score > 0)
    // Prioritize tag-based matches (score >= 5 means at least 1 shared tag)
    const tagBasedMatches = getSortedRelatedCandidates
      .filter(c => c.relevanceScore >= 5) // At least 1 shared tag
      .slice(0, 3); // Top 3 tag-based matches
    
    // If we have tag matches, use them
    // Otherwise, fall back to any matches with score > 0
    const topMatches = tagBasedMatches.length > 0
      ? tagBasedMatches
      : getSortedRelatedCandidates
          .filter(c => c.relevanceScore > 0)
          .slice(0, 4);
    
    const matchIds = topMatches.map(c => c._id || c.id);

    if (matchIds.length > 0) {
      const newSelection = Array.from(new Set([...(formData.relatedProductIds || []), ...matchIds]));
      setFormData({ ...formData, relatedProductIds: newSelection });
    } else {
      // More helpful message
      const hasCategory = formData.categoryId;
      const hasTags = formData.tagsInput?.trim() || formData.tags?.length > 0;
      
      if (!hasCategory && !hasTags) {
        alert("Please add a Category and Tags first to generate related product suggestions.");
      } else if (!hasTags) {
        alert("Add some Tags to get better related product suggestions. Tags are the primary signal for relationships.");
      } else {
        alert("No strong matches found. Try adding more specific tags or selecting products manually.");
      }
    }
  };

  const handleImageUpload = async (e, field) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setError('');
    try {
      if (field === 'heroImage') {
        const imageUrl = await uploadToR2(files[0]);
        setFormData({ ...formData, heroImage: imageUrl });
      } else {
        const uploadPromises = Array.from(files).map(file => uploadToR2(file));
        const newImageUrls = await Promise.all(uploadPromises);
        setFormData({ ...formData, gallery: [...(formData.gallery || []), ...newImageUrls] });
      }
    } catch (error) {
      console.error("Upload failed", error);
      setError(`Image upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveGalleryImage = (index) => {
    const newGallery = formData.gallery.filter((_, i) => i !== index);
    setFormData({ ...formData, gallery: newGallery });
  };
  
  const handleSpecChange = (index, e) => {
    const { name, value } = e.target;
    const newSpecs = [...(formData.specifications || [])];
    newSpecs[index] = { ...newSpecs[index], [name]: value };
    setFormData({ ...formData, specifications: newSpecs });
  };
  
  const addSpec = () => {
    setFormData({ 
      ...formData, 
      specifications: [...(formData.specifications || []), { label: '', value: '', unit: '' }] 
    });
  };
  
  const removeSpec = (index) => {
    setFormData({ 
      ...formData, 
      specifications: (formData.specifications || []).filter((_, i) => i !== index) 
    });
  };

  const handleFilterChange = (index, e) => {
    const { name, value } = e.target;
    const newFilters = [...(formData.filters || [])];
    if (name === 'key') {
      newFilters[index] = { ...newFilters[index], key: value };
    } else if (name === 'values') {
      // Split comma-separated values
      const values = value.split(',').map(v => v.trim()).filter(Boolean);
      newFilters[index] = { ...newFilters[index], values };
    }
    setFormData({ ...formData, filters: newFilters });
  };

  const addFilter = () => {
    setFormData({ 
      ...formData, 
      filters: [...(formData.filters || []), { key: '', values: [] }] 
    });
  };
  
  const removeFilter = (index) => {
    setFormData({ 
      ...formData, 
      filters: (formData.filters || []).filter((_, i) => i !== index) 
    });
  };

  const handleAdditionalCategoryChange = (index, level, id) => {
    const newSelections = [...additionalCategorySelections];
    const newSelection = { [level]: id };
    const levelOrder = ['department', 'category', 'subcategory', 'type'];
    const currentLevelIndex = levelOrder.indexOf(level);
    
    // Preserve parent selections
    if (newSelections[index]) {
      for (let i = 0; i < currentLevelIndex; i++) {
        const parentLevel = levelOrder[i];
        if (newSelections[index][parentLevel]) {
          newSelection[parentLevel] = newSelections[index][parentLevel];
        }
      }
    }
    
    newSelections[index] = newSelection;
    setAdditionalCategorySelections(newSelections);

    // Update categoryIds array
    const updatedCategoryIds = newSelections.map(sel => {
      const mostSpecificLevel = ['type', 'subcategory', 'category', 'department'].find(l => sel[l]);
      return mostSpecificLevel ? sel[mostSpecificLevel] : null;
    }).filter(Boolean);

    setFormData({ ...formData, categoryIds: updatedCategoryIds });
  };

  const addAdditionalCategory = () => {
    setAdditionalCategorySelections([...additionalCategorySelections, {}]);
  };

  const removeAdditionalCategory = (index) => {
    const newSelections = additionalCategorySelections.filter((_, i) => i !== index);
    setAdditionalCategorySelections(newSelections);
    
    // Update categoryIds array
    const updatedCategoryIds = newSelections.map(sel => {
      const mostSpecificLevel = ['type', 'subcategory', 'category', 'department'].find(l => sel[l]);
      return mostSpecificLevel ? sel[mostSpecificLevel] : null;
    }).filter(Boolean);

    setFormData({ ...formData, categoryIds: updatedCategoryIds });
  };

  const handleColorChange = (color) => {
    const currentVariants = formData.colorVariants || [];
    const isSelected = currentVariants.some(v => v.colorName === color.name);
    
    if (isSelected) {
      // Removing a color - if it was default, we don't need to reassign
      const newVariants = currentVariants.filter(v => v.colorName !== color.name);
      setFormData({ ...formData, colorVariants: newVariants });
    } else {
      // Adding a new color - set as default if it's the first one
      const isFirstColor = currentVariants.length === 0;
      const newVariants = [
        ...currentVariants,
        { colorName: color.name, colorHex: color.hex, images: [], isDefault: isFirstColor }
      ];
      setFormData({ ...formData, colorVariants: newVariants });
    }
  };

  const handleAddCustomColor = () => {
    if (!customColorName.trim()) {
      setError('Please provide a color name');
      return;
    }
    if (!customColorHex.match(/^#[0-9A-Fa-f]{6}$/)) {
      setError('Please provide a valid hex color code');
      return;
    }

    const currentVariants = formData.colorVariants || [];
    // Check if color name already exists
    if (currentVariants.some(v => v.colorName.toLowerCase() === customColorName.trim().toLowerCase())) {
      setError('A color with this name already exists');
      return;
    }

    // Set as default if it's the first color
    const isFirstColor = currentVariants.length === 0;
    const newVariants = [
      ...currentVariants,
      { colorName: customColorName.trim(), colorHex: customColorHex.toUpperCase(), images: [], isDefault: isFirstColor }
    ];
    setFormData({ ...formData, colorVariants: newVariants });
    setShowColorPicker(false);
    setCustomColorName('');
    setCustomColorHex('#000000');
    setError('');
  };

  const handleRemoveCustomColor = (colorName) => {
    const currentVariants = formData.colorVariants || [];
    const removedVariant = currentVariants.find(v => v.colorName === colorName);
    const newVariants = currentVariants.filter(v => v.colorName !== colorName);
    
    // If removed variant was default and there are other variants, set first one as default
    if (removedVariant?.isDefault && newVariants.length > 0) {
      newVariants[0] = { ...newVariants[0], isDefault: true };
    }
    
    setFormData({ ...formData, colorVariants: newVariants });
  };

  /**
   * Set a color variant as the default (only one can be default at a time)
   */
  const handleSetDefaultColor = (colorName) => {
    const currentVariants = formData.colorVariants || [];
    const newVariants = currentVariants.map(v => ({
      ...v,
      isDefault: v.colorName === colorName
    }));
    setFormData({ ...formData, colorVariants: newVariants });
  };

  // Get custom colors (colors not in AVAILABLE_COLORS)
  const getCustomColors = () => {
    const predefinedColorNames = AVAILABLE_COLORS.map(c => c.name.toLowerCase());
    return (formData.colorVariants || []).filter(v => 
      !predefinedColorNames.includes(v.colorName.toLowerCase())
    );
  };

  const handleColorImageUpload = async (e, colorName) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setError('');
    try {
      const uploadPromises = Array.from(files).map(file => uploadToR2(file));
      const newImageUrls = await Promise.all(uploadPromises);
      const updatedVariants = (formData.colorVariants || []).map(variant => 
        variant.colorName === colorName 
          ? { ...variant, images: [...variant.images, ...newImageUrls] } 
          : variant
      );
      setFormData({ ...formData, colorVariants: updatedVariants });
    } catch (error) {
      console.error("Upload failed", error);
      setError(`Image upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveColorImage = (colorName, imageIndex) => {
    const updatedVariants = (formData.colorVariants || []).map(variant => 
      variant.colorName === colorName 
        ? { ...variant, images: variant.images.filter((_, i) => i !== imageIndex) } 
        : variant
    );
    setFormData({ ...formData, colorVariants: updatedVariants });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    // Only title and hero image are required - everything else can be added later
    if (!formData.title || !formData.heroImage) {
      setError("Please provide a Title and a Hero Image.");
      return;
    }
    
    // Auto-link brand category if brand text matches a department (check synchronously)
    let updatedBrandCategoryId = formData.brandCategoryId;
    if (!updatedBrandCategoryId && formData.brand && formData.brand.trim() && brands && brands.length > 0) {
      const brandText = formData.brand.trim();
      const matchingBrand = brands.find(b => 
        b.level === 'department' && 
        b.name.toLowerCase() === brandText.toLowerCase()
      );
      if (matchingBrand) {
        updatedBrandCategoryId = (matchingBrand._id || matchingBrand.id).toString();
        // Also update state for UI feedback
        setBrandSelection({ department: updatedBrandCategoryId });
      }
    }
    
    const tags = formData.tagsInput 
      ? formData.tagsInput.split(',').map(t => t.trim()).filter(Boolean) 
      : [];
    
    // Ensure categoryIds is properly formatted
    const categoryIds = (formData.categoryIds || []).filter(id => id && id.trim() !== '');
    const brandCategoryIds = (formData.brandCategoryIds || []).filter(id => id && id.trim() !== '');

    // Process filters - filter out empty ones and ensure values are arrays
    const filters = (formData.filters || [])
      .filter(f => f.key && f.key.trim() && f.values && f.values.length > 0)
      .map(f => ({
        key: f.key.trim(),
        values: Array.isArray(f.values) ? f.values.filter(v => v && v.trim()) : []
      }))
      .filter(f => f.values.length > 0);

    const finalProduct = {
      ...formData,
      brandCategoryId: updatedBrandCategoryId || formData.brandCategoryId,
      price: Number(formData.price),
      tags,
      categoryIds,
      brandCategoryIds,
      filters
    };
    
    // Remove temporary input fields
    delete finalProduct.tagsInput;

    // Ensure categoryId is included if it exists (even if empty string, API will handle it)
    // categoryId should be set when a "type" level category is selected
    if (finalProduct.categoryId === '' || finalProduct.categoryId === null || finalProduct.categoryId === undefined) {
      // Remove empty categoryId - API will handle this
      delete finalProduct.categoryId;
    }

    // Ensure brandCategoryId is included if it exists
    if (finalProduct.brandCategoryId === '' || finalProduct.brandCategoryId === null || finalProduct.brandCategoryId === undefined) {
      delete finalProduct.brandCategoryId;
    }

    onSave(finalProduct);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm flex flex-col h-full">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}
      <form id="product-form" onSubmit={handleSubmit} className="flex-grow">
        {/* Desktop: Two-column layout, Mobile: Single column */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-6">
          {/* Left Column */}
          <div className="space-y-5 sm:space-y-6">
            <FormSection title="Basic Information">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Product Title *</label>
                <input 
                  name="title" 
                  value={formData.title} 
                  onChange={handleChange} 
                  className="w-full mt-1 p-3 border border-gray-300 rounded-lg shadow-sm text-base focus:ring-2 focus:ring-primary focus:border-primary transition-colors" 
                  placeholder="Enter product title"
                  required
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Short Description *</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAIGenerate('summary')}
                      disabled={aiLoading.summary || aiCooldown.summary || !formData.title || formData.title.trim().length < 3}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                        aiLoading.summary || aiCooldown.summary || !formData.title || formData.title.trim().length < 3
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : formData.summary && formData.summary.trim().length > 20
                          ? 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                          : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                      }`}
                      title={!formData.title || formData.title.trim().length < 3 ? 'Enter product title first' : formData.summary && formData.summary.trim().length > 20 ? 'Improve existing description' : 'Generate new description'}
                    >
                      {aiLoading.summary ? (
                        <>
                          <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                          </svg>
                          <span>{formData.summary && formData.summary.trim().length > 20 ? 'Improve' : 'Generate'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <textarea 
                  name="summary" 
                  value={formData.summary} 
                  onChange={handleChange} 
                  className="w-full mt-1 p-3 border border-gray-300 rounded-lg shadow-sm text-base resize-y focus:ring-2 focus:ring-primary focus:border-primary transition-colors" 
                  rows={3}
                  placeholder="Enter short description"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative" ref={brandInputRef}>
                  <label className="block text-sm font-medium mb-2 text-gray-700">Brand</label>
                  <input 
                    name="brand" 
                    value={formData.brand} 
                    onChange={handleBrandInputChange}
                    onFocus={() => {
                      setBrandInputFocused(true);
                      if (formData.brand && formData.brand.trim().length >= 2) {
                        const suggestions = getBrandSuggestions(formData.brand);
                        setBrandSuggestions(suggestions);
                        setShowBrandSuggestions(suggestions.length > 0);
                      }
                    }}
                    className="w-full mt-1 p-3 border border-gray-300 rounded-lg shadow-sm text-base focus:ring-2 focus:ring-primary focus:border-primary transition-colors" 
                    placeholder="Enter brand name"
                  />
                  
                  {/* Autocomplete Suggestions Dropdown */}
                  {showBrandSuggestions && brandSuggestions.length > 0 && (
                    <div 
                      ref={brandSuggestionsRef}
                      className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
                    >
                      <div className="px-2 py-1 text-xs text-gray-500 border-b bg-gray-50">
                        Select to auto-link with brand category:
                      </div>
                      {brandSuggestions.map((brand) => (
                        <button
                          key={brand._id || brand.id}
                          type="button"
                          onClick={() => handleBrandSuggestionSelect(brand)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center justify-between transition-colors"
                        >
                          <span className="font-medium text-gray-900">{brand.name}</span>
                          <span className="text-xs text-gray-500 capitalize bg-gray-100 px-2 py-0.5 rounded">
                            {brand.level}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {/* Show indicator if brand is linked to a category */}
                  {formData.brand && formData.brandCategoryId && (
                    <div className="mt-1 text-xs text-green-600 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Linked to brand category</span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">SKU *</label>
                  <input 
                    name="sku" 
                    value={formData.sku || ''} 
                    onChange={handleChange} 
                    className="w-full mt-1 p-3 border border-gray-300 rounded-lg shadow-sm text-base focus:ring-2 focus:ring-primary focus:border-primary transition-colors" 
                    placeholder="Enter SKU"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">Category *</label>
                  <select 
                    value={categorySelection.category || ''} 
                    onChange={(e) => handleCategoryChange('category', e.target.value)} 
                    disabled={!categorySelection.department} 
                    className="w-full mt-1 p-3 border border-gray-300 rounded-lg shadow-sm disabled:bg-gray-100 text-base focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                  >
                    <option value="">Select category</option>
                    {categoriesList.map(c => (
                      <option key={c._id || c.id} value={c._id || c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">Subcategories</label>
                  <select 
                    value={categorySelection.subcategory || ''} 
                    onChange={(e) => handleCategoryChange('subcategory', e.target.value)} 
                    disabled={!categorySelection.category} 
                    className="w-full mt-1 p-3 border border-gray-300 rounded-lg shadow-sm disabled:bg-gray-100 text-base focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                  >
                    <option value="">Select subcategory</option>
                    {subcategories.map(s => (
                      <option key={s._id || s.id} value={s._id || s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Price (₹)</label>
                <input 
                  type="number" 
                  name="price" 
                  value={formData.price || ''} 
                  onChange={handleChange} 
                  className="w-full mt-1 p-3 border border-gray-300 rounded-lg shadow-sm text-base focus:ring-2 focus:ring-primary focus:border-primary transition-colors" 
                  min="0" 
                  placeholder="0"
                />
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <input 
                  type="checkbox" 
                  name="featured" 
                  id="featured" 
                  checked={!!formData.featured} 
                  onChange={handleChange} 
                  className="h-4 w-4 rounded text-primary focus:ring-primary" 
                />
                <label htmlFor="featured" className="text-sm font-medium">Featured Product</label>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Long Description *</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAIGenerate('description')}
                      disabled={aiLoading.description || aiCooldown.description || !formData.title || formData.title.trim().length < 3}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                        aiLoading.description || aiCooldown.description || !formData.title || formData.title.trim().length < 3
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : formData.description && formData.description.trim().length > 20
                          ? 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                          : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                      }`}
                      title={!formData.title || formData.title.trim().length < 3 ? 'Enter product title first' : formData.description && formData.description.trim().length > 20 ? 'Improve existing description' : 'Generate new description'}
                    >
                      {aiLoading.description ? (
                        <>
                          <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                          </svg>
                          <span>{formData.description && formData.description.trim().length > 20 ? 'Improve' : 'Generate'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <textarea 
                  name="description" 
                  value={formData.description} 
                  onChange={handleChange} 
                  className="w-full mt-1 p-3 border border-gray-300 rounded-lg shadow-sm text-base resize-y focus:ring-2 focus:ring-primary focus:border-primary transition-colors" 
                  rows={6}
                  placeholder="Enter long description"
                />
              </div>
            </FormSection>

            <FormSection title="Brand Categories">
          <div>
            <label className="block text-sm font-medium mb-2">Primary Brand Category</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Department</label>
                <select 
                  value={brandSelection.department || ''} 
                  onChange={(e) => handleBrandCategoryChange('department', e.target.value)} 
                  className="w-full mt-1 p-2.5 sm:p-2 border border-gray-300 rounded-md shadow-sm text-base"
                >
                  <option value="">Select Department</option>
                  {brandDepartments.map(d => (
                    <option key={d._id || d.id} value={d._id || d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select 
                  value={brandSelection.category || ''} 
                  onChange={(e) => handleBrandCategoryChange('category', e.target.value)} 
                  disabled={!brandSelection.department} 
                  className="w-full mt-1 p-2.5 sm:p-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100 text-base"
                >
                  <option value="">Select Category</option>
                  {brandCategoriesList.map(c => (
                    <option key={c._id || c.id} value={c._id || c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Subcategory</label>
                <select 
                  value={brandSelection.subcategory || ''} 
                  onChange={(e) => handleBrandCategoryChange('subcategory', e.target.value)} 
                  disabled={!brandSelection.category} 
                  className="w-full mt-1 p-2.5 sm:p-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100 text-base"
                >
                  <option value="">Select Subcategory</option>
                  {brandSubcategories.map(s => (
                    <option key={s._id || s.id} value={s._id || s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t">
            <label className="block text-sm font-medium mb-2">Additional Brand Categories</label>
            <p className="text-xs text-gray-500 mb-3">Add this product to multiple brand categories</p>
            <div className="space-y-4">
              {additionalBrandSelections.map((selection, index) => {
                const selDept = selection.department || '';
                const selCat = selection.category || '';
                const selSubcat = selection.subcategory || '';
                
                const selDeptBrands = selDept ? getBrandsByParent(selDept) : [];
                const selSubcategories = selCat ? getBrandsByParent(selCat) : [];
                
                return (
                  <div key={index} className="p-4 border border-gray-200 rounded-md bg-gray-50">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm font-medium text-gray-700">Brand Category {index + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeAdditionalBrandCategory(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600">Department</label>
                        <select 
                          value={selDept} 
                          onChange={(e) => handleAdditionalBrandCategoryChange(index, 'department', e.target.value)} 
                          className="w-full mt-1 p-2.5 sm:p-2 border border-gray-300 rounded-md shadow-sm text-sm sm:text-base"
                        >
                          <option value="">Select Department</option>
                          {brandDepartments.map(d => (
                            <option key={d._id || d.id} value={d._id || d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600">Category</label>
                        <select 
                          value={selCat} 
                          onChange={(e) => handleAdditionalBrandCategoryChange(index, 'category', e.target.value)} 
                          disabled={!selDept} 
                          className="w-full mt-1 p-2.5 sm:p-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100 text-sm sm:text-base"
                        >
                          <option value="">Select Category</option>
                          {selDeptBrands.map(c => (
                            <option key={c._id || c.id} value={c._id || c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600">Subcategory</label>
                        <select 
                          value={selSubcat} 
                          onChange={(e) => handleAdditionalBrandCategoryChange(index, 'subcategory', e.target.value)} 
                          disabled={!selCat} 
                          className="w-full mt-1 p-2.5 sm:p-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100 text-sm sm:text-base"
                        >
                          <option value="">Select Subcategory</option>
                          {selSubcategories.map(s => (
                            <option key={s._id || s.id} value={s._id || s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <button 
              type="button" 
              onClick={addAdditionalBrandCategory} 
              className="mt-3 text-sm text-primary hover:underline font-semibold flex items-center gap-1"
            >
              <PlusIcon className="w-4 h-4" /> Add Additional Brand Category
            </button>
          </div>
        </FormSection>

            <FormSection title="Categorization">
          <div>
            <label className="block text-sm font-medium mb-2">Primary Category</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Department</label>
                <select 
                  value={categorySelection.department || ''} 
                  onChange={(e) => handleCategoryChange('department', e.target.value)} 
                  className="w-full mt-1 p-2.5 sm:p-2 border border-gray-300 rounded-md shadow-sm text-base"
                >
                  <option value="">Select Department</option>
                  {departments.map(d => (
                    <option key={d._id || d.id} value={d._id || d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select 
                  value={categorySelection.category || ''} 
                  onChange={(e) => handleCategoryChange('category', e.target.value)} 
                  disabled={!categorySelection.department} 
                  className="w-full mt-1 p-2.5 sm:p-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100 text-base"
                >
                  <option value="">Select Category</option>
                  {categoriesList.map(c => (
                    <option key={c._id || c.id} value={c._id || c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Subcategory</label>
                <select 
                  value={categorySelection.subcategory || ''} 
                  onChange={(e) => handleCategoryChange('subcategory', e.target.value)} 
                  disabled={!categorySelection.category} 
                  className="w-full mt-1 p-2.5 sm:p-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100 text-base"
                >
                  <option value="">Select Subcategory</option>
                  {subcategories.map(s => (
                    <option key={s._id || s.id} value={s._id || s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select 
                  value={categorySelection.type || ''} 
                  onChange={(e) => handleCategoryChange('type', e.target.value)} 
                  disabled={!categorySelection.subcategory} 
                  className="w-full mt-1 p-2.5 sm:p-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100 text-base"
                >
                  <option value="">Select Type</option>
                  {types.map(t => (
                    <option key={t._id || t.id} value={t._id || t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t">
            <label className="block text-sm font-medium mb-2">Additional Categories</label>
            <p className="text-xs text-gray-500 mb-3">Add this product to multiple categories/departments (e.g., a glass can be in both Barware and Kitchenware)</p>
            <div className="space-y-4">
              {additionalCategorySelections.map((selection, index) => {
                const selDept = selection.department || '';
                const selCat = selection.category || '';
                const selSubcat = selection.subcategory || '';
                const selType = selection.type || '';
                
                const selDeptCategories = selDept ? getCategoriesByParent(selDept) : [];
                const selSubcategories = selCat ? getCategoriesByParent(selCat) : [];
                const selTypes = selSubcat ? getCategoriesByParent(selSubcat) : [];
                
                return (
                  <div key={index} className="p-4 border border-gray-200 rounded-md bg-gray-50">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm font-medium text-gray-700">Category {index + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeAdditionalCategory(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600">Department</label>
                        <select 
                          value={selDept} 
                          onChange={(e) => handleAdditionalCategoryChange(index, 'department', e.target.value)} 
                          className="w-full mt-1 p-2.5 sm:p-2 border border-gray-300 rounded-md shadow-sm text-sm sm:text-base"
                        >
                          <option value="">Select Department</option>
                          {departments.map(d => (
                            <option key={d._id || d.id} value={d._id || d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600">Category</label>
                        <select 
                          value={selCat} 
                          onChange={(e) => handleAdditionalCategoryChange(index, 'category', e.target.value)} 
                          disabled={!selDept} 
                          className="w-full mt-1 p-2.5 sm:p-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100 text-sm sm:text-base"
                        >
                          <option value="">Select Category</option>
                          {selDeptCategories.map(c => (
                            <option key={c._id || c.id} value={c._id || c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600">Subcategory</label>
                        <select 
                          value={selSubcat} 
                          onChange={(e) => handleAdditionalCategoryChange(index, 'subcategory', e.target.value)} 
                          disabled={!selCat} 
                          className="w-full mt-1 p-2.5 sm:p-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100 text-sm sm:text-base"
                        >
                          <option value="">Select Subcategory</option>
                          {selSubcategories.map(s => (
                            <option key={s._id || s.id} value={s._id || s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600">Type</label>
                        <select 
                          value={selType} 
                          onChange={(e) => handleAdditionalCategoryChange(index, 'type', e.target.value)} 
                          disabled={!selSubcat} 
                          className="w-full mt-1 p-2.5 sm:p-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100 text-sm sm:text-base"
                        >
                          <option value="">Select Type</option>
                          {selTypes.map(t => (
                            <option key={t._id || t.id} value={t._id || t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <button 
              type="button" 
              onClick={addAdditionalCategory} 
              className="mt-3 text-sm text-primary hover:underline font-semibold flex items-center gap-1"
            >
              <PlusIcon className="w-4 h-4" /> Add Additional Category
            </button>
          </div>
          
          <div className="mt-6 pt-6 border-t">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">Business Types (We Serve)</label>
              <span className="text-xs text-gray-500">
                {formData.businessTypeSlugs?.length || 0} selected
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {businessTypes.map(bt => {
                const isSelected = formData.businessTypeSlugs?.includes(bt.slug);
                return (
                  <label 
                    key={bt._id || bt.id} 
                    className={`inline-flex items-center gap-2 cursor-pointer px-3 py-2 border-2 rounded-lg transition-all whitespace-nowrap ${
                      isSelected 
                        ? 'border-primary bg-primary/5 shadow-sm' 
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <input 
                      type="checkbox" 
                      checked={isSelected} 
                      onChange={() => handleBusinessTypeChange(bt.slug)} 
                      className="h-4 w-4 rounded text-primary focus:ring-primary border-gray-300 flex-shrink-0" 
                    />
                    <span className={`text-sm ${isSelected ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                      {bt.name}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </FormSection>

            <FormSection title="Metadata & Filters">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium">Tags (comma-separated)</label>
                <button
                  type="button"
                  onClick={handleAutoGenerateTags}
                  className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold py-1.5 px-3 rounded-md flex items-center gap-1.5 transition-colors"
                  title="Auto-generate tags from all product fields"
                >
                  <MagicIcon className="w-4 h-4" /> Auto-Generate Tags
                </button>
              </div>
              <input 
                name="tagsInput" 
                value={formData.tagsInput} 
                onChange={(e) => {
                  handleChange(e);
                  // Hide preview when user manually edits
                  if (showTagsPreview) {
                    setShowTagsPreview(false);
                  }
                }} 
                placeholder="e.g., hotel kitchen, heavy duty, energy efficient, bestseller" 
                className="w-full mt-1 p-2.5 sm:p-2 border border-gray-300 rounded-md shadow-sm text-base focus:ring-2 focus:ring-primary focus:border-primary transition-colors" 
              />
              <p className="text-xs text-gray-500 mt-1">
                Tags are used for search boost, related products, campaigns, and manual collections. 
                <strong className="text-gray-700"> Tags are NOT shown as filters.</strong>
                <span className="block mt-1 text-indigo-600">
                  💡 Tip: Click "Auto-Generate Tags" to extract keywords from all fields automatically.
                </span>
              </p>
              
              {/* Tags Preview */}
              {showTagsPreview && generatedTagsPreview.length > 0 && (
                <div className="mt-3 p-3 bg-indigo-50 border border-indigo-200 rounded-md">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-indigo-700">
                      Generated Tags ({generatedTagsPreview.length}):
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowTagsPreview(false)}
                      className="text-xs text-indigo-600 hover:text-indigo-800"
                    >
                      ✕ Hide
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {generatedTagsPreview.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 border border-indigo-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-indigo-600 mt-2">
                    These tags have been merged with your existing tags. You can edit them manually.
                  </p>
                </div>
              )}
            </div>
          </div>
        </FormSection>

          </div>

          {/* Right Column */}
          <div className="space-y-5 sm:space-y-6">
            <FormSection title="Product Images">
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">Hero Image *</label>
                  <div className="mt-1 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary/40 transition-all bg-gray-50/50">
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={e => handleImageUpload(e, 'heroImage')} 
                      className="hidden" 
                      id="heroImageInput"
                      disabled={isUploading}
                    />
                    <label htmlFor="heroImageInput" className="cursor-pointer flex flex-col items-center">
                      <svg className="w-10 h-10 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span className="text-sm font-medium text-gray-600 mb-1">Click to upload or drag and drop</span>
                      <span className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</span>
                    </label>
                    {formData.heroImage && (
                      <div className="mt-4 relative inline-block">
                        <Image 
                          src={formData.heroImage} 
                          alt="Hero preview" 
                          width={150} 
                          height={150}
                          className="h-32 w-32 object-cover rounded-lg shadow-md border-2 border-gray-200" 
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">Gallery Images</label>
                  <input 
                    type="file" 
                    accept="image/*" 
                    multiple 
                    onChange={e => handleImageUpload(e, 'gallery')} 
                    className="w-full mt-1 text-sm file:mr-4 file:py-2.5 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-700 transition-colors"
                    disabled={isUploading}
                  />
                  {formData.gallery && formData.gallery.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-3">
                      {formData.gallery?.map((url, index) => (
                        <div key={index} className="relative group">
                          <Image 
                            src={url} 
                            alt="Gallery preview" 
                            width={96} 
                            height={96}
                            className="h-24 w-24 object-cover rounded-lg shadow-sm border-2 border-gray-200" 
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveGalleryImage(index)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-md hover:bg-red-600 transition-colors"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </FormSection>

            <FormSection title="Filters">
              <p className="text-xs text-gray-600 mb-4">
                Filters are short, selectable options shown in the catalog sidebar to narrow down products. 
                <strong className="text-gray-700"> Material and Size are default filters.</strong> Add more as needed.
              </p>
              <div className="space-y-3">
                {formData.filters?.map((filter, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <input 
                      name="key" 
                      placeholder="Filter Key (e.g., Material, Size, Finish)" 
                      value={filter.key || ''} 
                      onChange={e => handleFilterChange(index, e)} 
                      className="md:col-span-3 p-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary" 
                    />
                    <input 
                      name="values" 
                      placeholder="Values (comma-separated)" 
                      value={Array.isArray(filter.values) ? filter.values.join(', ') : filter.values || ''} 
                      onChange={e => handleFilterChange(index, e)} 
                      className="md:col-span-8 p-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary" 
                    />
                    <button 
                      type="button" 
                      onClick={() => removeFilter(index)} 
                      className="md:col-span-1 p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors justify-self-center"
                      disabled={formData.filters?.length <= 2 && (filter.key === 'Material' || filter.key === 'Size')}
                      title={formData.filters?.length <= 2 && (filter.key === 'Material' || filter.key === 'Size') ? 'Material and Size are required' : 'Remove filter'}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button 
                type="button" 
                onClick={addFilter} 
                className="mt-4 w-full sm:w-auto px-4 py-2 text-sm text-primary hover:text-primary-700 font-semibold flex items-center justify-center gap-2 border-2 border-dashed border-primary/30 hover:border-primary/50 rounded-lg transition-colors bg-primary/5 hover:bg-primary/10"
              >
                <PlusIcon className="w-4 h-4" /> Add Filter
              </button>
            </FormSection>

            <FormSection title="Color Variants">
              <div className="space-y-5">
                <p className="text-sm text-gray-600 mb-4">Select the available colors for the product.</p>
                
                {/* Predefined Colors */}
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-3 uppercase tracking-wide">Predefined Colors</p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                    {AVAILABLE_COLORS.map(color => {
                      const isSelected = formData.colorVariants?.some(v => v.colorName === color.name);
                      return (
                        <label 
                          key={color.name} 
                          className={`flex items-center gap-2 cursor-pointer p-2.5 rounded-lg border-2 transition-all ${
                            isSelected 
                              ? 'border-primary bg-primary/5 shadow-sm' 
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <input 
                            type="checkbox" 
                            checked={isSelected} 
                            onChange={() => handleColorChange(color)} 
                            className="rounded h-4 w-4 text-primary focus:ring-primary border-gray-300"
                          />
                          <span 
                            style={{ backgroundColor: color.hex }} 
                            className="w-6 h-6 rounded-full border-2 border-gray-300 shadow-sm flex-shrink-0"
                          ></span>
                          <span className={`text-sm font-medium ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>
                            {color.name}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Colors */}
                {getCustomColors().length > 0 && (
                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-xs font-medium text-gray-700 mb-3 uppercase tracking-wide">Custom Colors</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
                      {getCustomColors().map(variant => (
                        <div 
                          key={variant.colorName} 
                          className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 shadow-sm"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span 
                              style={{ backgroundColor: variant.colorHex }} 
                              className="w-8 h-8 rounded-full border-2 border-gray-300 shadow-sm flex-shrink-0"
                            ></span>
                            <span className="text-sm font-medium text-gray-900 truncate">{variant.colorName}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomColor(variant.colorName)}
                            className="ml-2 p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors flex-shrink-0"
                            title="Remove custom color"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add Custom Color Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleOpenColorPicker}
                    className="w-full sm:w-auto px-4 py-2.5 text-sm text-primary hover:text-primary-700 font-semibold flex items-center justify-center gap-2 border-2 border-dashed border-primary/30 hover:border-primary/50 rounded-lg transition-colors bg-primary/5 hover:bg-primary/10"
                  >
                    <PlusIcon className="w-4 h-4" /> Add Custom Color
                  </button>
                </div>
              </div>

          {/* Color Picker Modal */}
          {showColorPicker && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowColorPicker(false);
                  setCustomColorName('');
                  setCustomColorHex('#000000');
                  setError('');
                }
              }}
            >
              <div 
                className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Add Custom Color</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setShowColorPicker(false);
                      setCustomColorName('');
                      setCustomColorHex('#000000');
                      setError('');
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded mb-4 text-sm">
                    {error}
                  </div>
                )}

                <ColorPicker
                  key={`picker-${showColorPicker}`}
                  initialColor={customColorHex}
                  initialName={customColorName}
                  onColorChange={(hex) => {
                    setCustomColorHex(hex);
                    setError('');
                  }}
                  onNameChange={(name) => {
                    setCustomColorName(name);
                    setError('');
                  }}
                />

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowColorPicker(false);
                      setCustomColorName('');
                      setCustomColorHex('#000000');
                      setError('');
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md font-semibold hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddCustomColor}
                    className="px-4 py-2 bg-primary text-white rounded-md font-semibold hover:bg-primary-700"
                  >
                    Add Color
                  </button>
                </div>
              </div>
            </div>
          )}
              {formData.colorVariants && formData.colorVariants.length > 0 && (
                <div className="space-y-4 pt-5 border-t border-gray-200 mt-5">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">Upload images for selected colors:</label>
                    <p className="text-xs text-gray-500">
                      ⭐ = Default color (shown when page loads)
                    </p>
                  </div>
                  {formData.colorVariants.map(variant => (
                    <div 
                      key={variant.colorName} 
                      className={`p-4 rounded-lg border-2 transition-all ${
                        variant.isDefault 
                          ? 'bg-amber-50 border-amber-300' 
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span 
                            style={{ backgroundColor: variant.colorHex }} 
                            className={`w-6 h-6 rounded-full border-2 shadow-sm ${
                              variant.isDefault ? 'border-amber-400 ring-2 ring-amber-300' : 'border-gray-300'
                            }`}
                          ></span>
                          <p className="font-semibold text-sm text-gray-900">{variant.colorName}</p>
                          {variant.isDefault && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-200 text-amber-800">
                              ⭐ Default
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSetDefaultColor(variant.colorName)}
                          disabled={variant.isDefault}
                          className={`text-xs px-2 py-1 rounded transition-colors ${
                            variant.isDefault 
                              ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                              : 'bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-300'
                          }`}
                          title={variant.isDefault ? 'This is the default color' : 'Set as default color'}
                        >
                          {variant.isDefault ? 'Default' : 'Set as Default'}
                        </button>
                      </div>
                      <div>
                        <input 
                          type="file" 
                          accept="image/*" 
                          multiple 
                          onChange={e => handleColorImageUpload(e, variant.colorName)} 
                          className="w-full text-sm file:mr-2 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-700 transition-colors"
                          disabled={isUploading}
                        />
                        {variant.images && variant.images.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {variant.images.map((url, index) => (
                              <div key={index} className="relative group">
                                <Image 
                                  src={url} 
                                  alt={`${variant.colorName} preview`} 
                                  width={80} 
                                  height={80}
                                  className="h-20 w-20 object-cover rounded-lg shadow-sm border-2 border-gray-200" 
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRemoveColorImage(variant.colorName, index)}
                                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-md hover:bg-red-600 transition-colors"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
        </FormSection>
        
            <FormSection title="Specifications">
          <div className="space-y-3">
            {formData.specifications?.map((spec, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-8 gap-2 items-center">
                <input 
                  name="label" 
                  placeholder="Label (e.g., Diameter)" 
                  value={spec.label} 
                  onChange={e => handleSpecChange(index, e)} 
                  className="md:col-span-3 p-2 border rounded-md" 
                />
                <input 
                  name="value" 
                  placeholder="Value" 
                  value={spec.value} 
                  onChange={e => handleSpecChange(index, e)} 
                  className="md:col-span-2 p-2 border rounded-md" 
                />
                <input 
                  name="unit" 
                  placeholder="Unit (e.g., cm)" 
                  value={spec.unit || ''} 
                  onChange={e => handleSpecChange(index, e)} 
                  className="md:col-span-2 p-2 border rounded-md" 
                />
                <button 
                  type="button" 
                  onClick={() => removeSpec(index)} 
                  className="text-red-500 hover:text-red-700 justify-self-center"
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
          <button 
            type="button" 
            onClick={addSpec} 
            className="mt-2 text-sm text-primary hover:underline font-semibold flex items-center gap-1"
          >
            <PlusIcon className="w-4 h-4" /> Add Specification
          </button>
        </FormSection>

            <FormSection title="Related Products">
          <div className="flex justify-between items-end mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-800">Manual Override</label>
              <p className="text-xs text-gray-500">Select related products manually. Top recommendations are sorted first.</p>
            </div>
            <button 
              type="button" 
              onClick={handleAutoSuggestRelated} 
              className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold py-1.5 px-3 rounded-md flex items-center gap-1 transition-colors"
            >
              <MagicIcon className="w-4 h-4" /> Auto-Generate Suggestions
            </button>
          </div>
          
          <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-md space-y-0 divide-y divide-gray-100 bg-gray-50">
            {getSortedRelatedCandidates.map(otherProduct => {
              // High match = has shared tags (score >= 5) OR very high overall score
              const isHighMatch = otherProduct.relevanceScore >= 5;
              const productId = otherProduct._id || otherProduct.id;
              const isSelected = formData.relatedProductIds?.some(id => id?.toString() === productId?.toString());
              
              return (
                <label 
                  key={productId} 
                  className={`flex items-center justify-between p-2 hover:bg-white transition-colors cursor-pointer group ${isSelected ? 'bg-blue-50' : ''}`}
                >
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <input 
                      type="checkbox" 
                      checked={isSelected} 
                      onChange={() => handleRelatedProductChange(productId)}
                      className="h-4 w-4 rounded text-primary focus:ring-primary border-gray-300" 
                    />
                    <Image 
                      src={otherProduct.heroImage} 
                      alt="" 
                      width={32} 
                      height={32}
                      className="w-8 h-8 rounded object-cover border border-gray-200" 
                    />
                    <div className="flex flex-col truncate">
                      <span className={`text-sm ${isSelected ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                        {otherProduct.title}
                      </span>
                      {otherProduct.relevanceReasons.length > 0 && (
                        <span className="text-[10px] text-gray-500 flex gap-1">
                          Match: {otherProduct.relevanceReasons.slice(0, 2).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                  {isHighMatch && (
                    <div className="text-amber-500 mr-2" title="High relevance match">
                      <StarIcon filled />
                    </div>
                  )}
                </label>
              );
            })}
            {allProducts.length <= 1 && (
              <p className="text-sm text-gray-500 italic p-4 text-center">No other products available to link.</p>
            )}
          </div>
        </FormSection>

            <FormSection title="Availability">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 items-start">
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select 
                name="status" 
                value={formData.status} 
                onChange={handleChange} 
                className="w-full mt-1 p-2.5 sm:p-2 border border-gray-300 rounded-md shadow-sm text-base"
              >
                <option value="In Stock">In Stock</option>
                <option value="Out of Stock">Out of Stock</option>
                <option value="Pre-Order">Pre-Order</option>
              </select>
            </div>
            <div className="space-y-3 pt-1">
              <div className="flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  name="featured" 
                  id="featured" 
                  checked={!!formData.featured} 
                  onChange={handleChange} 
                  className="h-4 w-4 rounded text-primary focus:ring-primary" 
                />
                <label htmlFor="featured" className="text-sm font-medium">Featured Product</label>
              </div>
              <div className="flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  name="isPremium" 
                  id="isPremium" 
                  checked={!!formData.isPremium} 
                  onChange={handleChange} 
                  className="h-4 w-4 rounded text-primary focus:ring-primary" 
                />
                <label htmlFor="isPremium" className="text-sm font-medium flex items-center gap-2">
                  <StarIcon className="w-4 h-4 text-yellow-500" />
                  Premium Collection
                </label>
              </div>
            </div>
          </div>
        </FormSection>

          </div>
        </div>

        {isUploading && (
          <div className="text-blue-600 font-medium text-center mt-6">Uploading images, please wait...</div>
        )}
        
        <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 pt-4 sm:pt-6 border-t mt-6">
          <button 
            type="button" 
            onClick={onCancel} 
            className="w-full sm:w-auto px-6 py-2.5 sm:py-2 bg-gray-200 text-gray-700 rounded-md font-semibold hover:bg-gray-300 text-base"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="w-full sm:w-auto px-6 py-2.5 sm:py-2 bg-primary text-white rounded-md font-semibold hover:bg-primary-700 text-base" 
            disabled={isUploading}
          >
            {isUploading ? 'Uploading...' : 'Save Product'}
          </button>
        </div>
      </form>
    </div>
  );
}
