/**
 * Admin Brands Page
 * 
 * Brand management page with:
 * - List all brands in tree structure
 * - Create new brands
 * - Edit brands
 * - Delete brands (with validation)
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useAppContext } from '@/context/AppContext';
import { PlusIcon, EditIcon, TrashIcon, ChevronRightIcon, ChevronDownIcon } from '@/components/Icons';
import { showToast } from '@/lib/utils/toast';
import { apiClient, ApiError } from '@/lib/utils/apiClient';

export default function AdminBrandsPage() {
  const { refreshBrands } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [brandsList, setBrandsList] = useState([]);
  const [isLoadingBrands, setIsLoadingBrands] = useState(true);
  const [expandedBrands, setExpandedBrands] = useState(new Set());

  // Fetch brands directly from API (not flattened)
  const fetchBrandsList = async () => {
    try {
      setIsLoadingBrands(true);
      setError('');
      const response = await fetch('/api/brands');
      const data = await response.json();
      if (data.success) {
        const brs = data.brands || [];
        setBrandsList(brs);
        return brs;
      } else {
        console.error('Failed to fetch brands:', data.error);
        setError(data.error || 'Failed to load brands');
        return [];
      }
    } catch (error) {
      console.error('Error fetching brands:', error);
      setError('Failed to load brands: ' + error.message);
      return [];
    } finally {
      setIsLoadingBrands(false);
    }
  };

  useEffect(() => {
    fetchBrandsList();
  }, []);

  const handleAddBrand = () => {
    setEditingBrand(null);
    setIsModalOpen(true);
  };

  const handleEditBrand = (brand) => {
    setEditingBrand(brand);
    setIsModalOpen(true);
  };

  const handleDeleteBrand = async (brandId) => {
    // Check if brand has children
    const hasChildren = brandsList.some(b => {
      const bParent = b.parent?._id || b.parent;
      return bParent?.toString() === brandId?.toString();
    });
    
    if (hasChildren) {
      showToast.error('Cannot delete brand with children. Please delete or reassign its children first.');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this brand?')) {
      return;
    }

    const toastId = showToast.loading('Deleting brand...');
    setLoading(true);
    setError('');

    try {
      await apiClient.requestWithRetry(`/api/brands/${brandId}`, {
        method: 'DELETE',
      });

      showToast.success('Brand deleted successfully');
      await fetchBrandsList();
      await refreshBrands();
    } catch (error) {
      if (error instanceof ApiError) {
        showToast.error(error.message);
        setError(error.message);
      } else {
        showToast.error('An error occurred while deleting the brand');
        setError('An error occurred while deleting the brand');
      }
    } finally {
      toast.dismiss(toastId);
      setLoading(false);
    }
  };

  const handleSaveBrand = async (brandData) => {
    const toastId = showToast.loading(editingBrand ? 'Updating brand...' : 'Creating brand...');
    setLoading(true);
    setError('');

    try {
      // Generate slug if not provided
      if (!brandData.slug) {
        brandData.slug = brandData.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
      }

      const url = editingBrand 
        ? `/api/brands/${editingBrand._id || editingBrand.id}`
        : '/api/brands';
      
      const method = editingBrand ? 'PUT' : 'POST';

      await apiClient.requestWithRetry(url, {
        method,
        body: brandData,
      });

      showToast.success(editingBrand ? 'Brand updated successfully' : 'Brand created successfully');
      setIsModalOpen(false);
      setEditingBrand(null);
      
      // Refresh brands list immediately
      const refreshedBrands = await fetchBrandsList();
      // If this is a child brand, expand its parent
      if (brandData.parent && refreshedBrands.length > 0) {
        const parentIdStr = (brandData.parent?._id || brandData.parent)?.toString();
        if (parentIdStr) {
          setExpandedBrands(prev => {
            const newSet = new Set(prev);
            newSet.add(parentIdStr);
            return newSet;
          });
        }
      }
      // Also refresh context
      await refreshBrands();
    } catch (error) {
      if (error instanceof ApiError) {
        showToast.error(error.message);
        setError(error.message);
      } else {
        showToast.error(`An error occurred while ${editingBrand ? 'updating' : 'creating'} the brand`);
        setError(`An error occurred while ${editingBrand ? 'updating' : 'creating'} the brand`);
      }
    } finally {
      toast.dismiss(toastId);
      setLoading(false);
    }
  };

  // Toggle expand/collapse for a brand
  const toggleBrand = (brandId) => {
    const brandIdStr = brandId?.toString();
    setExpandedBrands(prev => {
      const newSet = new Set(prev);
      if (newSet.has(brandIdStr)) {
        newSet.delete(brandIdStr);  // Collapse
      } else {
        newSet.add(brandIdStr);     // Expand
      }
      return newSet;
    });
  };

  // Expand all brands recursively
  const expandAllBrands = (tree) => {
    const allIds = new Set();
    const collectIds = (brands) => {
      brands.forEach(brand => {
        if (brand.children && brand.children.length > 0) {
          allIds.add((brand._id || brand.id).toString());
          collectIds(brand.children);
        }
      });
    };
    collectIds(tree);
    setExpandedBrands(allIds);
  };

  // Collapse all brands
  const collapseAllBrands = () => {
    setExpandedBrands(new Set());
  };

  // Helper function to extract parent ID from brand
  const getParentId = (brand) => {
    const bParent = brand.parent;
    if (bParent === null || bParent === undefined) {
      return null;
    }
    if (typeof bParent === 'object') {
      if (bParent._id) {
        return bParent._id.toString();
      }
      if (bParent.toString) {
        const idStr = bParent.toString();
        const brandId = (brand._id || brand.id)?.toString();
        if (brandId === idStr) {
          console.warn('Brand has parent pointing to itself:', brand.name, brand._id);
          return null;
        }
        return idStr;
      }
    }
    const parentStr = bParent ? bParent.toString() : null;
    if (parentStr) {
      const brandId = (brand._id || brand.id)?.toString();
      if (brandId === parentStr) {
        console.warn('Brand has parent pointing to itself:', brand.name, brand._id);
        return null;
      }
    }
    return parentStr;
  };

  // Helper function to get brand ID (normalized to string)
  const getBrandId = (brand) => {
    const id = brand._id || brand.id;
    if (!id) return null;
    if (typeof id === 'object' && id.toString) {
      return id.toString();
    }
    return String(id);
  };

  const buildBrandTree = (parentId = null) => {
    if (!brandsList || brandsList.length === 0) {
      return [];
    }

    const parentIdStr = parentId ? parentId.toString() : null;

    const filtered = brandsList.filter(brand => {
      const bParentIdStr = getParentId(brand);
      const matches = parentIdStr === bParentIdStr;
      return matches;
    });

    return filtered.map(brand => {
      const bId = getBrandId(brand);
      const children = bId ? buildBrandTree(bId) : [];
      return {
        ...brand,
        children: children.length > 0 ? children : undefined,
      };
    });
  };

  // Rebuild tree whenever brandsList changes
  const brandTree = useMemo(() => {
    const tree = buildBrandTree();
    return tree;
  }, [brandsList]);

  const BrandRow = ({ brand, level }) => {
    const brandId = brand._id || brand.id;
    const brandIdStr = getBrandId(brand);
    const hasChildren = Array.isArray(brand.children) && brand.children.length > 0;
    const isExpanded = expandedBrands.has(brandIdStr);

    return (
      <>
        <tr className="bg-white hover:bg-gray-50 transition-colors">
          <td 
            className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 cursor-pointer"
            style={{ paddingLeft: `${1.5 + level * 2}rem` }}
            onClick={() => hasChildren && toggleBrand(brandId)}
          >
            <div className="flex items-center gap-2">
              {hasChildren ? (
                <span className="text-gray-400 hover:text-gray-600 transition-colors">
                  {isExpanded ? (
                    <ChevronDownIcon className="w-4 h-4" />
                  ) : (
                    <ChevronRightIcon className="w-4 h-4" />
                  )}
                </span>
              ) : (
                <span className="w-4 h-4"></span>
              )}
              <span className={hasChildren ? 'font-semibold' : ''}>{brand.name}</span>
            </div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{brand.slug}</td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{brand.level}</td>
          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleEditBrand(brand);
              }} 
              className="text-indigo-600 hover:text-indigo-900 mr-4"
              disabled={loading}
              title="Edit brand"
            >
              <EditIcon />
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteBrand(brandId);
              }} 
              className="text-red-600 hover:text-red-900"
              disabled={loading}
              title="Delete brand"
            >
              <TrashIcon />
            </button>
          </td>
        </tr>
        {hasChildren && isExpanded && Array.isArray(brand.children) && brand.children.map(child => (
          <BrandRow key={getBrandId(child) || (child._id || child.id)} brand={child} level={level + 1} />
        ))}
      </>
    );
  };

  return (
    <div>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Manage Brands</h1>
        <div className="flex items-center gap-3">
          {brandTree.length > 0 && (
            <>
              <button 
                onClick={() => expandAllBrands(brandTree)} 
                className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors"
                title="Expand all brands"
              >
                Expand All
              </button>
              <button 
                onClick={collapseAllBrands} 
                className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors"
                title="Collapse all brands"
              >
                Collapse All
              </button>
            </>
          )}
          <button 
            onClick={handleAddBrand} 
            className="bg-primary hover:bg-primary-700 text-white font-bold py-2 px-4 rounded-md flex items-center gap-2"
          >
            <PlusIcon /> Add Brand
          </button>
        </div>
      </div>
      
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        {isLoadingBrands ? (
          <div className="px-6 py-8 text-center text-gray-500">
            Loading brands...
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Slug</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Level</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {brandTree.map(brand => (
                <BrandRow key={brand._id || brand.id} brand={brand} level={0} />
              ))}
              {brandTree.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No brands found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <BrandForm
          brand={editingBrand}
          allBrands={brandsList}
          onSave={handleSaveBrand}
          onClose={() => {
            setIsModalOpen(false);
            setEditingBrand(null);
            setError('');
          }}
          loading={loading}
        />
      )}
    </div>
  );
}

/**
 * Brand Form Component
 * Modal form for creating/editing brands
 */
