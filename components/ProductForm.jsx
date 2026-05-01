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
import { PlusIcon, TrashIcon, MagicIcon, StarIcon, DragHandleIcon, SearchIcon } from './Icons';
import Image from 'next/image';
import ColorPicker from './ColorPicker';
import useSWR from 'swr';
import RichTextEditor from './RichTextEditor';
import toast from 'react-hot-toast';

function getTextLength(str) {
  if (!str || typeof str !== 'string') return 0;
  return str.replace(/<[^>]*>/g, '').trim().length;
}

function plainTextToHtml(text) {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (!trimmed) return '';
  return trimmed
    .split(/\n\n+/)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function sanitizeNumberInput(value) {
  return String(value ?? '')
    .replace(/,/g, '')
    .replace(/[^\d.]/g, '');
}

function generatePersistedVariantId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function formatIndianNumberInput(value) {
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
 * Uploads a file to Cloudflare R2 via the API.
 * - Images are compressed on frontend before upload.
 * - Documents are uploaded as-is.
 */
async function uploadToR2(file, options = {}) {
  const { allowedTypes = 'image', folder = 'products' } = options;
  // Dynamically import compression library to keep bundle size small
  const imageCompression = (await import('browser-image-compression')).default;
  
  const MAX_INPUT_SIZE = 15 * 1024 * 1024; // 15MB - reject files larger than this
  const MAX_OUTPUT_SIZE = 1.5 * 1024 * 1024; // 1.5MB - only compress if larger than this
  
  try {
    // Hard pre-check: Reject files larger than 15MB
    if (file.size > MAX_INPUT_SIZE) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      throw new Error(`File size (${fileSizeMB}MB) exceeds the maximum allowed size of 15MB. Please choose a smaller image.`);
    }
    
    // Validate file type
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const validDocumentTypes = ['application/pdf'];
    const allowedMimeTypes = allowedTypes === 'document' ? validDocumentTypes : validImageTypes;
    if (!allowedMimeTypes.includes(file.type)) {
      throw new Error(
        allowedTypes === 'document'
          ? 'Invalid file type. Only PDF files are allowed.'
          : 'Invalid file type. Only images (JPEG, PNG, GIF, WebP) are allowed.'
      );
    }
    
    let fileToUpload = file;
    
    // Compress image if it's larger than 1.5MB (preserve original quality for smaller images)
    if (allowedTypes !== 'document' && file.size > MAX_OUTPUT_SIZE) {
      try {
        const compressionOptions = {
          maxSizeMB: 1.5, // Target 1.5MB max
          // maxWidthOrHeight omitted to prevent resizing - only compress quality
          useWebWorker: true, // Use Web Worker for better performance
          fileType: file.type, // Preserve original file type
          preserveExif: false, // Remove EXIF data to reduce size
        };
        
        fileToUpload = await imageCompression(file, compressionOptions);
        
        // Validate compressed file size before uploading
        if (fileToUpload.size > MAX_OUTPUT_SIZE * 1.1) { // Allow 10% buffer
          const compressedSizeMB = (fileToUpload.size / (1024 * 1024)).toFixed(2);
          throw new Error(`Compression failed: Image is still ${compressedSizeMB}MB after compression. Please try a smaller image.`);
        }
      } catch (compressionError) {
        // If compression fails, provide helpful error message
        if (compressionError.message.includes('Compression failed')) {
          throw compressionError;
        }
        throw new Error(`Image compression failed: ${compressionError.message}. Please try a different image.`);
      }
    }
    
    // Create FormData with compressed file (preserve original filename)
    const formData = new FormData();
    formData.append('file', fileToUpload, file.name);
    
    // Upload to server
    const response = await fetch(`/api/upload?folder=${encodeURIComponent(folder)}`, {
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
  } catch (error) {
    // Re-throw with clear error message
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Upload failed: ${String(error)}`);
  }
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

export default function ProductForm({ product, allProducts, onSave, onCancel, onCategoryChange, onVariantsOnlyChange }) {
  const { categories, brands, businessTypes } = useAppContext();
  
  const [formData, setFormData] = useState({
    title: '',
    brand: '',
    manufacturer: '',
    sku: '',
    barcode: '',
    hsnCode: '',
    brandCategoryId: '',
    brandCategoryIds: [],
    categoryId: '',
    categoryIds: [],
    summary: '',
    description: '',
    usageAndCare: '',
    whyBuyFrom: '',
    price: 0,
    priceBySize: [],
    originalPrice: null,
    businessTypeSlugs: [],
    heroImage: '',
    gallery: [],
    specifications: [],
    faqs: [],
    testimonials: [],
    detailPhotos: [],
    relatedProductIds: [],
    frequentlyOrderedTogetherProductIds: [],
    featured: false,
    isPremium: false,
    tags: [],
    tagsInput: '',
    status: 'In Stock',
    sizeChartUrl: '',
    brochureUrl: '',
    blogUrl: '',
    colorVariants: [],
    filters: [{ key: 'Material', values: [] }, { key: 'Size', values: [] }],
    availableSizes: '', // Optional field for comma-separated sizes
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
  const [relatedProductsSearchQuery, setRelatedProductsSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [showAddVariantsPanel, setShowAddVariantsPanel] = useState(false);
  const [variantFieldSelection, setVariantFieldSelection] = useState({
    size: false,
    color: false,
    weight: false,
    unitCount: false,
  });
  const [variantBuilderInputs, setVariantBuilderInputs] = useState({
    size: '',
    color: '',
    weight: '',
    unitCount: '',
  });
  const [variantDraftValue, setVariantDraftValue] = useState({
    size: '',
    color: '',
    weight: '',
    unitCount: '',
  });
  const [variantRows, setVariantRows] = useState([]);
  const [selectedVariantRowIndex, setSelectedVariantRowIndex] = useState(null);
  const [showVariantsOnly, setShowVariantsOnly] = useState(false);
  const [recentlyDeletedVariantRow, setRecentlyDeletedVariantRow] = useState(null);
  const isCreatingMultipleVariants = (variantRows || []).length > 0;
  const selectedVariantFieldCount = Object.values(variantFieldSelection).filter(Boolean).length;
  const [bulkVariantInputs, setBulkVariantInputs] = useState({
    name: '',
    sku: '',
    barcode: '',
    hsnCode: '',
    gstPercent: '',
    mrp: '',
    sellingPrice: '',
    discountPercent: '',
    marginPrice: '',
  });

  useEffect(() => {
    if (typeof onVariantsOnlyChange === 'function') {
      onVariantsOnlyChange(showVariantsOnly);
    }
  }, [showVariantsOnly, onVariantsOnlyChange]);

  useEffect(() => {
    // Parent SKU/Barcode should stay empty when variant-level SKU/Barcode are used.
    if (!isCreatingMultipleVariants) return;
    setFormData((prev) => {
      if (!prev?.sku && !prev?.barcode) return prev;
      return {
        ...prev,
        sku: '',
        barcode: '',
      };
    });
  }, [isCreatingMultipleVariants]);

  useEffect(() => {
    const incomingVariants = Array.isArray(product?.variants) ? product.variants : [];
    if (incomingVariants.length === 0) {
      setVariantRows([]);
      return;
    }

    const normalized = incomingVariants.map((variant) => ({
      _rowId: createVariantRowId(),
      variantId: String(variant?.variantId || '').trim() || generatePersistedVariantId(),
      name: String(variant?.name || '').trim() || String(product?.title || ''),
      size: String(variant?.size || '').trim(),
      color: String(variant?.color || '').trim(),
      unitCount: String(variant?.unitCount || '').trim(),
      weight: String(variant?.weight || '').trim(),
      isDefault: Boolean(variant?.isDefault),
      images: Array.isArray(variant?.images) ? variant.images.filter(Boolean) : [],
      sku: String(variant?.sku || '').trim(),
      barcode: String(variant?.barcode || '').trim(),
      hsnCode: String(variant?.hsnCode || '').trim(),
      gstPercent: Number(variant?.gstPercent || 0),
      mrp: Number(variant?.mrp || 0),
      sellingPrice: Number(variant?.sellingPrice || variant?.price || 0),
      discountPercent: Number(variant?.discountPercent || 0),
      marginPrice: Number(variant?.marginPrice || 0),
      price: Number(variant?.sellingPrice || variant?.price || 0),
    }));

    setVariantRows(normalized);

    setVariantFieldSelection({
      size: normalized.some((row) => row.size),
      color: normalized.some((row) => row.color),
      unitCount: normalized.some((row) => row.unitCount),
      weight: normalized.some((row) => row.weight),
    });
  }, [product]);

  // Price-by-size helpers
  const addPriceBySizeRow = () => {
    const next = [...(formData.priceBySize || []), { price: '', size: '', unit: '' }];
    setFormData((prev) => ({ ...prev, priceBySize: next }));
  };

  const removePriceBySizeRow = (index) => {
    const next = (formData.priceBySize || []).filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, priceBySize: next }));
  };

  const handlePriceBySizeChange = (index, field, value) => {
    const next = (formData.priceBySize || []).map((row, i) =>
      i === index ? { ...row, [field]: value } : row
    );
    setFormData((prev) => ({ ...prev, priceBySize: next }));
  };

  const selectedColorNames = (formData.colorVariants || [])
    .map((variant) => String(variant?.colorName || '').trim())
    .filter(Boolean);

  const handleVariantFieldToggle = (field) => {
    setVariantFieldSelection((prev) => {
      if (prev[field]) {
        setError('');
        return {
          ...prev,
          [field]: false,
        };
      }

      const selectedCount = Object.values(prev).filter(Boolean).length;
      if (selectedCount >= 2) {
        setError('You can select only 2 variant fields at a time.');
        return prev;
      }

      setError('');
      return {
        ...prev,
        [field]: true,
      };
    });
  };

  const addVariantOptionValue = (field) => {
    const nextValue = String(variantDraftValue[field] || '').trim();
    if (!nextValue) return;

    const existing = parseOptionValues(variantBuilderInputs[field]);
    const exists = existing.some((value) => value.toLowerCase() === nextValue.toLowerCase());
    const nextList = exists ? existing : [...existing, nextValue];

    setVariantBuilderInputs((prev) => ({
      ...prev,
      [field]: nextList.join(', '),
    }));
    setVariantDraftValue((prev) => ({
      ...prev,
      [field]: '',
    }));
  };

  const parseOptionValues = (raw) =>
    String(raw || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

  const getVariantCombinationKey = (combo) =>
    [combo.size || '', combo.color || '', combo.weight || '', combo.unitCount || '']
      .map((value) => String(value).toLowerCase())
      .join('|');

  const createVariantRowId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const createEmptyVariantRow = () => ({
    _rowId: createVariantRowId(),
    variantId: generatePersistedVariantId(),
    name: formData.title || '',
    size: '',
    color: '',
    unitCount: '',
    weight: '',
    isDefault: false,
    images: [],
    sku: '',
    barcode: '',
    hsnCode: '',
    gstPercent: 0,
    mrp: 0,
    sellingPrice: 0,
    discountPercent: 0,
    marginPrice: 0,
    price: '',
  });

  const handleGenerateVariantRows = () => {
    const dimensions = [];

    if (variantFieldSelection.size) {
      const values = parseOptionValues(variantBuilderInputs.size);
      if (values.length === 0) {
        setError('Please enter at least one Size value.');
        return;
      }
      dimensions.push({ key: 'size', values });
    }

    if (variantFieldSelection.color) {
      const values = selectedColorNames.length > 0 ? selectedColorNames : parseOptionValues(variantBuilderInputs.color);
      if (values.length === 0) {
        setError('Please enter at least one Color value or select colors in Color Variants.');
        return;
      }
      dimensions.push({ key: 'color', values });
    }

    if (variantFieldSelection.weight) {
      const values = parseOptionValues(variantBuilderInputs.weight);
      if (values.length === 0) {
        setError('Please enter at least one Weight value.');
        return;
      }
      dimensions.push({ key: 'weight', values });
    }

    if (variantFieldSelection.unitCount) {
      const values = parseOptionValues(variantBuilderInputs.unitCount);
      if (values.length === 0) {
        setError('Please enter at least one Unit Count value.');
        return;
      }
      dimensions.push({ key: 'unitCount', values });
    }

    if (dimensions.length === 0) {
      setError('Please tick at least one variant field to generate variants.');
      return;
    }

    if (dimensions.length !== 2) {
      setError('Please select exactly 2 variant fields to generate variants.');
      return;
    }

    const combos = dimensions.reduce(
      (acc, dim) => acc.flatMap((base) => dim.values.map((value) => ({ ...base, [dim.key]: value }))),
      [{}]
    );

    const existingByKey = new Map((variantRows || []).map((row) => [getVariantCombinationKey(row), row]));

    const nextRows = combos.map((combo) => {
      const key = getVariantCombinationKey(combo);
      const existing = existingByKey.get(key);
      if (existing) {
        const vid = String(existing.variantId || '').trim();
        return vid ? existing : { ...existing, variantId: generatePersistedVariantId() };
      }

      return {
        ...createEmptyVariantRow(),
        size: combo.size || '',
        color: combo.color || '',
        unitCount: combo.unitCount || '',
        weight: combo.weight || '',
      };
    });

    setError('');
    setVariantRows(nextRows);
  };

  const handleVariantRowChange = (index, field, value) => {
    setVariantRows((prev) =>
      prev.map((row, rowIndex) => {
        if (rowIndex !== index) return row;

        const normalizedValue = ['mrp', 'sellingPrice', 'marginPrice'].includes(field)
          ? sanitizeNumberInput(value)
          : value;
        const nextRow = { ...row, [field]: normalizedValue };

        // Auto-calculate discount when MRP/Selling Price changes.
        if (field === 'mrp' || field === 'sellingPrice') {
          const mrpValue = Number(nextRow.mrp || 0);
          const sellingValue = Number(nextRow.sellingPrice || 0);
          if (Number.isFinite(mrpValue) && mrpValue > 0 && Number.isFinite(sellingValue)) {
            const rawDiscount = ((mrpValue - sellingValue) / mrpValue) * 100;
            const normalizedDiscount = Math.max(0, rawDiscount);
            nextRow.discountPercent = Number(normalizedDiscount.toFixed(2));
          } else {
            nextRow.discountPercent = 0;
          }
        }

        return nextRow;
      })
    );
  };

  const handleBulkVariantInputChange = (field, value) => {
    const normalizedValue = ['mrp', 'sellingPrice', 'marginPrice'].includes(field)
      ? sanitizeNumberInput(value)
      : value;
    setBulkVariantInputs((prev) => ({ ...prev, [field]: normalizedValue }));

    const isFieldEmptyForRow = (row, key) => {
      const raw = row?.[key];
      if (raw === null || raw === undefined) return true;
      if (typeof raw === 'number') return raw === 0;
      return String(raw).trim() === '';
    };

    setVariantRows((prev) => {
      const allRowsEmptyForField = prev.every((row) => isFieldEmptyForRow(row, field));
      if (!allRowsEmptyForField) return prev;

      return prev.map((row) => {
        const nextRow = { ...row, [field]: normalizedValue };
        if (field === 'mrp' || field === 'sellingPrice') {
          const mrpValue = Number(nextRow.mrp || 0);
          const sellingValue = Number(nextRow.sellingPrice || 0);
          if (Number.isFinite(mrpValue) && mrpValue > 0 && Number.isFinite(sellingValue)) {
            const rawDiscount = ((mrpValue - sellingValue) / mrpValue) * 100;
            const normalizedDiscount = Math.max(0, rawDiscount);
            nextRow.discountPercent = Number(normalizedDiscount.toFixed(2));
          } else {
            nextRow.discountPercent = 0;
          }
        }
        return nextRow;
      });
    });
  };

  const handleApplyBulkInputs = () => {
    const targetFields = ['name', 'sku', 'barcode', 'hsnCode', 'gstPercent', 'mrp', 'sellingPrice', 'discountPercent', 'marginPrice'];
    const fieldsToApply = targetFields.filter((field) => {
      const value = bulkVariantInputs[field];
      return String(value ?? '').trim() !== '';
    });

    if (fieldsToApply.length === 0) {
      toast.error('Enter at least one Apply value first.');
      return;
    }

    const isFieldEmptyForRow = (row, key) => {
      const raw = row?.[key];
      if (raw === null || raw === undefined) return true;
      if (typeof raw === 'number') return raw === 0;
      return String(raw).trim() === '';
    };

    const willOverwrite = (variantRows || []).some((row) =>
      fieldsToApply.some((field) => !isFieldEmptyForRow(row, field))
    );
    if (willOverwrite) {
      const proceed = window.confirm('Some variant fields already have values. Apply will overwrite them for all rows. Continue?');
      if (!proceed) return;
    }

    setVariantRows((prev) =>
      prev.map((row) => {
        const nextRow = { ...row };
        fieldsToApply.forEach((field) => {
          const rawValue = bulkVariantInputs[field];
          const normalizedValue = ['mrp', 'sellingPrice', 'marginPrice'].includes(field)
            ? sanitizeNumberInput(rawValue)
            : rawValue;
          nextRow[field] = normalizedValue;
        });

        if (fieldsToApply.includes('mrp') || fieldsToApply.includes('sellingPrice')) {
          const mrpValue = Number(nextRow.mrp || 0);
          const sellingValue = Number(nextRow.sellingPrice || 0);
          if (Number.isFinite(mrpValue) && mrpValue > 0 && Number.isFinite(sellingValue)) {
            const rawDiscount = ((mrpValue - sellingValue) / mrpValue) * 100;
            const normalizedDiscount = Math.max(0, rawDiscount);
            nextRow.discountPercent = Number(normalizedDiscount.toFixed(2));
          } else {
            nextRow.discountPercent = 0;
          }
        }
        return nextRow;
      })
    );
  };

  const handleSetDefaultVariantRow = (index) => {
    setVariantRows((prev) =>
      prev.map((row, rowIndex) => ({
        ...row,
        isDefault: rowIndex === index,
      }))
    );
  };

  const handleVariantRowImageUpload = async (e, index) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setError('');
    try {
      const uploadPromises = Array.from(files).map((file) => uploadToR2(file));
      const uploadedUrls = await Promise.all(uploadPromises);
      setVariantRows((prev) =>
        prev.map((row, rowIndex) =>
          rowIndex === index
            ? { ...row, images: [...(row.images || []), ...uploadedUrls] }
            : row
        )
      );
    } catch (error) {
      console.error('Variant image upload failed', error);
      setError(`Variant image upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveVariantRowImage = (rowIndex, imageIndex) => {
    setVariantRows((prev) =>
      prev.map((row, idx) =>
        idx === rowIndex
          ? { ...row, images: (row.images || []).filter((_, i) => i !== imageIndex) }
          : row
      )
    );
  };

  const getVariantPricingErrors = (row) => {
    const mrp = Number(row?.mrp || 0);
    const sellingPrice = Number(row?.sellingPrice || 0);
    const marginPrice = Number(row?.marginPrice || 0);
    const discountPercent = Number(row?.discountPercent || 0);

    return {
      sellingPrice: Number.isFinite(sellingPrice) && Number.isFinite(mrp) && sellingPrice > mrp,
      marginPrice: Number.isFinite(marginPrice) && Number.isFinite(sellingPrice) && marginPrice > sellingPrice,
      discountPercent: Number.isFinite(discountPercent) && discountPercent >= 100,
    };
  };

  const handleAddSingleVariantRow = () => {
    setVariantRows((prev) => [...prev, createEmptyVariantRow()]);
    setError('');
  };

  const handleDeleteVariantRow = (index) => {
    const rowToDelete = variantRows[index];
    if (!rowToDelete) return;

    const confirmed = window.confirm('Delete this variant row? You can undo this action.');
    if (!confirmed) return;

    setVariantRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
    setRecentlyDeletedVariantRow({ row: rowToDelete, index });
    setSelectedVariantRowIndex((prev) => {
      if (prev === null) return null;
      if (prev === index) return null;
      return prev > index ? prev - 1 : prev;
    });
  };

  const handleUndoDeleteVariantRow = () => {
    if (!recentlyDeletedVariantRow) return;
    const { row, index } = recentlyDeletedVariantRow;
    setVariantRows((prev) => {
      const next = [...prev];
      const safeIndex = Math.max(0, Math.min(index, next.length));
      next.splice(safeIndex, 0, row);
      return next;
    });
    setRecentlyDeletedVariantRow(null);
  };
  
  // Debounce search query to avoid too many API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(relatedProductsSearchQuery);
    }, 300); // 300ms debounce
    
    return () => clearTimeout(timer);
  }, [relatedProductsSearchQuery]);
  
  // Fetch products from API when searching (searches ALL products, not just 200)
  const searchProductsUrl = debouncedSearchQuery.trim() 
    ? `/api/products?search=${encodeURIComponent(debouncedSearchQuery.trim())}&limit=500`
    : null;
  
  const { data: searchProductsData } = useSWR(
    searchProductsUrl,
    (url) => fetch(url).then(res => res.json()),
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000, // Cache for 5 seconds
    }
  );
  
  const searchedProducts = searchProductsData?.products || [];
  
  // AI generation state
  const [aiLoading, setAiLoading] = useState({ summary: false, description: false });
  const [aiCooldown, setAiCooldown] = useState({ summary: false, description: false });
  
  // Drag and drop state for specifications
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const lastAiCallRef = useRef({ summary: 0, description: 0 });
  
  // Specifications JSON mode state
  const [specJsonMode, setSpecJsonMode] = useState(false);
  const [specJsonInput, setSpecJsonInput] = useState('');
  const [specJsonError, setSpecJsonError] = useState('');
  
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
    const hasSubstantialText = getTextLength(currentText) > 20;
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

      // Update form data with generated text (convert plain text to simple HTML)
      const html = plainTextToHtml(data.text);
      setFormData(prev => ({
        ...prev,
        [field]: html,
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
    
    // Don't auto-generate tags for duplicate products - user must click "Auto-Generate Tags" button
    const isDuplicateProduct = product && !product._id && !product.id;
    if (isDuplicateProduct) return;
    
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
    showTagsPreview,
    product // Include to check if product is a duplicate
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
    // For duplicate products without ID, use a hash of the product data to track initialization
    const productKey = currentProductId || (product ? JSON.stringify(product).substring(0, 100) : null);
    
    if (product && initializedProductIdRef.current !== productKey) {
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
      
      // Extract related product IDs - handle both populated objects and plain IDs
      const relatedProductIds = (product.relatedProductIds || []).map(rp => 
        (rp?._id || rp)?.toString()
      ).filter(Boolean);

      const frequentlyOrderedTogetherProductIds = (product.frequentlyOrderedTogetherProductIds || [])
        .map(rp => (rp?._id || rp)?.toString())
        .filter(Boolean);
      
      // Always set form data, even if categories/brands aren't loaded yet
      setFormData({
        ...product,
        categoryId: categoryId?.toString() || '',
        categoryIds: categoryIds.map(cid => (cid?._id || cid)?.toString()).filter(Boolean),
        brandCategoryId: brandCategoryId?.toString() || '',
        brandCategoryIds: brandCategoryIds.map(bid => (bid?._id || bid)?.toString()).filter(Boolean),
        tagsInput: (product.tags || []).join(', '),
        filters: filters,
        availableSizes: product.availableSizes || '',
        // Ensure these fields are properly initialized
        gallery: product.gallery || [],
        specifications: product.specifications || [],
        faqs: product.faqs || [],
        testimonials: product.testimonials || [],
        detailPhotos: product.detailPhotos || [],
        summary: product.summary || '',
        description: product.description || '',
        manufacturer: product.manufacturer || '',
        barcode: product.barcode || '',
        hsnCode: product.hsnCode || '',
        usageAndCare: product.usageAndCare || '',
        whyBuyFrom: product.whyBuyFrom || '',
        sizeChartUrl: product.sizeChartUrl || '',
        brochureUrl: product.brochureUrl || '',
        blogUrl: product.blogUrl || '',
        businessTypeSlugs: product.businessTypeSlugs || [],
        relatedProductIds: relatedProductIds,
        frequentlyOrderedTogetherProductIds: frequentlyOrderedTogetherProductIds,
      });

      // Initialize category/brand selections only if categories/brands are loaded
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
      
      initializedProductIdRef.current = productKey;
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
    let finalCategoryId = null;
    if (id) {
      // When selecting a category, set categoryId to that category
      finalCategoryId = id;
      setFormData({ ...formData, categoryId: id });
    } else {
      // If clearing a selection, find the most specific remaining level
      // Check from most specific to least specific
      const mostSpecificLevel = ['type', 'subcategory', 'category', 'department'].find(l => newSelection[l]);
      if (mostSpecificLevel) {
        finalCategoryId = newSelection[mostSpecificLevel];
        setFormData({ ...formData, categoryId: finalCategoryId });
      } else {
        finalCategoryId = null;
        setFormData({ ...formData, categoryId: '' });
      }
    }
    
    // Notify parent component of category change for dynamic product fetching
    if (onCategoryChange) {
      onCategoryChange(finalCategoryId);
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

    // Determine the most specific level selected for brandCategoryId
    const mostSpecificLevel = ['subcategory', 'category', 'department'].find(l => newSelection[l]);
    let brandCategoryId = '';
    let brandName = '';
    
    if (mostSpecificLevel && newSelection[mostSpecificLevel]) {
      brandCategoryId = newSelection[mostSpecificLevel];
    }
    
    // Always use department name for the top brand field
    if (newSelection.department) {
      const departmentBrand = brands.find(b => {
        const bId = b._id || b.id;
        return bId?.toString() === newSelection.department.toString();
      });
      
      if (departmentBrand && departmentBrand.name) {
        brandName = departmentBrand.name;
      }
    }
    
    // Update both brandCategoryId (most specific level) and brand (department name)
    setFormData({ 
      ...formData, 
      brandCategoryId: brandCategoryId,
      brand: brandName
    });
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

  const handleFrequentlyOrderedProductChange = (productId) => {
    const current = formData.frequentlyOrderedTogetherProductIds || [];
    const productIdStr = productId?.toString();
    if (current.some(id => id?.toString() === productIdStr)) {
      setFormData({
        ...formData,
        frequentlyOrderedTogetherProductIds: current.filter(id => id?.toString() !== productIdStr),
      });
    } else {
      setFormData({ ...formData, frequentlyOrderedTogetherProductIds: [...current, productId] });
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
    
    // Fallback: If filtered pool is empty, show all products (except current)
    // This ensures users can still select related products even if category filter is too strict
    if (candidatePool.length === 0 && allProducts.length > 0) {
      candidatePool = allProducts.filter(p => {
        const pid = p._id || p.id;
        return pid?.toString() !== currentProductId?.toString();
      });
    }
    
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

  // Get products to use for related products selection
  // When searching, use server-side search results (searches ALL products)
  // When not searching, use allProducts passed as prop
  const availableProductsForSelection = useMemo(() => {
    if (debouncedSearchQuery.trim() && searchedProducts.length > 0) {
      // When searching, use server-side search results
      // Merge with allProducts to ensure we have all products for relevance scoring
      const allProductIds = new Set(allProducts.map(p => (p._id || p.id)?.toString()));
      const searchedProductIds = new Set(searchedProducts.map(p => (p._id || p.id)?.toString()));
      
      // Combine: searched products + any products from allProducts not in search results
      const combined = [...searchedProducts];
      allProducts.forEach(p => {
        const pid = (p._id || p.id)?.toString();
        if (pid && !searchedProductIds.has(pid)) {
          combined.push(p);
        }
      });
      
      return combined;
    }
    // When not searching, use allProducts
    return allProducts;
  }, [debouncedSearchQuery, searchedProducts, allProducts]);

  // Recalculate sorted candidates with updated product list when searching
  const getSortedRelatedCandidatesWithSearch = useMemo(() => {
    const currentProductId = product?._id || product?.id;
    
    // Use availableProductsForSelection instead of allProducts
    const productsToUse = availableProductsForSelection;
    
    // LAYER 1: Category = Candidate Pool (Filter, not score)
    const formCategoryId = formData.categoryId;
    const formCategory = categories.find(c => {
      const cId = c._id || c.id;
      return cId?.toString() === formCategoryId?.toString();
    });
    
    const formCategoryAncestry = formCategoryId ? getCategoryAncestry(formCategoryId, categories) : {};
    const formSubcategoryId = formCategoryAncestry.subcategory;
    const formTypeId = formCategoryAncestry.type;
    
    // Filter candidates by same subcategory OR same type
    let candidatePool = productsToUse.filter(p => {
      const pid = p._id || p.id;
      if (pid?.toString() === currentProductId?.toString()) {
        return false;
      }
      
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
      
      const candidateAncestry = getCategoryAncestry(candidateCategoryId, categories);
      const candidateSubcategoryId = candidateAncestry.subcategory;
      const candidateTypeId = candidateAncestry.type;
      
      if (formTypeId && candidateTypeId) {
        return formTypeId.toString() === candidateTypeId.toString();
      }
      if (formSubcategoryId && candidateSubcategoryId) {
        return formSubcategoryId.toString() === candidateSubcategoryId.toString();
      }
      
      if (formCategory && candidateCategory) {
        return formCategory.level === candidateCategory.level && 
               formCategoryId.toString() === candidateCategoryId.toString();
      }
      
      return false;
    });
    
    // Fallback: If filtered pool is empty, show all products (except current)
    if (candidatePool.length === 0 && productsToUse.length > 0) {
      candidatePool = productsToUse.filter(p => {
        const pid = p._id || p.id;
        return pid?.toString() !== currentProductId?.toString();
      });
    }
    
    // Get current tags (normalized)
    const currentTags = formData.tagsInput 
      ? formData.tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
      : (formData.tags || []).map(t => t.toLowerCase()).filter(Boolean);

    // LAYER 2: Shared Signals = Relevance (Scoring)
    return candidatePool.map(candidate => {
      let score = 0;
      let reasons = [];

      // Tags = PRIMARY SIGNAL
      const sharedTags = (candidate.tags || []).filter(t => 
        currentTags.includes(t.toLowerCase())
      );
      if (sharedTags.length > 0) {
        score += sharedTags.length * 5;
        reasons.push(`${sharedTags.length} Shared Tag${sharedTags.length > 1 ? 's' : ''}`);
      }

      // Business Type = Secondary Signal
      const sharedBusiness = (candidate.businessTypeSlugs || []).filter(s => 
        formData.businessTypeSlugs?.includes(s)
      );
      if (sharedBusiness.length > 0) {
        score += sharedBusiness.length * 2;
        if (!reasons.some(r => r.includes('Business'))) {
          reasons.push(`${sharedBusiness.length} Shared Business Type${sharedBusiness.length > 1 ? 's' : ''}`);
        }
      }

      // Category = Small Influence
      const candidateCategoryId = candidate.categoryId?._id || candidate.categoryId;
      const formCategoryIdForScore = formData.categoryId;
      if (candidateCategoryId?.toString() === formCategoryIdForScore?.toString()) {
        score += 3;
        if (!reasons.some(r => r.includes('Category'))) {
          reasons.push('Same Category');
        }
      }

      // Price Proximity
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
      const aId = a._id || a.id;
      const bId = b._id || b.id;
      const aSelected = formData.relatedProductIds?.some(id => id?.toString() === aId?.toString());
      const bSelected = formData.relatedProductIds?.some(id => id?.toString() === bId?.toString());
      
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      
      // Then sort by relevance score
      return b.relevanceScore - a.relevanceScore;
    });
  }, [
    availableProductsForSelection,
    product,
    categories,
    formData.categoryId,
    formData.tagsInput,
    formData.businessTypeSlugs,
    formData.price,
    formData.relatedProductIds
  ]);

  // Filter related products candidates by search query
  // When searching: Simple direct search results (no category filtering, no relevance scoring)
  // When not searching: Use getSortedRelatedCandidates with relevance logic
  const filteredRelatedCandidates = useMemo(() => {
    if (!debouncedSearchQuery.trim()) {
      // Not searching - use original sorted candidates with relevance scoring
      return getSortedRelatedCandidates;
    }
    
    // When searching: Return simple search results without category/relevance logic
    // Just exclude the current product and sort selected products first
    const currentProductId = product?._id || product?.id;
    
    const simpleSearchResults = searchedProducts
      .filter(p => {
        const pid = p._id || p.id;
        return pid?.toString() !== currentProductId?.toString();
      })
      .map(p => ({
        ...p,
        relevanceScore: 0, // No relevance scoring for search
        relevanceReasons: [] // No match reasons for search
      }))
      .sort((a, b) => {
        // Only sort: selected products first, then alphabetical by title
        const aId = a._id || a.id;
        const bId = b._id || b.id;
        const aSelected = formData.relatedProductIds?.some(id => id?.toString() === aId?.toString());
        const bSelected = formData.relatedProductIds?.some(id => id?.toString() === bId?.toString());
        
        if (aSelected && !bSelected) return -1;
        if (!aSelected && bSelected) return 1;
        
        // Alphabetical by title
        return (a.title || '').localeCompare(b.title || '');
      });
    
    return simpleSearchResults;
  }, [debouncedSearchQuery, searchedProducts, getSortedRelatedCandidates, product, formData.relatedProductIds]);

  const handleAutoSuggestRelated = () => {
    // Use filtered candidates (respects search if active)
    const candidatesToUse = filteredRelatedCandidates.length > 0 
      ? filteredRelatedCandidates 
      : getSortedRelatedCandidates;
    
    // Filter candidates that have meaningful relationships (score > 0)
    // Prioritize tag-based matches (score >= 5 means at least 1 shared tag)
    const tagBasedMatches = candidatesToUse
      .filter(c => c.relevanceScore >= 5) // At least 1 shared tag
      .slice(0, 3); // Top 3 tag-based matches
    
    // If we have tag matches, use them
    // Otherwise, fall back to any matches with score > 0
    const topMatches = tagBasedMatches.length > 0
      ? tagBasedMatches
      : candidatesToUse
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
      } else if (field === 'detailPhotos') {
        const existing = formData.detailPhotos || [];
        const remaining = Math.max(0, 3 - existing.length);
        const picked = Array.from(files).slice(0, remaining);
        if (picked.length === 0) return;
        const uploadPromises = picked.map(file => uploadToR2(file));
        const newImageUrls = await Promise.all(uploadPromises);
        setFormData({ ...formData, detailPhotos: [...existing, ...newImageUrls].slice(0, 3) });
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

  const handleRemoveDetailPhoto = (index) => {
    const next = (formData.detailPhotos || []).filter((_, i) => i !== index);
    setFormData({ ...formData, detailPhotos: next });
  };

  const handleAttachmentUpload = async (field, file) => {
    if (!file) return;
    setIsUploading(true);
    setError('');
    try {
      const fileUrl = await uploadToR2(file, { allowedTypes: 'document', folder: 'products/attachments' });
      setFormData((prev) => ({ ...prev, [field]: fileUrl }));
    } catch (error) {
      console.error('Attachment upload failed', error);
      setError(`Attachment upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Testimonials helpers
  const addTestimonial = () => {
    const next = [
      ...(formData.testimonials || []),
      { quote: '', authorName: '', authorRole: '', companyName: '', companyLogo: '' },
    ];
    setFormData({ ...formData, testimonials: next });
  };

  const removeTestimonial = (index) => {
    const next = (formData.testimonials || []).filter((_, i) => i !== index);
    setFormData({ ...formData, testimonials: next });
  };

  const handleTestimonialChange = (index, field, value) => {
    const next = (formData.testimonials || []).map((t, i) => (i === index ? { ...t, [field]: value } : t));
    setFormData({ ...formData, testimonials: next });
  };

  const handleTestimonialLogoUpload = async (index, file) => {
    if (!file) return;
    setIsUploading(true);
    setError('');
    try {
      const imageUrl = await uploadToR2(file);
      const next = (formData.testimonials || []).map((t, i) =>
        i === index ? { ...t, companyLogo: imageUrl } : t
      );
      setFormData({ ...formData, testimonials: next });
    } catch (error) {
      console.error('Upload failed', error);
      setError(`Image upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
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

  const reorderSpecs = (fromIndex, toIndex) => {
    const newSpecs = [...(formData.specifications || [])];
    const [movedSpec] = newSpecs.splice(fromIndex, 1);
    newSpecs.splice(toIndex, 0, movedSpec);
    setFormData({ ...formData, specifications: newSpecs });
  };

  const handleSpecDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleSpecDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleSpecDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleSpecDrop = (e, index) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      reorderSpecs(draggedIndex, index);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleSpecDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  /**
   * Convert specifications array to JSON string
   */
  const convertSpecsToJson = () => {
    try {
      const specs = formData.specifications || [];
      
      // Build the JSON object
      const jsonObject = {
        specifications: []
      };
      
      // Handle empty array
      if (Array.isArray(specs) && specs.length > 0) {
        // Filter out null/undefined and ensure proper structure
        const validSpecs = specs
          .filter(spec => spec !== null && spec !== undefined)
          .map(spec => ({
            label: spec.label || '',
            value: spec.value || '',
            unit: spec.unit || ''
          }))
          .filter(spec => spec.label || spec.value || spec.unit); // Keep non-empty specs
        
        jsonObject.specifications = validSpecs;
      }
      
      return JSON.stringify(jsonObject, null, 2);
    } catch (error) {
      console.error('Error converting specs to JSON:', error);
      return JSON.stringify({ specifications: [] }, null, 2);
    }
  };

  /**
   * Validate and parse JSON specifications
   */
  const validateAndParseSpecJson = (jsonString) => {
    // Reset error
    setSpecJsonError('');
    
    // Handle empty/whitespace-only input
    if (!jsonString || !jsonString.trim()) {
      return { specifications: [] };
    }

    try {
      // Parse JSON
      const parsed = JSON.parse(jsonString.trim());
      
      // Handle both formats: object with specifications OR array (legacy)
      let specifications = [];
      
      if (Array.isArray(parsed)) {
        // Legacy format: just an array of specifications
        specifications = parsed;
      } else if (typeof parsed === 'object' && parsed !== null) {
        // Object format: { specifications: [...] }
        specifications = parsed.specifications || [];
      } else {
        setSpecJsonError('JSON must be an object with "specifications" array, or an array of specification objects');
        return null;
      }

      // Validate specifications is an array
      if (!Array.isArray(specifications)) {
        setSpecJsonError('"specifications" must be an array of objects');
        return null;
      }

      // Validate each item in array
      const validatedSpecs = specifications.map((item, index) => {
        // Handle null/undefined items
        if (item === null || item === undefined) {
          return { label: '', value: '', unit: '' };
        }

        // Handle non-object items
        if (typeof item !== 'object') {
          setSpecJsonError(`Specification at index ${index} must be an object`);
          return null;
        }

        // Ensure required structure with defaults
        return {
          label: item.label || '',
          value: item.value || '',
          unit: item.unit || ''
        };
      }).filter(item => item !== null);

      // Check if any items were invalid
      if (validatedSpecs.length !== specifications.length) {
        setSpecJsonError('Some specifications were invalid and have been filtered out');
      }

      return { specifications: validatedSpecs };
    } catch (error) {
      // Handle various JSON parsing errors
      if (error instanceof SyntaxError) {
        setSpecJsonError(`Invalid JSON: ${error.message}`);
      } else {
        setSpecJsonError(`Error parsing JSON: ${error.message}`);
      }
      return null;
    }
  };

  /**
   * Handle switching to JSON mode
   */
  const handleSwitchToJsonMode = () => {
    // Clear any pending debounce
    if (specJsonDebounceRef.current) {
      clearTimeout(specJsonDebounceRef.current);
    }
    
    const jsonString = convertSpecsToJson();
    setSpecJsonInput(jsonString);
    setSpecJsonMode(true);
    setSpecJsonError('');
  };

  /**
   * Handle switching to form mode
   */
  const handleSwitchToFormMode = () => {
    // Clear any pending debounce
    if (specJsonDebounceRef.current) {
      clearTimeout(specJsonDebounceRef.current);
    }
    
    const parsed = validateAndParseSpecJson(specJsonInput);
    
    if (parsed !== null) {
      setFormData({ 
        ...formData, 
        specifications: parsed.specifications,
        availableSizes: parsed.availableSizes
      });
      setSpecJsonMode(false);
      setSpecJsonError('');
    }
    // If validation fails, stay in JSON mode and show error
  };

  /**
   * Handle JSON input change with real-time validation
   */
  const specJsonDebounceRef = useRef(null);
  const handleSpecJsonChange = (value) => {
    setSpecJsonInput(value);
    
    // Clear previous timeout
    if (specJsonDebounceRef.current) {
      clearTimeout(specJsonDebounceRef.current);
    }
    
    // Only validate if JSON mode is active
    if (specJsonMode) {
      if (!value.trim()) {
        setSpecJsonError('');
        return;
      }
      
      // Debounce validation for better UX
      specJsonDebounceRef.current = setTimeout(() => {
        const result = validateAndParseSpecJson(value);
        // Result is now an object with {specifications, availableSizes} or null
        // Error is set inside validateAndParseSpecJson
      }, 500);
    } else {
      setSpecJsonError('');
    }
  };

  const handleFilterChange = (index, e) => {
    const { name, value } = e.target;
    const newFilters = [...(formData.filters || [])];
    if (name === 'key') {
      newFilters[index] = { ...newFilters[index], key: value };
    } else if (name === 'values') {
      // Store as string during editing to allow natural comma typing
      newFilters[index] = { 
        ...newFilters[index], 
        values: value // Store raw string temporarily
      };
    }
    setFormData({ ...formData, filters: newFilters });
  };

  // Convert string values to array when user leaves the field
  const handleFilterBlur = (index) => {
    const newFilters = [...(formData.filters || [])];
    const filter = newFilters[index];
    
    if (typeof filter.values === 'string') {
      const valuesArray = filter.values.split(',').map(v => v.trim()).filter(Boolean);
      newFilters[index] = { 
        ...newFilters[index], 
        values: valuesArray // Convert to array (same format as before)
      };
      setFormData({ ...formData, filters: newFilters });
    }
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

  // FAQs helpers
  const addFaq = () => {
    const next = [...(formData.faqs || []), { question: '', answer: '' }];
    setFormData({ ...formData, faqs: next });
  };

  const removeFaq = (index) => {
    const next = (formData.faqs || []).filter((_, i) => i !== index);
    setFormData({ ...formData, faqs: next });
  };

  const handleFaqChange = (index, field, value) => {
    const next = (formData.faqs || []).map((f, i) => (i === index ? { ...f, [field]: value } : f));
    setFormData({ ...formData, faqs: next });
  };

  const handleSubmit = (e) => {
    const colorImagesByName = new Map(
      (formData.colorVariants || []).map((variant) => [
        String(variant?.colorName || '').trim().toLowerCase(),
        Array.isArray(variant?.images) ? variant.images.filter(Boolean) : [],
      ])
    );

    const normalizedVariants = (variantRows || [])
      .filter((row) => row && typeof row === 'object')
      .map((row) => ({
        variantId: String(row.variantId || '').trim() || generatePersistedVariantId(),
        images: (() => {
          const explicitImages = Array.isArray(row.images) ? row.images.filter(Boolean) : [];
          if (explicitImages.length > 0) return explicitImages;
          const colorKey = String(row.color || '').trim().toLowerCase();
          const matchedColorImages = colorKey ? (colorImagesByName.get(colorKey) || []) : [];
          if (matchedColorImages.length > 0) return matchedColorImages;
          return formData.heroImage ? [formData.heroImage] : [];
        })(),
        name: String(row.name || formData.title || '').trim(),
        size: String(row.size || '').trim(),
        color: String(row.color || '').trim(),
        unitCount: String(row.unitCount || '').trim(),
        weight: String(row.weight || '').trim(),
        isDefault: Boolean(row.isDefault),
        sku: String(row.sku || '').trim(),
        barcode: String(row.barcode || '').trim(),
        hsnCode: String(row.hsnCode || '').trim(),
        gstPercent: Number(row.gstPercent || 0),
        mrp: Number(row.mrp || 0),
        sellingPrice: Number(row.sellingPrice || 0),
        discountPercent: Number(row.discountPercent || 0),
        marginPrice: Number(row.marginPrice || 0),
        price: Number(row.sellingPrice || row.price || 0),
      }))
      .filter((row) => row.name || row.sku || row.color || row.size || row.weight || row.unitCount);

    if (normalizedVariants.length > 0) {
      const explicitDefaultIndex = normalizedVariants.findIndex((row) => row.isDefault);
      const resolvedDefaultIndex = explicitDefaultIndex >= 0 ? explicitDefaultIndex : 0;
      const variantsWithSingleDefault = normalizedVariants.map((row, idx) => ({
        ...row,
        isDefault: idx === resolvedDefaultIndex,
      }));
      const defaultRow = variantsWithSingleDefault[resolvedDefaultIndex];
      const nonDefaultRows = variantsWithSingleDefault.filter((_, idx) => idx !== resolvedDefaultIndex);
      normalizedVariants.length = 0;
      normalizedVariants.push(defaultRow, ...nonDefaultRows);
    }

    e.preventDefault();
    setError('');

    // Only title and hero image are required - everything else can be added later
    if (!formData.title || !formData.heroImage) {
      setError("Please provide a Title and a Hero Image.");
      return;
    }

    // Detail photos are optional:
    // - allow 0 photos
    // - allow exactly 3 photos
    // - disallow 1–2 photos (incomplete set for the UI)
    const detailPhotosCount = (formData.detailPhotos || []).filter(Boolean).length;
    if (detailPhotosCount !== 0 && detailPhotosCount !== 3) {
      setError("Detail Page Photos must be either 0 or exactly 3 images.");
      return;
    }

    if (normalizedVariants.length > 0) {
      const firstInvalidIndex = normalizedVariants.findIndex((row) => {
        const rowErrors = getVariantPricingErrors(row);
        return rowErrors.sellingPrice || rowErrors.marginPrice || rowErrors.discountPercent;
      });

      if (firstInvalidIndex >= 0) {
        const invalidRow = normalizedVariants[firstInvalidIndex];
        const rowErrors = getVariantPricingErrors(invalidRow);
        let message = `Variant #${firstInvalidIndex + 1} has invalid pricing.`;
        if (rowErrors.sellingPrice) {
          message = `Variant #${firstInvalidIndex + 1}: Selling Price cannot exceed MRP.`;
        } else if (rowErrors.marginPrice) {
          message = `Variant #${firstInvalidIndex + 1}: Margin Price cannot exceed Selling Price.`;
        } else if (rowErrors.discountPercent) {
          message = `Variant #${firstInvalidIndex + 1}: Discount must be less than 100%.`;
        }
        setError(message);
        toast.error(message);
        return;
      }
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
      .map(f => {
        // Convert string to array if needed (in case blur didn't fire)
        let values = f.values;
        if (typeof values === 'string') {
          values = values.split(',').map(v => v.trim()).filter(Boolean);
        }
        return {
          key: f.key?.trim(),
          values: Array.isArray(values) ? values.filter(v => v && v.trim()) : []
        };
      })
      .filter(f => f.key && f.key.trim() && f.values.length > 0);

    const normalizedPriceBySize = (formData.priceBySize || [])
      .filter(row => row && typeof row === 'object')
      .map(row => ({
        price: Number(row.price || 0),
        size: String(row.size || '').trim(),
        unit: String(row.unit || '').trim(),
      }))
      .filter(row => Number.isFinite(row.price) && row.price > 0);

    // Keep sidebar/catalog Size filter aligned with Price by Size rows.
    const sizeValuesFromPriceBySize = Array.from(
      new Set(
        normalizedPriceBySize
          .map(row => row.size)
          .filter(Boolean)
      )
    );

    const filtersWithSizeFromPricing = (() => {
      const nextFilters = [...filters];
      const sizeFilterIndex = nextFilters.findIndex(
        f => String(f.key || '').toLowerCase() === 'size'
      );

      if (sizeValuesFromPriceBySize.length === 0) return nextFilters;

      if (sizeFilterIndex >= 0) {
        const existing = Array.isArray(nextFilters[sizeFilterIndex].values)
          ? nextFilters[sizeFilterIndex].values
          : [];
        const mergedValues = Array.from(new Set([...existing, ...sizeValuesFromPriceBySize]));
        nextFilters[sizeFilterIndex] = {
          ...nextFilters[sizeFilterIndex],
          values: mergedValues,
        };
        return nextFilters;
      }

      nextFilters.push({ key: 'Size', values: sizeValuesFromPriceBySize });
      return nextFilters;
    })();

    const derivedBasePrice =
      normalizedVariants.length > 0
        ? Math.min(...normalizedVariants.map((row) => Number(row.price || 0)))
        : normalizedPriceBySize.length > 0
          ? Math.min(...normalizedPriceBySize.map(r => r.price))
          : Number(formData.price || 0);

    const finalProduct = {
      ...formData,
      variants: normalizedVariants,
      brandCategoryId: updatedBrandCategoryId || formData.brandCategoryId,
      priceBySize: normalizedPriceBySize,
      price: Number.isFinite(derivedBasePrice) ? derivedBasePrice : 0,
      originalPrice: formData.originalPrice && Number(formData.originalPrice) > 0 ? Number(formData.originalPrice) : null,
      tags,
      categoryIds,
      brandCategoryIds,
      filters: filtersWithSizeFromPricing
    };

    if (normalizedVariants.length > 0) {
      finalProduct.sku = '';
      finalProduct.barcode = '';
    }
    
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
    <div className={`bg-white rounded-lg shadow-sm flex flex-col h-full ${showVariantsOnly ? 'w-full' : ''}`}>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}
      <form id="product-form" onSubmit={handleSubmit} className={`flex-grow ${showVariantsOnly ? 'w-full' : ''}`}>
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowVariantsOnly(false)}
            className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
              !showVariantsOnly ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Full Product Form
          </button>
          <button
            type="button"
            onClick={() => setShowVariantsOnly(true)}
            className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
              showVariantsOnly ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Variants Section
          </button>
        </div>

        {showVariantsOnly && (
        <div className="w-full min-h-screen">
        <FormSection title="Variants">
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setShowAddVariantsPanel((prev) => !prev)}
              className="px-4 py-2 text-sm font-semibold bg-primary text-white rounded-md hover:bg-primary-700 transition-colors"
            >
              {showAddVariantsPanel ? 'Close Variants Builder' : 'Add Variants'}
            </button>
          </div>

          {showAddVariantsPanel && (
            <div className="mb-4 p-4 border border-gray-200 rounded-md bg-gray-50">
              <p className="text-sm font-semibold text-gray-800 mb-3">Choose variant fields</p>
              <p className="text-xs text-gray-500 mb-3">Select any 2 fields only.</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={variantFieldSelection.size} disabled={!variantFieldSelection.size && selectedVariantFieldCount >= 2} onChange={() => handleVariantFieldToggle('size')} className="h-4 w-4 rounded text-primary focus:ring-primary disabled:cursor-not-allowed" />Size</label>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={variantFieldSelection.color} disabled={!variantFieldSelection.color && selectedVariantFieldCount >= 2} onChange={() => handleVariantFieldToggle('color')} className="h-4 w-4 rounded text-primary focus:ring-primary disabled:cursor-not-allowed" />Color</label>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={variantFieldSelection.weight} disabled={!variantFieldSelection.weight && selectedVariantFieldCount >= 2} onChange={() => handleVariantFieldToggle('weight')} className="h-4 w-4 rounded text-primary focus:ring-primary disabled:cursor-not-allowed" />Weight</label>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={variantFieldSelection.unitCount} disabled={!variantFieldSelection.unitCount && selectedVariantFieldCount >= 2} onChange={() => handleVariantFieldToggle('unitCount')} className="h-4 w-4 rounded text-primary focus:ring-primary disabled:cursor-not-allowed" />Unit Count</label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {variantFieldSelection.size && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Size values</label>
                    <div className="flex items-center gap-2">
                      <input type="text" placeholder="Type one size and click ✓ Add" value={variantDraftValue.size} onChange={(e) => setVariantDraftValue((prev) => ({ ...prev, size: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addVariantOptionValue('size'); } }} className="w-full p-2 border border-gray-300 rounded-md" />
                      <button type="button" onClick={() => addVariantOptionValue('size')} className="px-2 py-1.5 text-xs font-semibold bg-green-600 text-white rounded-md hover:bg-green-700">✓ Add</button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Selected: {variantBuilderInputs.size || '—'}</p>
                  </div>
                )}
                {variantFieldSelection.color && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Color values</label>
                    {selectedColorNames.length > 0 ? (
                      <div className="p-2 border border-blue-200 rounded-md bg-blue-50 text-sm text-blue-700">Colors: {selectedColorNames.join(', ')}</div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <input type="text" placeholder="Type one color and click ✓ Add" value={variantDraftValue.color} onChange={(e) => setVariantDraftValue((prev) => ({ ...prev, color: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addVariantOptionValue('color'); } }} className="w-full p-2 border border-gray-300 rounded-md" />
                          <button type="button" onClick={() => addVariantOptionValue('color')} className="px-2 py-1.5 text-xs font-semibold bg-green-600 text-white rounded-md hover:bg-green-700">✓ Add</button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Selected: {variantBuilderInputs.color || '—'}</p>
                      </>
                    )}
                  </div>
                )}
                {variantFieldSelection.weight && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Weight values</label>
                    <div className="flex items-center gap-2">
                      <input type="text" placeholder="Type one weight and click ✓ Add" value={variantDraftValue.weight} onChange={(e) => setVariantDraftValue((prev) => ({ ...prev, weight: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addVariantOptionValue('weight'); } }} className="w-full p-2 border border-gray-300 rounded-md" />
                      <button type="button" onClick={() => addVariantOptionValue('weight')} className="px-2 py-1.5 text-xs font-semibold bg-green-600 text-white rounded-md hover:bg-green-700">✓ Add</button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Selected: {variantBuilderInputs.weight || '—'}</p>
                  </div>
                )}
                {variantFieldSelection.unitCount && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Unit Count values</label>
                    <div className="flex items-center gap-2">
                      <input type="text" placeholder="Type one unit count and click ✓ Add" value={variantDraftValue.unitCount} onChange={(e) => setVariantDraftValue((prev) => ({ ...prev, unitCount: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addVariantOptionValue('unitCount'); } }} className="w-full p-2 border border-gray-300 rounded-md" />
                      <button type="button" onClick={() => addVariantOptionValue('unitCount')} className="px-2 py-1.5 text-xs font-semibold bg-green-600 text-white rounded-md hover:bg-green-700">✓ Add</button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Selected: {variantBuilderInputs.unitCount || '—'}</p>
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button type="button" onClick={handleGenerateVariantRows} className="px-4 py-2 text-sm font-semibold bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors">Generate Variants</button>
                <button type="button" onClick={handleAddSingleVariantRow} className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">Add Single Row</button>
                {variantRows.length > 0 && <span className="text-sm text-gray-600">Total variants: <span className="font-semibold">{variantRows.length}</span></span>}
              </div>
            </div>
          )}

          {recentlyDeletedVariantRow && (
            <div className="mb-3 p-3 border border-amber-200 bg-amber-50 rounded-md flex items-center justify-between gap-3">
              <span className="text-sm text-amber-800">Variant row deleted.</span>
              <button
                type="button"
                onClick={handleUndoDeleteVariantRow}
                className="px-3 py-1.5 text-xs font-semibold text-amber-900 border border-amber-300 rounded hover:bg-amber-100"
              >
                Undo
              </button>
            </div>
          )}

          <div className="w-full max-w-full overflow-x-auto border border-gray-200 rounded-md">
            <table className="w-full min-w-[1700px] table-auto text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="w-14 px-2 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">S.NO</th>
                  <th className="w-12 px-0.5 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">Default</th>
                  <th className="w-[320px] min-w-[320px] px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Name</th>
                  {variantFieldSelection.size && <th className="w-[120px] min-w-[120px] px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Size</th>}
                  {variantFieldSelection.color && <th className="w-[160px] min-w-[160px] px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Color</th>}
                  {variantFieldSelection.unitCount && <th className="w-[130px] min-w-[130px] px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Unit Count</th>}
                  {variantFieldSelection.weight && <th className="w-[130px] min-w-[130px] px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Weight</th>}
                  <th className="w-[160px] min-w-[160px] px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Images</th>
                  <th className="w-[150px] min-w-[150px] px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">SKU</th>
                  <th className="w-[150px] min-w-[150px] px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">BARCODE</th>
                  <th className="w-[140px] min-w-[140px] px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">HSN CODE</th>
                  <th className="w-[120px] min-w-[120px] px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">GST%</th>
                  <th className="w-[130px] min-w-[130px] px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">MRP</th>
                  <th className="w-[170px] min-w-[170px] px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">SELLING PRICE</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 break-words"> MAX DISCOUNT %</th>
                  <th className="w-[170px] min-w-[170px] px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">MARGIN PRICE</th>
                  <th className="w-20 px-2 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">Action</th>
                </tr>
                <tr>
                  <th className="px-2 py-2 text-center text-[11px] text-gray-500">All</th>
                  <th className="px-2 py-2 text-center text-[11px] text-gray-400">—</th>
                  <th className="w-[320px] min-w-[320px] px-2 py-2">
                    <input type="text" value={bulkVariantInputs.name} onChange={(e) => handleBulkVariantInputChange('name', e.target.value)} placeholder="Apply Name" className="w-full p-1.5 border border-gray-300 rounded text-xs" />
                  </th>
                  {variantFieldSelection.size && <th className="px-2 py-2 text-center text-[11px] text-gray-400">—</th>}
                  {variantFieldSelection.color && <th className="px-2 py-2 text-center text-[11px] text-gray-400">—</th>}
                  {variantFieldSelection.unitCount && <th className="px-2 py-2 text-center text-[11px] text-gray-400">—</th>}
                  {variantFieldSelection.weight && <th className="px-2 py-2 text-center text-[11px] text-gray-400">—</th>}
                  <th className="w-[160px] min-w-[160px] px-2 py-2 text-center text-[11px] text-gray-400">—</th>
                  <th className="w-[150px] min-w-[150px] px-3 py-2">
                    <input type="text" value={bulkVariantInputs.sku} onChange={(e) => handleBulkVariantInputChange('sku', e.target.value)} placeholder="Apply SKU" className="w-full p-1.5 border border-gray-300 rounded text-xs" />
                  </th>
                  <th className="w-[150px] min-w-[150px] px-3 py-2">
                    <input type="text" value={bulkVariantInputs.barcode} onChange={(e) => handleBulkVariantInputChange('barcode', e.target.value)} placeholder="Apply Barcode" className="w-full p-1.5 border border-gray-300 rounded text-xs" />
                  </th>
                  <th className="w-[140px] min-w-[140px] px-3 py-2">
                    <input type="text" value={bulkVariantInputs.hsnCode} onChange={(e) => handleBulkVariantInputChange('hsnCode', e.target.value)} placeholder="Apply HSN" className="w-full p-1.5 border border-gray-300 rounded text-xs" />
                  </th>
                  <th className="w-[120px] min-w-[120px] px-3 py-2">
                    <input type="number" value={bulkVariantInputs.gstPercent} onChange={(e) => handleBulkVariantInputChange('gstPercent', e.target.value)} placeholder="Apply GST%" className="w-full p-1.5 border border-gray-300 rounded text-xs" />
                  </th>
                  <th className="w-[130px] min-w-[130px] px-3 py-2">
                    <input type="text" value={formatIndianNumberInput(bulkVariantInputs.mrp)} onChange={(e) => handleBulkVariantInputChange('mrp', e.target.value)} placeholder="Apply MRP" className="w-full p-1.5 border border-gray-300 rounded text-xs" />
                  </th>
                  <th className="w-[170px] min-w-[170px] px-3 py-2">
                    <input type="text" value={formatIndianNumberInput(bulkVariantInputs.sellingPrice)} onChange={(e) => handleBulkVariantInputChange('sellingPrice', e.target.value)} placeholder="Apply Selling" className="w-full p-1.5 border border-gray-300 rounded text-xs" />
                  </th>
                  <th className="px-3 py-2">
                    <input type="number" value={bulkVariantInputs.discountPercent} onChange={(e) => handleBulkVariantInputChange('discountPercent', e.target.value)} placeholder="Apply Discount%" className="w-full p-1.5 border border-gray-300 rounded text-xs" />
                  </th>
                  <th className="w-[170px] min-w-[170px] px-3 py-2">
                    <input type="text" value={formatIndianNumberInput(bulkVariantInputs.marginPrice)} onChange={(e) => handleBulkVariantInputChange('marginPrice', e.target.value)} placeholder="Apply Margin" className="w-full p-1.5 border border-gray-300 rounded text-xs" />
                  </th>
                  <th className="w-20 px-2 py-2 text-center">
                    <button
                      type="button"
                      onClick={handleApplyBulkInputs}
                      className="px-2 py-1 text-[11px] font-semibold text-primary border border-primary/30 rounded hover:bg-primary/10"
                    >
                      Apply
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {variantRows.length > 0 ? variantRows.map((row, index) => (
                  <tr
                    key={row._rowId || index}
                    onClick={() => setSelectedVariantRowIndex(index)}
                    className={`border-b border-gray-100 cursor-pointer transition-colors ${
                      selectedVariantRowIndex === index ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="w-14 px-2 py-2 text-gray-700 font-medium text-center">{index + 1}</td>
                    <td className="w-12 px-0.5 py-2 text-center">
                      <input
                        type="radio"
                        name="default-variant-row"
                        checked={Boolean(row.isDefault)}
                        onChange={() => handleSetDefaultVariantRow(index)}
                        onClick={(e) => e.stopPropagation()}
                        title="Set as default variant"
                        className="h-4 w-4 text-primary focus:ring-primary"
                      />
                    </td>
                    <td className="w-[320px] min-w-[320px] px-2 py-2"><input type="text" value={row.name || ''} onChange={(e) => handleVariantRowChange(index, 'name', e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md" /></td>
                    {variantFieldSelection.size && <td className="w-[120px] min-w-[120px] px-3 py-2"><input type="text" value={row.size || ''} onChange={(e) => handleVariantRowChange(index, 'size', e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md" /></td>}
                    {variantFieldSelection.color && (
                      <td className="w-[160px] min-w-[160px] px-3 py-7 align-top">
                        {selectedColorNames.length > 0 ? (
                          <div className="space-y-1.5">
                            <select
                              value={(() => {
                                const raw = String(row.color || '').trim();
                                if (!raw) return '';
                                const match = selectedColorNames.find(
                                  (n) => n.toLowerCase() === raw.toLowerCase()
                                );
                                return match || '__other__';
                              })()}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === '') handleVariantRowChange(index, 'color', '');
                                else if (v === '__other__') handleVariantRowChange(index, 'color', row.color || '');
                                else handleVariantRowChange(index, 'color', v);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full p-2 border border-gray-300 rounded-md text-sm"
                            >
                              <option value="">— Match Color Variant</option>
                              {selectedColorNames.map((name) => (
                                <option key={name} value={name}>
                                  {name}
                                </option>
                              ))}
                              <option value="__other__">Other (custom)…</option>
                            </select>
                            {(() => {
                              const raw = String(row.color || '').trim();
                              const inList = selectedColorNames.some((n) => n.toLowerCase() === raw.toLowerCase());
                              return !inList;
                            })() && (
                              <input
                                type="text"
                                value={row.color || ''}
                                onChange={(e) => handleVariantRowChange(index, 'color', e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="Custom color name"
                                className="w-full p-2 border border-gray-300 rounded-md text-xs"
                              />
                            )}
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={row.color || ''}
                            onChange={(e) => handleVariantRowChange(index, 'color', e.target.value)}
                            className="w-full p-2.5 border border-gray-300 rounded-md"
                          />
                        )}
                      </td>
                    )}
                    {variantFieldSelection.unitCount && <td className="w-[130px] min-w-[130px] px-3 py-2"><input type="text" value={row.unitCount || ''} onChange={(e) => handleVariantRowChange(index, 'unitCount', e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md" /></td>}
                    {variantFieldSelection.weight && <td className="w-[130px] min-w-[130px] px-3 py-2"><input type="text" value={row.weight || ''} onChange={(e) => handleVariantRowChange(index, 'weight', e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md" /></td>}
                    <td className="w-[160px] min-w-[160px] px-2 py-2">
                      <div className="space-y-2">
                        <input
                          id={`variant-row-images-${row._rowId || index}`}
                          type="file"
                          multiple
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleVariantRowImageUpload(e, index)}
                        />
                        <label
                          htmlFor={`variant-row-images-${row._rowId || index}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold border border-gray-300 rounded-md bg-white hover:bg-gray-50 cursor-pointer"
                        >
                          {isUploading ? 'Uploading...' : 'Upload'}
                        </label>
                        {(row.images || []).length > 0 ? (
                          <div className="flex flex-wrap items-start gap-1.5">
                            {(row.images || []).slice(0, 4).map((url, imageIndex) => (
                              <div key={`${url}-${imageIndex}`} className="relative h-8 w-8">
                                <img
                                  src={url}
                                  alt=""
                                  className="block h-8 w-8 rounded border border-gray-200 object-cover bg-gray-100"
                                  onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src = '/placeholder-product.jpg';
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveVariantRowImage(index, imageIndex);
                                  }}
                                  className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-600 text-white text-[10px] leading-4"
                                  title="Remove image"
                                  aria-label="Remove image"
                                >
                                  x
                                </button>
                              </div>
                            ))}
                            {(row.images || []).length > 4 && (
                              <span className="text-[11px] text-gray-500 self-center">+{(row.images || []).length - 4}</span>
                            )}
                          </div>
                        ) : (
                          <p className="text-[11px] text-gray-500">Will use color images or hero image fallback.</p>
                        )}
                      </div>
                    </td>
                    <td className="w-[150px] min-w-[150px] px-3 py-2"><input type="text" value={row.sku || ''} onChange={(e) => handleVariantRowChange(index, 'sku', e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md" /></td>
                    <td className="w-[150px] min-w-[150px] px-3 py-2"><input type="text" value={row.barcode || ''} onChange={(e) => handleVariantRowChange(index, 'barcode', e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md" /></td>
                    <td className="w-[140px] min-w-[140px] px-3 py-2"><input type="text" value={row.hsnCode || ''} onChange={(e) => handleVariantRowChange(index, 'hsnCode', e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md" /></td>
                    <td className="w-[120px] min-w-[120px] px-3 py-2"><input type="number" value={row.gstPercent ?? ''} onChange={(e) => handleVariantRowChange(index, 'gstPercent', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md" /></td>
                    <td className="w-[130px] min-w-[130px] px-3 py-2"><input type="text" value={formatIndianNumberInput(row.mrp ?? '')} onChange={(e) => handleVariantRowChange(index, 'mrp', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md" /></td>
                    <td className="w-[170px] min-w-[170px] px-3 py-2"><input type="text" value={formatIndianNumberInput(row.sellingPrice ?? '')} onChange={(e) => handleVariantRowChange(index, 'sellingPrice', e.target.value)} className={`w-full p-2 border rounded-md ${getVariantPricingErrors(row).sellingPrice ? 'border-red-500 bg-red-50' : 'border-gray-300'}`} /></td>
                    <td className="px-3 py-2"><input type="number" value={row.discountPercent ?? ''} onChange={(e) => handleVariantRowChange(index, 'discountPercent', e.target.value)} className={`w-full p-2 border rounded-md ${getVariantPricingErrors(row).discountPercent ? 'border-red-500 bg-red-50' : 'border-gray-300'}`} /></td>
                    <td className="w-[170px] min-w-[170px] px-3 py-2"><input type="text" value={formatIndianNumberInput(row.marginPrice ?? '')} onChange={(e) => handleVariantRowChange(index, 'marginPrice', e.target.value)} className={`w-full p-2 border rounded-md ${getVariantPricingErrors(row).marginPrice ? 'border-red-500 bg-red-50' : 'border-gray-300'}`} /></td>
                    <td className="w-20 px-2 py-2 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteVariantRow(index);
                        }}
                        className="inline-flex items-center justify-center p-2 text-red-600 border border-red-300 rounded hover:bg-red-50"
                        title="Remove row"
                        aria-label="Remove row"
                      >
                        <TrashIcon />
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={13 + (variantFieldSelection.size ? 1 : 0) + (variantFieldSelection.color ? 1 : 0) + (variantFieldSelection.unitCount ? 1 : 0) + (variantFieldSelection.weight ? 1 : 0)} className="px-3 py-4 text-center text-sm text-gray-500">No variants generated yet. Select fields and click <span className="font-semibold">Generate Variants</span>.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </FormSection>
        </div>
        )}

        {/* Desktop: Two-column layout, Mobile: Single column */}
        {!showVariantsOnly && (
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
                          : getTextLength(formData.summary) > 20
                          ? 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                          : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                      }`}
                      title={!formData.title || formData.title.trim().length < 3 ? 'Enter product title first' : getTextLength(formData.summary) > 20 ? 'Improve existing description' : 'Generate new description'}
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
                          <span>{getTextLength(formData.summary) > 20 ? 'Improve' : 'Generate'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <RichTextEditor
                  value={formData.summary}
                  onChange={(html) =>
                    setFormData((prev) => ({
                      ...prev,
                      summary: html,
                    }))
                  }
                  placeholder="Enter short description"
                  minHeight="120px"
                />
              </div>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">SKU *</label>
                  <input 
                    name="sku" 
                    value={formData.sku || ''} 
                    onChange={handleChange} 
                    disabled={isCreatingMultipleVariants}
                    className="w-full mt-1 p-3 border border-gray-300 rounded-lg shadow-sm text-base focus:ring-2 focus:ring-primary focus:border-primary transition-colors disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed" 
                    placeholder={isCreatingMultipleVariants ? 'SKU is managed per variant row' : 'Enter SKU'}
                  />
                </div>
                {!isCreatingMultipleVariants && (
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">Barcode</label>
                    <input
                      name="barcode"
                      value={formData.barcode || ''}
                      onChange={handleChange}
                      className="w-full mt-1 p-3 border border-gray-300 rounded-lg shadow-sm text-base focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                      placeholder="Enter Barcode"
                    />
                  </div>
                )}
              </div>
              {!isCreatingMultipleVariants && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">HSN Code</label>
                    <input
                      name="hsnCode"
                      value={formData.hsnCode || ''}
                      onChange={handleChange}
                      className="w-full mt-1 p-3 border border-gray-300 rounded-lg shadow-sm text-base focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                      placeholder="Enter HSN Code"
                    />
                  </div>
                </div>
              )}
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
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Price by Size</label>
                  <button
                    type="button"
                    onClick={addPriceBySizeRow}
                    disabled={isCreatingMultipleVariants}
                    className="text-xs font-semibold text-primary hover:underline disabled:text-gray-400 disabled:no-underline disabled:cursor-not-allowed"
                  >
                    + Add row
                  </button>
                </div>
                {isCreatingMultipleVariants && (
                  <p className="mb-2 text-xs text-amber-700">
                    Price by Size is locked because variants are enabled. Existing values are preserved.
                  </p>
                )}

                <div className="space-y-2">
                  {(formData.priceBySize || []).length === 0 ? (
                    <div className="p-3 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg">
                      No size pricing added yet. Add rows like: price + size + unit (example: 1200, 5, kg).
                    </div>
                  ) : (
                    (formData.priceBySize || []).map((row, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center p-3 rounded-lg border border-gray-200 bg-white"
                      >
                        <input
                          type="number"
                          min="0"
                          placeholder="Price (₹)"
                          value={row.price ?? ''}
                          onChange={(e) => handlePriceBySizeChange(index, 'price', e.target.value)}
                          disabled={isCreatingMultipleVariants}
                          className="md:col-span-4 p-2 border rounded-md focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                        />
                        <input
                          placeholder="Size (e.g., 5)"
                          value={row.size ?? ''}
                          onChange={(e) => handlePriceBySizeChange(index, 'size', e.target.value)}
                          disabled={isCreatingMultipleVariants}
                          className="md:col-span-4 p-2 border rounded-md focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                        />
                        <input
                          placeholder="Unit (e.g., kg / pcs)"
                          value={row.unit ?? ''}
                          onChange={(e) => handlePriceBySizeChange(index, 'unit', e.target.value)}
                          list="priceBySizeUnitOptions"
                          disabled={isCreatingMultipleVariants}
                          className="md:col-span-3 p-2 border rounded-md focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                        />
                        <button
                          type="button"
                          onClick={() => removePriceBySizeRow(index)}
                          disabled={isCreatingMultipleVariants}
                          className="md:col-span-1 text-red-500 hover:text-red-700 justify-self-center disabled:text-gray-400 disabled:cursor-not-allowed"
                          title="Remove row"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <datalist id="priceBySizeUnitOptions">
                  <option value="kg" />
                  <option value="g" />
                  <option value="pcs" />
                  <option value="pc" />
                  <option value="set" />
                  <option value="pack" />
                  <option value="box" />
                  <option value="pair" />
                </datalist>
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
                          : getTextLength(formData.description) > 20
                          ? 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                          : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                      }`}
                      title={!formData.title || formData.title.trim().length < 3 ? 'Enter product title first' : getTextLength(formData.description) > 20 ? 'Improve existing description' : 'Generate new description'}
                    >
                      {aiLoading.description ? (
                        <>
                          <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a 8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                          </svg>
                          <span>{getTextLength(formData.description) > 20 ? 'Improve' : 'Generate'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <RichTextEditor
                  value={formData.description}
                  onChange={(html) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: html,
                    }))
                  }
                  placeholder="Enter long description"
                  minHeight="200px"
                />
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Usage &amp; Care</label>
                <RichTextEditor
                  value={formData.usageAndCare}
                  onChange={(html) =>
                    setFormData((prev) => ({
                      ...prev,
                      usageAndCare: html,
                    }))
                  }
                  placeholder="Enter usage and care instructions"
                  minHeight="160px"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Why Buy From</label>
                <RichTextEditor
                  value={formData.whyBuyFrom}
                  onChange={(html) =>
                    setFormData((prev) => ({
                      ...prev,
                      whyBuyFrom: html,
                    }))
                  }
                  placeholder="Enter why buy from content"
                  minHeight="160px"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Manufacturer</label>
                <RichTextEditor
                  value={formData.manufacturer || ''}
                  onChange={(html) =>
                    setFormData((prev) => ({
                      ...prev,
                      manufacturer: html,
                    }))
                  }
                  placeholder="Enter manufacturer details"
                  minHeight="120px"
                />
              </div>
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
                          unoptimized
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
                            unoptimized
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

                <div>
                  <div className="flex items-center justify-between gap-3">
                    <label className="block text-sm font-medium mb-2 text-gray-700">
                      Detail Page Photos (3) *
                    </label>
                    <span className="text-xs text-gray-500">
                      {((formData.detailPhotos || []).length)}/3
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    These appear below FAQs on the product detail page (mobile phone ratio).
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={e => handleImageUpload(e, 'detailPhotos')}
                    className="w-full mt-1 text-sm file:mr-4 file:py-2.5 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-700 transition-colors"
                    disabled={isUploading || (formData.detailPhotos || []).length >= 3}
                  />
                  {formData.detailPhotos && formData.detailPhotos.length > 0 && (
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      {formData.detailPhotos.map((url, index) => (
                        <div key={index} className="relative">
                          <div className="relative w-full aspect-[9/16] rounded-lg overflow-hidden border-2 border-gray-200 shadow-sm bg-white">
                            <Image
                              src={url}
                              alt="Detail photo preview"
                              fill
                              unoptimized
                              className="object-cover"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveDetailPhoto(index)}
                            className="absolute -top-2 -right-2 z-10 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-md hover:bg-red-600 transition-colors"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 border border-gray-200 rounded-lg bg-gray-50">
                    <label className="block text-sm font-medium mb-2 text-gray-700">Size Chart (PDF)</label>
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={(e) => handleAttachmentUpload('sizeChartUrl', e.target.files?.[0])}
                      className="w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-700 transition-colors"
                      disabled={isUploading}
                    />
                    {formData.sizeChartUrl ? (
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <a
                          href={formData.sizeChartUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-600 hover:underline truncate"
                        >
                          View uploaded size chart
                        </a>
                        <button
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, sizeChartUrl: '' }))}
                          className="text-xs text-red-600 hover:text-red-700 font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="p-3 border border-gray-200 rounded-lg bg-gray-50">
                    <label className="block text-sm font-medium mb-2 text-gray-700">Brochure (PDF)</label>
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={(e) => handleAttachmentUpload('brochureUrl', e.target.files?.[0])}
                      className="w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-700 transition-colors"
                      disabled={isUploading}
                    />
                    {formData.brochureUrl ? (
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <a
                          href={formData.brochureUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-600 hover:underline truncate"
                        >
                          View uploaded brochure
                        </a>
                        <button
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, brochureUrl: '' }))}
                          className="text-xs text-red-600 hover:text-red-700 font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="p-3 border border-gray-200 rounded-lg bg-gray-50">
                  <label className="block text-sm font-medium mb-2 text-gray-700">Blog URL (optional)</label>
                  <input
                    name="blogUrl"
                    value={formData.blogUrl || ''}
                    onChange={handleChange}
                    className="w-full p-3 border border-gray-300 rounded-lg shadow-sm text-base focus:ring-2 focus:ring-primary focus:border-primary transition-colors bg-white"
                    placeholder="https://…"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    If provided, a “Blog” link will appear on the product detail page.
                  </p>
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
                      value={typeof filter.values === 'string' 
                        ? filter.values 
                        : Array.isArray(filter.values) 
                          ? filter.values.join(', ') 
                          : ''} 
                      onChange={e => handleFilterChange(index, e)}
                      onBlur={() => handleFilterBlur(index)}
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
          <p className="text-xs text-gray-600 mb-4">
            Add product specifications (these appear on the product detail page).{" "}
            <strong className="text-gray-700">Available sizes</strong> was removed — sizes are now controlled via{" "}
            <strong className="text-gray-700">Price by Size</strong>.
          </p>
          
          {/* Mode Toggle */}
          <div className="mb-4 flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div>
              <label className="text-sm font-medium text-gray-700">Input Mode</label>
              <p className="text-xs text-gray-500 mt-1">Switch between form and JSON input</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (specJsonMode) {
                    handleSwitchToFormMode();
                  }
                }}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  !specJsonMode
                    ? 'bg-primary text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                Form Mode
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!specJsonMode) {
                    handleSwitchToJsonMode();
                  }
                }}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  specJsonMode
                    ? 'bg-primary text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                JSON Mode
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {specJsonMode ? (
              /* JSON Mode */
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">
                    JSON Format Specifications
                  </label>
                  <button
                    type="button"
                    onClick={handleSwitchToFormMode}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    Apply JSON
                  </button>
                </div>
                <textarea
                  value={specJsonInput}
                  onChange={(e) => handleSpecJsonChange(e.target.value)}
                  placeholder={`{\n  \"specifications\": [\n    {\n      \"label\": \"Diameter\",\n      \"value\": \"24\",\n      \"unit\": \"cm\"\n    }\n  ]\n}`}
                  className={`w-full p-3 border rounded-md font-mono text-sm min-h-[220px] focus:ring-2 focus:ring-primary focus:border-primary ${
                    specJsonError ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                  spellCheck={false}
                />
                {specJsonError && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-xs text-red-700 font-medium">Error: {specJsonError}</p>
                  </div>
                )}
                {!specJsonError && specJsonInput.trim() && (
                  <div className="p-2 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-xs text-green-700 font-medium">✓ Valid JSON</p>
                  </div>
                )}
              </div>
            ) : (
              /* Form Mode - draggable specification tiles */
              <>
                {formData.specifications?.map((spec, index) => (
                  <div
                    key={index}
                    draggable
                    onDragStart={() => handleSpecDragStart(index)}
                    onDragOver={(e) => handleSpecDragOver(e, index)}
                    onDragLeave={handleSpecDragLeave}
                    onDrop={(e) => handleSpecDrop(e, index)}
                    onDragEnd={handleSpecDragEnd}
                    className={`grid grid-cols-1 md:grid-cols-12 gap-2 items-center p-3 rounded-lg border transition-all cursor-move ${
                      draggedIndex === index ? 'opacity-50 bg-gray-100' : 'bg-white hover:bg-gray-50'
                    } ${
                      dragOverIndex === index ? 'border-primary border-2 shadow-md' : 'border-gray-200'
                    }`}
                  >
                    <div className="md:col-span-1 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing">
                      <DragHandleIcon className="w-5 h-5" />
                    </div>
                    <input 
                      name="label" 
                      placeholder="Label (e.g., Diameter)" 
                      value={spec.label || ''} 
                      onChange={e => handleSpecChange(index, e)} 
                      className="md:col-span-3 p-2 border rounded-md focus:ring-2 focus:ring-primary focus:border-primary" 
                    />
                    <input 
                      name="value" 
                      placeholder="Value" 
                      value={spec.value || ''} 
                      onChange={e => handleSpecChange(index, e)} 
                      className="md:col-span-3 p-2 border rounded-md focus:ring-2 focus:ring-primary focus:border-primary" 
                    />
                    <input 
                      name="unit" 
                      placeholder="Unit (e.g., cm)" 
                      value={spec.unit || ''} 
                      onChange={e => handleSpecChange(index, e)} 
                      className="md:col-span-3 p-2 border rounded-md focus:ring-2 focus:ring-primary focus:border-primary" 
                    />
                    <button 
                      type="button" 
                      onClick={() => removeSpec(index)} 
                      className="md:col-span-2 text-red-500 hover:text-red-700 justify-self-center"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))}
                <button 
                  type="button" 
                  onClick={addSpec} 
                  className="mt-2 text-sm text-primary hover:underline font-semibold flex items-center gap-1"
                >
                  <PlusIcon className="w-4 h-4" /> Add Specification
                </button>
              </>
            )}
          </div>
        </FormSection>

            <FormSection title="FAQs">
          <p className="text-xs text-gray-600 mb-4">
            Add product-specific FAQs. These will appear on the product detail page.
          </p>

          <div className="space-y-3">
            {(formData.faqs || []).map((faq, index) => (
              <div key={index} className="p-3 border border-gray-200 rounded-lg bg-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
                      <input
                        value={faq.question || ''}
                        onChange={(e) => handleFaqChange(index, 'question', e.target.value)}
                        placeholder="Enter question"
                        className="w-full p-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Answer</label>
                      <textarea
                        value={faq.answer || ''}
                        onChange={(e) => handleFaqChange(index, 'answer', e.target.value)}
                        placeholder="Enter answer"
                        rows={3}
                        className="w-full p-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFaq(index)}
                    className="text-red-500 hover:text-red-700 mt-7"
                    title="Remove FAQ"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addFaq}
              className="mt-2 text-sm text-primary hover:underline font-semibold flex items-center gap-1"
            >
              <PlusIcon className="w-4 h-4" /> Add FAQ
            </button>
          </div>
        </FormSection>

        <FormSection title="Testimonials">
          <p className="text-xs text-gray-600 mb-4">
            Add product testimonials (quote, author info, and optional company logo). These can be reused per product.
          </p>

          <div className="space-y-3">
            {(formData.testimonials || []).map((t, index) => (
              <div key={index} className="p-3 border border-gray-200 rounded-lg bg-white">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                  <div className="md:col-span-10 space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Quote *</label>
                      <textarea
                        value={t.quote || ''}
                        onChange={(e) => handleTestimonialChange(index, 'quote', e.target.value)}
                        placeholder="Outstanding performance with ... growth in repeat business orders."
                        rows={3}
                        className="w-full p-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Author Name</label>
                        <input
                          value={t.authorName || ''}
                          onChange={(e) => handleTestimonialChange(index, 'authorName', e.target.value)}
                          placeholder="ITC Kohinoor"
                          className="w-full p-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Author Role</label>
                        <input
                          value={t.authorRole || ''}
                          onChange={(e) => handleTestimonialChange(index, 'authorRole', e.target.value)}
                          placeholder="Head Chef"
                          className="w-full p-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                        <input
                          value={t.companyName || ''}
                          onChange={(e) => handleTestimonialChange(index, 'companyName', e.target.value)}
                          placeholder="C Hotel"
                          className="w-full p-2.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Company Logo (optional)</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleTestimonialLogoUpload(index, e.target.files?.[0])}
                        className="w-full text-sm file:mr-4 file:py-2 file:px-3 file:rounded-md file:border-0 file:font-semibold file:bg-primary file:text-white"
                        disabled={isUploading}
                      />
                      {t.companyLogo ? (
                        <div className="mt-2 flex items-center gap-3">
                          <Image
                            src={t.companyLogo}
                            alt="Company logo"
                            width={56}
                            height={56}
                            unoptimized
                            className="w-14 h-14 rounded-full object-cover border border-gray-300 bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => handleTestimonialChange(index, 'companyLogo', '')}
                            className="text-xs text-red-600 hover:text-red-700 font-medium"
                          >
                            Remove Logo
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="md:col-span-2 flex md:justify-end">
                    <button
                      type="button"
                      onClick={() => removeTestimonial(index)}
                      className="text-red-500 hover:text-red-700 md:mt-7"
                      title="Remove testimonial"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addTestimonial}
              className="mt-2 text-sm text-primary hover:underline font-semibold flex items-center gap-1"
            >
              <PlusIcon className="w-4 h-4" /> Add Testimonial
            </button>
          </div>
        </FormSection>

            <FormSection title="Related Products">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-800 mb-2">Manual Override</label>
              <p className="text-xs text-gray-500 mb-3">Select related products manually. Top recommendations are sorted first.</p>
              
              {/* Search Input */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <SearchIcon className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={relatedProductsSearchQuery}
                  onChange={(e) => setRelatedProductsSearchQuery(e.target.value)}
                  placeholder="Search products by name, SKU, tags, or brand..."
                  className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                />
                {relatedProductsSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setRelatedProductsSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    title="Clear search"
                  >
                    <span className="text-lg leading-none">×</span>
                  </button>
                )}
              </div>
            </div>
            <button 
              type="button" 
              onClick={handleAutoSuggestRelated} 
              className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold py-1.5 px-3 rounded-md flex items-center gap-1 transition-colors whitespace-nowrap"
            >
              <MagicIcon className="w-4 h-4" /> Auto-Generate Suggestions
            </button>
          </div>
          
          <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-md space-y-0 divide-y divide-gray-100 bg-gray-50">
            {debouncedSearchQuery.trim() && relatedProductsSearchQuery !== debouncedSearchQuery && (
              <div className="p-4 text-center text-sm text-gray-500">
                <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                Searching products...
              </div>
            )}
            {filteredRelatedCandidates.length > 0 ? (
              filteredRelatedCandidates.map(otherProduct => {
              // High match = has shared tags (score >= 5) OR very high overall score
              // Only show for non-search results (when not searching)
              const isSearching = debouncedSearchQuery.trim().length > 0;
              const isHighMatch = !isSearching && otherProduct.relevanceScore >= 5;
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
                      {/* Only show relevance reasons when NOT searching */}
                      {!isSearching && otherProduct.relevanceReasons.length > 0 && (
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
              })
            ) : (
              <div className="p-4 text-center">
                {relatedProductsSearchQuery ? (
                  <p className="text-sm text-gray-500 italic">
                    No products found matching "{relatedProductsSearchQuery}". Try a different search term.
                  </p>
                ) : allProducts.length <= 1 ? (
                  <p className="text-sm text-gray-500 italic">No other products available to link.</p>
                ) : (
                  <p className="text-sm text-gray-500 italic">No products match the current filters.</p>
                )}
              </div>
            )}
            {filteredRelatedCandidates.length > 0 && debouncedSearchQuery.trim() && (
              <div className="px-4 py-2 bg-blue-50 border-t border-blue-200 text-xs text-blue-700">
                {searchedProducts.length > 0 ? (
                  <>Found {filteredRelatedCandidates.length} product{filteredRelatedCandidates.length !== 1 ? 's' : ''} matching "{debouncedSearchQuery}"</>
                ) : (
                  <>Showing {filteredRelatedCandidates.length} product{filteredRelatedCandidates.length !== 1 ? 's' : ''}</>
                )}
              </div>
            )}
          </div>
        </FormSection>

        <FormSection title="Frequently Ordered Together">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-800 mb-2">
                Select together products manually
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Uses the same product search list as “Related Products”.
              </p>
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-md space-y-0 divide-y divide-gray-100 bg-gray-50">
            {filteredRelatedCandidates.length > 0 ? (
              filteredRelatedCandidates.map(otherProduct => {
                const productId = otherProduct._id || otherProduct.id;
                const isSelected = formData.frequentlyOrderedTogetherProductIds?.some(
                  id => id?.toString() === productId?.toString()
                );

                return (
                  <label
                    key={productId}
                    className={`flex items-center justify-between p-2 hover:bg-white transition-colors cursor-pointer group ${isSelected ? 'bg-blue-50' : ''}`}
                  >
                    <div className="flex items-center space-x-3 overflow-hidden">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleFrequentlyOrderedProductChange(productId)}
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
                      </div>
                    </div>
                  </label>
                );
              })
            ) : (
              <div className="p-4 text-center">
                <p className="text-sm text-gray-500 italic">
                  No products found for the current search.
                </p>
              </div>
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
        )}

        {isUploading && (
          <div className="text-blue-600 font-medium text-center mt-6">Uploading files, please wait...</div>
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