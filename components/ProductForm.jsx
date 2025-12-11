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
 * Moved OUTSIDE ProductForm so it's not recreated every render.
 * This prevents inputs inside from losing focus on each keystroke.
 */
const FormSection = ({ title, children }) => (
  <div className="p-6 border border-gray-200 rounded-lg">
    <h3 className="text-lg font-semibold mb-4 text-gray-700">{title}</h3>
    <div className="space-y-4">{children}</div>
  </div>
);

export default function ProductForm({ product, allProducts, onSave, onCancel }) {
  const { categories, businessTypes } = useAppContext();
  
  const [formData, setFormData] = useState({
    title: '',
    brand: '',
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
    filters: { material: [], color: [], usage: [] },
    materialInput: '',
    usageInput: '',
  });

  const [isUploading, setIsUploading] = useState(false);
  const [categorySelection, setCategorySelection] = useState({});
  const [additionalCategorySelections, setAdditionalCategorySelections] = useState([]);
  const [error, setError] = useState('');
  const initializedProductIdRef = useRef(null);

  // Initialize form data when product is provided (edit mode) - only once per product
  useEffect(() => {
    const currentProductId = product?._id || product?.id;
    
    if (product && initializedProductIdRef.current !== currentProductId) {
      const categoryId = product.categoryId?._id || product.categoryId;
      const categoryIds = product.categoryIds || [];
      
      setFormData({
        ...product,
        categoryId: categoryId?.toString() || '',
        categoryIds: categoryIds.map(cid => (cid?._id || cid)?.toString()).filter(Boolean),
        tagsInput: (product.tags || []).join(', '),
        materialInput: (product.filters?.material || []).join(', '),
        usageInput: (product.filters?.usage || []).join(', '),
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
      
      initializedProductIdRef.current = currentProductId;
    } else if (!product) {
      // Reset when switching from edit to add mode
      initializedProductIdRef.current = null;
    }
  }, [product]); // intentionally only depends on product

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

  const departments = categories.filter(c => c.level === 'department');
  const categoriesList = categorySelection.department ? getCategoriesByParent(categorySelection.department) : [];
  const subcategories = categorySelection.category ? getCategoriesByParent(categorySelection.category) : [];
  const types = categorySelection.subcategory ? getCategoriesByParent(categorySelection.subcategory) : [];

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const { checked } = e.target;
      setFormData({ ...formData, [name]: checked });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

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
    const candidates = allProducts.filter(p => {
      const pid = p._id || p.id;
      return pid?.toString() !== currentProductId?.toString();
    });
    
    const currentTags = formData.tagsInput 
      ? formData.tagsInput.split(',').map(t => t.trim().toLowerCase()) 
      : (formData.tags || []).map(t => t.toLowerCase());

    return candidates.map(candidate => {
      let score = 0;
      let reasons = [];

      const candidateCategoryId = candidate.categoryId?._id || candidate.categoryId;
      const formCategoryId = formData.categoryId;
      if (candidateCategoryId?.toString() === formCategoryId?.toString()) {
        score += 10;
        reasons.push('Same Category');
      }

      const sharedTags = (candidate.tags || []).filter(t => currentTags.includes(t.toLowerCase()));
      if (sharedTags.length > 0) {
        score += sharedTags.length * 3;
        reasons.push(`${sharedTags.length} Shared Tags`);
      }

      const sharedBusiness = (candidate.businessTypeSlugs || []).filter(s => 
        formData.businessTypeSlugs?.includes(s)
      );
      if (sharedBusiness.length > 0) {
        score += sharedBusiness.length * 2;
      }

      const currentPrice = Number(formData.price) || 0;
      if (currentPrice > 0 && candidate.price >= currentPrice * 0.7 && candidate.price <= currentPrice * 1.3) {
        score += 2;
      }

      return {
        ...candidate,
        relevanceScore: score,
        relevanceReasons: reasons
      };
    }).sort((a, b) => {
      const aId = a._id || a.id;
      const bId = b._id || b.id;
      const aSelected = formData.relatedProductIds?.some(id => id?.toString() === aId?.toString());
      const bSelected = formData.relatedProductIds?.some(id => id?.toString() === bId?.toString());
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return b.relevanceScore - a.relevanceScore;
    });
  }, [allProducts, product, formData.categoryId, formData.tagsInput, formData.businessTypeSlugs, formData.price, formData.relatedProductIds]);

  const handleAutoSuggestRelated = () => {
    const topMatches = getSortedRelatedCandidates
      .filter(c => c.relevanceScore > 0)
      .slice(0, 4)
      .map(c => c._id || c.id);

    if (topMatches.length > 0) {
      const newSelection = Array.from(new Set([...(formData.relatedProductIds || []), ...topMatches]));
      setFormData({ ...formData, relatedProductIds: newSelection });
    } else {
      alert("No strong matches found based on current Category or Tags.");
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
    const newVariants = isSelected
      ? currentVariants.filter(v => v.colorName !== color.name)
      : [...currentVariants, { colorName: color.name, colorHex: color.hex, images: [] }];
    setFormData({ ...formData, colorVariants: newVariants });
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
    
    const tags = formData.tagsInput 
      ? formData.tagsInput.split(',').map(t => t.trim()).filter(Boolean) 
      : [];
    const materials = formData.materialInput 
      ? formData.materialInput.split(',').map(m => m.trim()).filter(Boolean) 
      : [];
    const usages = formData.usageInput 
      ? formData.usageInput.split(',').map(u => u.trim()).filter(Boolean) 
      : [];
    
    // Ensure categoryIds is properly formatted
    const categoryIds = (formData.categoryIds || []).filter(id => id && id.trim() !== '');

    const finalProduct = {
      ...formData,
      price: Number(formData.price),
      tags,
      categoryIds,
      filters: {
        material: materials,
        usage: usages,
        color: formData.colorVariants?.map(v => v.colorName) || []
      }
    };
    
    // Remove temporary input fields
    delete finalProduct.tagsInput;
    delete finalProduct.materialInput;
    delete finalProduct.usageInput;

    // Ensure categoryId is included if it exists (even if empty string, API will handle it)
    // categoryId should be set when a "type" level category is selected
    if (finalProduct.categoryId === '' || finalProduct.categoryId === null || finalProduct.categoryId === undefined) {
      // Remove empty categoryId - API will handle this
      delete finalProduct.categoryId;
    }

    onSave(finalProduct);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm flex flex-col h-full">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      <form id="product-form" onSubmit={handleSubmit} className="flex-grow space-y-6">
        <FormSection title="Basic Information">
          <div>
            <label className="block text-sm font-medium">Title *</label>
            <input 
              name="title" 
              value={formData.title} 
              onChange={handleChange} 
              className="w-full mt-1 p-2 border border-gray-300 rounded-md shadow-sm" 
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Summary</label>
            <textarea 
              name="summary" 
              value={formData.summary} 
              onChange={handleChange} 
              className="w-full mt-1 p-2 border border-gray-300 rounded-md shadow-sm" 
              rows={2}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Full Description</label>
            <textarea 
              name="description" 
              value={formData.description} 
              onChange={handleChange} 
              className="w-full mt-1 p-2 border border-gray-300 rounded-md shadow-sm" 
              rows={4}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium">Brand</label>
              <input 
                name="brand" 
                value={formData.brand} 
                onChange={handleChange} 
                className="w-full mt-1 p-2 border border-gray-300 rounded-md shadow-sm" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Price (₹)</label>
              <input 
                type="number" 
                name="price" 
                value={formData.price || ''} 
                onChange={handleChange} 
                className="w-full mt-1 p-2 border border-gray-300 rounded-md shadow-sm" 
                min="0" 
                placeholder="0"
              />
            </div>
          </div>
        </FormSection>

        <FormSection title="Categorization">
          <div>
            <label className="block text-sm font-medium mb-2">Primary Category</label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium">Department</label>
                <select 
                  value={categorySelection.department || ''} 
                  onChange={(e) => handleCategoryChange('department', e.target.value)} 
                  className="w-full mt-1 p-2 border border-gray-300 rounded-md shadow-sm"
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
                <label className="block text-sm font-medium">Category</label>
                <select 
                  value={categorySelection.category || ''} 
                  onChange={(e) => handleCategoryChange('category', e.target.value)} 
                  disabled={!categorySelection.department} 
                  className="w-full mt-1 p-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100"
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
                <label className="block text-sm font-medium">Subcategory</label>
                <select 
                  value={categorySelection.subcategory || ''} 
                  onChange={(e) => handleCategoryChange('subcategory', e.target.value)} 
                  disabled={!categorySelection.category} 
                  className="w-full mt-1 p-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100"
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
                <label className="block text-sm font-medium">Type</label>
                <select 
                  value={categorySelection.type || ''} 
                  onChange={(e) => handleCategoryChange('type', e.target.value)} 
                  disabled={!categorySelection.subcategory} 
                  className="w-full mt-1 p-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100"
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
                          className="w-full mt-1 p-2 border border-gray-300 rounded-md shadow-sm text-sm"
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
                          className="w-full mt-1 p-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100 text-sm"
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
                          className="w-full mt-1 p-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100 text-sm"
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
                          className="w-full mt-1 p-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100 text-sm"
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
            <label className="block text-sm font-medium mb-2">Business Types (We Serve)</label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
              {businessTypes.map(bt => (
                <label key={bt._id || bt.id} className="flex items-center space-x-2 cursor-pointer p-2 border rounded hover:bg-gray-50">
                  <input 
                    type="checkbox" 
                    checked={formData.businessTypeSlugs?.includes(bt.slug)} 
                    onChange={() => handleBusinessTypeChange(bt.slug)} 
                    className="h-4 w-4 rounded text-primary focus:ring-primary" 
                  />
                  <span className="text-sm">{bt.name}</span>
                </label>
              ))}
            </div>
          </div>
        </FormSection>

        <FormSection title="Metadata & Filters">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Tags (comma-separated)</label>
              <input 
                name="tagsInput" 
                value={formData.tagsInput} 
                onChange={handleChange} 
                placeholder="e.g., durable, summer-sale" 
                className="w-full mt-1 p-2 border border-gray-300 rounded-md shadow-sm" 
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium">Material Filters (comma-separated)</label>
                <input 
                  name="materialInput" 
                  value={formData.materialInput} 
                  onChange={handleChange} 
                  placeholder="e.g., Porcelain, Ceramic" 
                  className="w-full mt-1 p-2 border border-gray-300 rounded-md shadow-sm" 
                />
                <p className="text-xs text-gray-500 mt-1">Used for the &apos;Material&apos; filter in the catalog.</p>
              </div>
              <div>
                <label className="block text-sm font-medium">Usage Filters (comma-separated)</label>
                <input 
                  name="usageInput" 
                  value={formData.usageInput} 
                  onChange={handleChange} 
                  placeholder="e.g., Dishwasher-Safe, Microwave-Safe" 
                  className="w-full mt-1 p-2 border border-gray-300 rounded-md shadow-sm" 
                />
                <p className="text-xs text-gray-500 mt-1">Used for the &apos;Usage&apos; filter in the catalog.</p>
              </div>
            </div>
          </div>
        </FormSection>

        <FormSection title="Images">
          <div>
            <label className="block text-sm font-medium">Hero Image *</label>
            <input 
              type="file" 
              accept="image/*" 
              onChange={e => handleImageUpload(e, 'heroImage')} 
              className="w-full mt-1 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
              disabled={isUploading}
            />
            {formData.heroImage && (
              <div className="mt-2 relative inline-block">
                <Image 
                  src={formData.heroImage} 
                  alt="Hero preview" 
                  width={96} 
                  height={96}
                  className="h-24 w-24 object-cover rounded-md" 
                />
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium">Gallery Images</label>
            <input 
              type="file" 
              accept="image/*" 
              multiple 
              onChange={e => handleImageUpload(e, 'gallery')} 
              className="w-full mt-1 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
              disabled={isUploading}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {formData.gallery?.map((url, index) => (
                <div key={index} className="relative">
                  <Image 
                    src={url} 
                    alt="Gallery preview" 
                    width={96} 
                    height={96}
                    className="h-24 w-24 object-cover rounded-md" 
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveGalleryImage(index)}
                    className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </FormSection>

        <FormSection title="Color Variants">
          <label className="block text-sm font-medium mb-2">Select the available colors for the product.</label>
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {AVAILABLE_COLORS.map(color => (
              <label key={color.name} className="flex items-center space-x-2 cursor-pointer p-1 rounded-md hover:bg-gray-50">
                <input 
                  type="checkbox" 
                  checked={formData.colorVariants?.some(v => v.colorName === color.name)} 
                  onChange={() => handleColorChange(color)} 
                  className="rounded h-4 w-4 text-primary focus:ring-primary"
                />
                <span style={{ backgroundColor: color.hex }} className="w-5 h-5 rounded-full border border-gray-300"></span>
                <span className="text-sm">{color.name}</span>
              </label>
            ))}
          </div>
          {formData.colorVariants && formData.colorVariants.length > 0 && (
            <div className="space-y-4 pt-4 border-t mt-4">
              <label className="block text-sm font-medium">Upload images for selected colors:</label>
              {formData.colorVariants.map(variant => (
                <div key={variant.colorName} className="flex items-center gap-4">
                  <div className="flex items-center gap-2 w-24">
                    <span style={{ backgroundColor: variant.colorHex }} className="w-5 h-5 rounded-full border"></span>
                    <p className="font-medium text-sm">{variant.colorName}</p>
                  </div>
                  <div className="flex-grow">
                    <input 
                      type="file" 
                      accept="image/*" 
                      multiple 
                      onChange={e => handleColorImageUpload(e, variant.colorName)} 
                      className="w-full text-sm file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                      disabled={isUploading}
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      {variant.images.map((url, index) => (
                        <div key={index} className="relative">
                          <Image 
                            src={url} 
                            alt={`${variant.colorName} preview`} 
                            width={64} 
                            height={64}
                            className="h-16 w-16 object-cover rounded-md" 
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveColorImage(variant.colorName, index)}
                            className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
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
              const isHighMatch = otherProduct.relevanceScore >= 10;
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div>
              <label className="block text-sm font-medium">Status</label>
              <select 
                name="status" 
                value={formData.status} 
                onChange={handleChange} 
                className="w-full mt-1 p-2 border border-gray-300 rounded-md shadow-sm"
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

        {isUploading && (
          <div className="text-blue-600 font-medium text-center">Uploading images, please wait...</div>
        )}
        
        <div className="flex justify-end gap-4 pt-6 border-t">
          <button 
            type="button" 
            onClick={onCancel} 
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md font-semibold hover:bg-gray-300"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="px-6 py-2 bg-primary text-white rounded-md font-semibold hover:bg-primary-700" 
            disabled={isUploading}
          >
            {isUploading ? 'Uploading...' : 'Save Product'}
          </button>
        </div>
      </form>
    </div>
  );
}