function BrandForm({ brand, allBrands, onSave, onClose, loading }) {
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    level: 'department',
    parent: null,
    tagline: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (brand) {
      const parentId = brand.parent?._id || brand.parent;
      setFormData({
        ...brand,
        parent: parentId || null,
      });
    } else {
      setFormData({
        name: '',
        slug: '',
        level: 'department',
        parent: null,
        tagline: '',
      });
    }
  }, [brand]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'level') {
      setFormData({ ...formData, level: value, parent: null });
    } else if (name === 'parent') {
      setFormData({ ...formData, [name]: value || null });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name) {
      setError('Please provide a brand name.');
      return;
    }

    onSave(formData);
  };

  const levelOptions = ['department', 'category', 'subcategory'];
  const currentLevelIndex = levelOptions.indexOf(formData.level || 'department');
  const parentLevel = currentLevelIndex > 0 ? levelOptions[currentLevelIndex - 1] : null;
  const parentOptions = parentLevel 
    ? allBrands.filter(b => b.level === parentLevel) 
    : [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <form onSubmit={handleSubmit}>
          <div className="p-6 border-b">
            <h2 className="text-2xl font-bold">
              {brand ? 'Edit Brand' : 'Create New Brand'}
            </h2>
          </div>
          <div className="p-6 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium">Name *</label>
              <input 
                name="name" 
                value={formData.name || ''} 
                onChange={handleChange} 
                className="w-full mt-1 p-2 border border-gray-300 rounded-md shadow-sm" 
                required 
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Slug (URL)</label>
              <input 
                name="slug" 
                value={formData.slug || ''} 
                onChange={handleChange} 
                placeholder="auto-generated-if-left-blank" 
                className="w-full mt-1 p-2 border border-gray-300 rounded-md shadow-sm" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Level</label>
              <select 
                name="level" 
                value={formData.level} 
                onChange={handleChange} 
                className="w-full mt-1 p-2 border border-gray-300 rounded-md shadow-sm"
              >
                {levelOptions.map(level => (
                  <option key={level} value={level}>
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            {parentLevel && (
              <div>
                <label className="block text-sm font-medium">
                  Parent {parentLevel.charAt(0).toUpperCase() + parentLevel.slice(1)}
                </label>
                <select 
                  name="parent" 
                  value={formData.parent?._id || formData.parent || ''} 
                  onChange={handleChange} 
                  className="w-full mt-1 p-2 border border-gray-300 rounded-md shadow-sm"
                >
                  <option value="">Select a parent</option>
                  {parentOptions.map(p => (
                    <option key={p._id || p.id} value={p._id || p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium">Tagline</label>
              <input 
                name="tagline" 
                value={formData.tagline || ''} 
                onChange={handleChange} 
                className="w-full mt-1 p-2 border border-gray-300 rounded-md shadow-sm" 
              />
            </div>
          </div>
          <div className="flex justify-end gap-4 p-4 border-t bg-gray-50">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md font-semibold hover:bg-gray-300"
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="px-6 py-2 bg-primary text-white rounded-md font-semibold hover:bg-primary-700"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Brand'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

