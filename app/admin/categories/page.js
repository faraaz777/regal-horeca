



// /**
//  * Admin Categories Page
//  * 
//  * Category management page with:
//  * - List all categories in tree structure
//  * - Create new categories
//  * - Edit categories
//  * - Delete categories (with validation)
//  */

'use client';

import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useAppContext } from '@/context/AppContext';
import { PlusIcon, EditIcon, TrashIcon, ChevronRightIcon, ChevronDownIcon } from '@/components/Icons';
import { showToast } from '@/lib/utils/toast';
import { apiClient, ApiError } from '@/lib/utils/apiClient';

export default function AdminCategoriesPage() {
  const { refreshCategories } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [categoriesList, setCategoriesList] = useState([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState(new Set());

  // Fetch categories directly from API (not flattened)
  const fetchCategoriesList = async () => {
    try {
      setIsLoadingCategories(true);
      setError('');
      const response = await fetch('/api/categories');
      const data = await response.json();
        if (data.success) {
          const cats = data.categories || [];
          // Only log in development
          if (process.env.NODE_ENV === 'development') {
            console.log('Fetched categories:', cats.length);
          }
          setCategoriesList(cats);
          return cats;
      } else {
        console.error('Failed to fetch categories:', data.error);
        setError(data.error || 'Failed to load categories');
        return [];
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
      setError('Failed to load categories: ' + error.message);
      return [];
    } finally {
      setIsLoadingCategories(false);
    }
  };

  useEffect(() => {
    fetchCategoriesList();
  }, []);

  const handleAddCategory = () => {
    setEditingCategory(null);
    setIsModalOpen(true);
  };

  const handleEditCategory = (category) => {
    setEditingCategory(category);
    setIsModalOpen(true);
  };

  const handleDeleteCategory = async (categoryId) => {
    // Check if category has children
    const hasChildren = categoriesList.some(c => {
      const cParent = c.parent?._id || c.parent;
      return cParent?.toString() === categoryId?.toString();
    });
    
    if (hasChildren) {
      showToast.error('Cannot delete category with children. Please delete or reassign its children first.');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this category?')) {
      return;
    }

    const toastId = showToast.loading('Deleting category...');
    setLoading(true);
    setError('');

    try {
      await apiClient.requestWithRetry(`/api/categories/${categoryId}`, {
        method: 'DELETE',
      });

      showToast.success('Category deleted successfully');
      await fetchCategoriesList();
      await refreshCategories();
    } catch (error) {
      if (error instanceof ApiError) {
        showToast.error(error.message);
        setError(error.message);
      } else {
        showToast.error('An error occurred while deleting the category');
        setError('An error occurred while deleting the category');
      }
    } finally {
      toast.dismiss(toastId);
      setLoading(false);
    }
  };

  const handleSaveCategory = async (categoryData) => {
    const toastId = showToast.loading(editingCategory ? 'Updating category...' : 'Creating category...');
    setLoading(true);
    setError('');

    try {
      // Generate slug if not provided
      if (!categoryData.slug) {
        categoryData.slug = categoryData.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
      }

      const url = editingCategory 
        ? `/api/categories/${editingCategory._id || editingCategory.id}`
        : '/api/categories';
      
      const method = editingCategory ? 'PUT' : 'POST';

      await apiClient.requestWithRetry(url, {
        method,
        body: categoryData,
      });

      showToast.success(editingCategory ? 'Category updated successfully' : 'Category created successfully');
      setIsModalOpen(false);
      setEditingCategory(null);
      
      // Refresh categories list immediately
      const refreshedCats = await fetchCategoriesList();
      // If this is a child category, expand its parent
      if (categoryData.parent && refreshedCats.length > 0) {
        const parentIdStr = (categoryData.parent?._id || categoryData.parent)?.toString();
        if (parentIdStr) {
          setExpandedCategories(prev => {
            const newSet = new Set(prev);
            newSet.add(parentIdStr);
            return newSet;
          });
        }
      }
      // Also refresh context
      await refreshCategories();
    } catch (error) {
      if (error instanceof ApiError) {
        showToast.error(error.message);
        setError(error.message);
      } else {
        showToast.error(`An error occurred while ${editingCategory ? 'updating' : 'creating'} the category`);
        setError(`An error occurred while ${editingCategory ? 'updating' : 'creating'} the category`);
      }
    } finally {
      toast.dismiss(toastId);
      setLoading(false);
    }
  };

  // Toggle expand/collapse for a category
  const toggleCategory = (categoryId) => {
    const categoryIdStr = categoryId?.toString();
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryIdStr)) {
        newSet.delete(categoryIdStr);  // Collapse
      } else {
        newSet.add(categoryIdStr);     // Expand
      }
      return newSet;
    });
  };

  // Expand all categories recursively
  const expandAllCategories = (tree) => {
    const allIds = new Set();
    const collectIds = (categories) => {
      categories.forEach(cat => {
        if (cat.children && cat.children.length > 0) {
          allIds.add((cat._id || cat.id).toString());
          collectIds(cat.children);
        }
      });
    };
    collectIds(tree);
    setExpandedCategories(allIds);
  };

  // Collapse all categories
  const collapseAllCategories = () => {
    setExpandedCategories(new Set());
  };

  // Helper function to extract parent ID from category
  const getParentId = (category) => {
    const cParent = category.parent;
    if (cParent === null || cParent === undefined) {
      return null;
    }
    if (typeof cParent === 'object') {
      // Parent is populated object or ObjectId object
      if (cParent._id) {
        return cParent._id.toString();
      }
      // If it's an ObjectId-like object, try to get the string value
      if (cParent.toString) {
        const idStr = cParent.toString();
        // Skip if parent points to itself (invalid data)
        const catId = (category._id || category.id)?.toString();
        if (catId === idStr) {
          console.warn('Category has parent pointing to itself:', category.name, category._id);
          return null; // Treat as top-level if parent is self
        }
        return idStr;
      }
    }
    // Parent is direct ID (string or ObjectId)
    const parentStr = cParent ? cParent.toString() : null;
    // Skip if parent points to itself
    if (parentStr) {
      const catId = (category._id || category.id)?.toString();
      if (catId === parentStr) {
        console.warn('Category has parent pointing to itself:', category.name, category._id);
        return null; // Treat as top-level if parent is self
      }
    }
    return parentStr;
  };

  // Helper function to get category ID (normalized to string)
  const getCategoryId = (category) => {
    const id = category._id || category.id;
    if (!id) return null;
    // Handle ObjectId objects
    if (typeof id === 'object' && id.toString) {
      return id.toString();
    }
    return String(id);
  };

  const buildCategoryTree = (parentId = null) => {
    if (!categoriesList || categoriesList.length === 0) {
      return [];
    }

    const parentIdStr = parentId ? parentId.toString() : null;

    const filtered = categoriesList.filter(category => {
      const cParentIdStr = getParentId(category);
      // Compare: both null (top-level) or both equal strings
      const matches = parentIdStr === cParentIdStr;
      return matches;
    });

    return filtered.map(category => {
      const cId = getCategoryId(category);
      const children = cId ? buildCategoryTree(cId) : [];
      return {
        ...category,
        children: children.length > 0 ? children : undefined,
      };
    });
  };

  // Rebuild tree whenever categoriesList changes
  const categoryTree = useMemo(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Rebuilding category tree with', categoriesList.length, 'categories');
    }
    const tree = buildCategoryTree();
    if (process.env.NODE_ENV === 'development') {
      console.log('Built tree with', tree.length, 'root categories');
    }
    return tree;
  }, [categoriesList]);

  const CategoryRow = ({ category, level }) => {
    const categoryId = category._id || category.id;
    const categoryIdStr = getCategoryId(category);
    // Check if category has children (handle both array and undefined)
    const hasChildren = Array.isArray(category.children) && category.children.length > 0;
    const isExpanded = expandedCategories.has(categoryIdStr);

    return (
      <>
        {/* Desktop Table Row */}
        <tr className="bg-white hover:bg-gray-50 transition-colors hidden md:table-row">
          <td 
            className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 cursor-pointer"
            style={{ paddingLeft: `${1.5 + level * 2}rem` }}
            onClick={() => hasChildren && toggleCategory(categoryId)}
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
              <span className={hasChildren ? 'font-semibold' : ''}>{category.name}</span>
            </div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{category.slug}</td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{category.level}</td>
          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
            <button 
              onClick={(e) => {
                e.stopPropagation(); // Prevent row toggle
                handleEditCategory(category);
              }} 
              className="text-indigo-600 hover:text-indigo-900 mr-4"
              disabled={loading}
              title="Edit category"
            >
              <EditIcon />
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation(); // Prevent row toggle
                handleDeleteCategory(categoryId);
              }} 
              className="text-red-600 hover:text-red-900"
              disabled={loading}
              title="Delete category"
            >
              <TrashIcon />
            </button>
          </td>
        </tr>
        
        {/* Mobile Card */}
        <div className="md:hidden bg-white border-b border-gray-200 p-4 hover:bg-gray-50 transition-colors">
          <div 
            className="flex items-start justify-between gap-3"
            onClick={() => hasChildren && toggleCategory(categoryId)}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                {hasChildren ? (
                  <span className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
                    {isExpanded ? (
                      <ChevronDownIcon className="w-4 h-4" />
                    ) : (
                      <ChevronRightIcon className="w-4 h-4" />
                    )}
                  </span>
                ) : (
                  <span className="w-4 h-4 flex-shrink-0"></span>
                )}
                <span className={`text-sm font-medium text-gray-900 ${hasChildren ? 'font-semibold' : ''}`} style={{ paddingLeft: `${level * 0.75}rem` }}>
                  {category.name}
                </span>
              </div>
              <div className="text-xs text-gray-500 mb-1" style={{ paddingLeft: `${(level + 1) * 0.75 + 1}rem` }}>
                <span className="font-medium">Slug:</span> {category.slug}
              </div>
              <div className="text-xs text-gray-500 capitalize" style={{ paddingLeft: `${(level + 1) * 0.75 + 1}rem` }}>
                <span className="font-medium">Level:</span> {category.level}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button 
                onClick={(e) => {
                  e.stopPropagation(); // Prevent row toggle
                  handleEditCategory(category);
                }} 
                className="text-indigo-600 hover:text-indigo-900 p-2"
                disabled={loading}
                title="Edit category"
              >
                <EditIcon />
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation(); // Prevent row toggle
                  handleDeleteCategory(categoryId);
                }} 
                className="text-red-600 hover:text-red-900 p-2"
                disabled={loading}
                title="Delete category"
              >
                <TrashIcon />
              </button>
            </div>
          </div>
        </div>
        
        {hasChildren && isExpanded && Array.isArray(category.children) && category.children.map(child => (
          <CategoryRow key={getCategoryId(child) || (child._id || child.id)} category={child} level={level + 1} />
        ))}
      </>
    );
  };

  return (
    <div>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Manage Categories</h1>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {categoryTree.length > 0 && (
            <>
              <button 
                onClick={() => expandAllCategories(categoryTree)} 
                className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-3 sm:px-4 rounded-md text-xs sm:text-sm transition-colors"
                title="Expand all categories"
              >
                Expand All
              </button>
              <button 
                onClick={collapseAllCategories} 
                className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-3 sm:px-4 rounded-md text-xs sm:text-sm transition-colors"
                title="Collapse all categories"
              >
                Collapse All
              </button>
            </>
          )}
          <button 
            onClick={handleAddCategory} 
            className="bg-primary hover:bg-primary-700 text-white font-bold py-2 px-3 sm:px-4 rounded-md flex items-center gap-2 text-sm sm:text-base"
          >
            <PlusIcon /> <span className="hidden sm:inline">Add Category</span><span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>
      
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        {isLoadingCategories ? (
          <div className="px-4 sm:px-6 py-8 text-center text-gray-500 text-sm sm:text-base">
            Loading categories...
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
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
                  {categoryTree.map(cat => (
                    <CategoryRow key={cat._id || cat.id} category={cat} level={0} />
                  ))}
                  {categoryTree.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                        No categories found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-200">
              {categoryTree.map(cat => (
                <CategoryRow key={cat._id || cat.id} category={cat} level={0} />
              ))}
              {categoryTree.length === 0 && (
                <div className="px-4 py-8 text-center text-gray-500 text-sm">
                  No categories found
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {isModalOpen && (
        <CategoryForm
          category={editingCategory}
          allCategories={categoriesList}
          onSave={handleSaveCategory}
          onClose={() => {
            setIsModalOpen(false);
            setEditingCategory(null);
            setError('');
          }}
          loading={loading}
        />
      )}
    </div>
  );
}

/**
 * Category Form Component
 * Modal form for creating/editing categories
 */
function CategoryForm({ category, allCategories, onSave, onClose, loading }) {
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    level: 'department',
    parent: null,
    tagline: '',
    image: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (category) {
      const parentId = category.parent?._id || category.parent;
      setFormData({
        ...category,
        parent: parentId || null,
      });
    } else {
      setFormData({
        name: '',
        slug: '',
        level: 'department',
        parent: null,
        tagline: '',
        image: '',
      });
    }
  }, [category]);

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
      setError('Please provide a category name.');
      return;
    }

    onSave(formData);
  };

  const levelOptions = ['department', 'category', 'subcategory', 'type'];
  const currentLevelIndex = levelOptions.indexOf(formData.level || 'department');
  const parentLevel = currentLevelIndex > 0 ? levelOptions[currentLevelIndex - 1] : null;
  const parentOptions = parentLevel 
    ? allCategories.filter(c => c.level === parentLevel) 
    : [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="p-4 sm:p-6 border-b">
            <h2 className="text-xl sm:text-2xl font-bold">
              {category ? 'Edit Category' : 'Create New Category'}
            </h2>
          </div>
          <div className="p-4 sm:p-6 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">Name *</label>
              <input 
                name="name" 
                value={formData.name || ''} 
                onChange={handleChange} 
                className="w-full mt-1 p-2.5 sm:p-2 border border-gray-300 rounded-md shadow-sm text-base" 
                required 
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Slug (URL)</label>
              <input 
                name="slug" 
                value={formData.slug || ''} 
                onChange={handleChange} 
                placeholder="auto-generated-if-left-blank" 
                className="w-full mt-1 p-2.5 sm:p-2 border border-gray-300 rounded-md shadow-sm text-base" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Level</label>
              <select 
                name="level" 
                value={formData.level} 
                onChange={handleChange} 
                className="w-full mt-1 p-2.5 sm:p-2 border border-gray-300 rounded-md shadow-sm text-base"
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
                <label className="block text-sm font-medium mb-1">
                  Parent {parentLevel.charAt(0).toUpperCase() + parentLevel.slice(1)}
                </label>
                <select 
                  name="parent" 
                  value={formData.parent?._id || formData.parent || ''} 
                  onChange={handleChange} 
                  className="w-full mt-1 p-2.5 sm:p-2 border border-gray-300 rounded-md shadow-sm text-base"
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
              <label className="block text-sm font-medium mb-1">Tagline</label>
              <input 
                name="tagline" 
                value={formData.tagline || ''} 
                onChange={handleChange} 
                className="w-full mt-1 p-2.5 sm:p-2 border border-gray-300 rounded-md shadow-sm text-base" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Image URL</label>
              <input 
                name="image" 
                type="url"
                value={formData.image || ''} 
                onChange={handleChange} 
                placeholder="https://example.com/image.jpg"
                className="w-full mt-1 p-2.5 sm:p-2 border border-gray-300 rounded-md shadow-sm text-base" 
              />
              <p className="mt-1 text-xs text-gray-500">
                Enter the full URL of the category image (e.g., from Unsplash, your CDN, or uploaded images)
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 p-4 border-t bg-gray-50">
            <button 
              type="button" 
              onClick={onClose} 
              className="w-full sm:w-auto px-6 py-2.5 sm:py-2 bg-gray-200 text-gray-700 rounded-md font-semibold hover:bg-gray-300 text-base"
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="w-full sm:w-auto px-6 py-2.5 sm:py-2 bg-primary text-white rounded-md font-semibold hover:bg-primary-700 text-base"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

