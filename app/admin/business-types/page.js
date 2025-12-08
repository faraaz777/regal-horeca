'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { PlusIcon, EditIcon, TrashIcon } from '@/components/Icons';
import { showToast } from '@/lib/utils/toast';
import { apiClient, ApiError } from '@/lib/utils/apiClient';

export default function AdminBusinessTypesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBusinessType, setEditingBusinessType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [businessTypesList, setBusinessTypesList] = useState([]);
  const [isLoadingBusinessTypes, setIsLoadingBusinessTypes] = useState(true);

  // Fetch business types
  const fetchBusinessTypes = async () => {
    try {
      setIsLoadingBusinessTypes(true);
      setError('');
      const response = await fetch('/api/business-types');
      const data = await response.json();

      if (data.success) {
        setBusinessTypesList(data.businessTypes || []);
      } else {
        setError(data.error || 'Failed to load business types');
      }
    } catch (error) {
      setError('Failed to load business types: ' + error.message);
    } finally {
      setIsLoadingBusinessTypes(false);
    }
  };

  useEffect(() => {
    fetchBusinessTypes();
  }, []);

  const handleAddBusinessType = () => {
    setEditingBusinessType(null);
    setIsModalOpen(true);
  };

  const handleEditBusinessType = (businessType) => {
    setEditingBusinessType(businessType);
    setIsModalOpen(true);
  };

  const handleDeleteBusinessType = async (id) => {
    if (!window.confirm('Are you sure you want to delete this business type?')) {
      return;
    }

    const toastId = showToast.loading('Deleting business type...');
    setLoading(true);
    setError('');

    try {
      await apiClient.requestWithRetry(`/api/business-types/${id}`, {
        method: 'DELETE',
      });

      showToast.success('Business type deleted successfully');
      await fetchBusinessTypes();
    } catch (error) {
      if (error instanceof ApiError) {
        showToast.error(error.message);
        setError(error.message);
      } else {
        showToast.error('An error occurred while deleting the business type');
        setError('An error occurred while deleting the business type');
      }
    } finally {
      toast.dismiss(toastId);
      setLoading(false);
    }
  };

  const handleSaveBusinessType = async (businessTypeData) => {
    const toastId = showToast.loading(editingBusinessType ? 'Updating business type...' : 'Creating business type...');
    setLoading(true);
    setError('');

    try {
      // Generate slug if not provided
      if (!businessTypeData.slug) {
        businessTypeData.slug = businessTypeData.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
      }

      const url = editingBusinessType
        ? `/api/business-types/${editingBusinessType._id || editingBusinessType.id}`
        : '/api/business-types';

      const method = editingBusinessType ? 'PUT' : 'POST';

      await apiClient.requestWithRetry(url, {
        method,
        body: businessTypeData,
      });

      showToast.success(editingBusinessType ? 'Business type updated successfully' : 'Business type created successfully');
      setIsModalOpen(false);
      setEditingBusinessType(null);
      await fetchBusinessTypes();
    } catch (error) {
      if (error instanceof ApiError) {
        showToast.error(error.message);
        setError(error.message);
      } else {
        showToast.error(`An error occurred while ${editingBusinessType ? 'updating' : 'creating'} the business type`);
        setError(`An error occurred while ${editingBusinessType ? 'updating' : 'creating'} the business type`);
      }
    } finally {
      toast.dismiss(toastId);
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Manage Business Types</h1>
        <button
          type="button"
          onClick={handleAddBusinessType}
          className="bg-primary hover:bg-primary-700 text-white font-bold py-2 px-4 rounded-md flex items-center gap-2"
        >
          <PlusIcon /> Add Business Type
        </button>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        {isLoadingBusinessTypes ? (
          <div className="px-6 py-8 text-center text-gray-500">
            Loading business types...
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Slug</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {businessTypesList.map((bt) => (
                <tr key={bt._id || bt.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{bt.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{bt.slug}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEditBusinessType(bt)}
                      className="text-indigo-600 hover:text-indigo-900 mr-4"
                      disabled={loading}
                      title="Edit business type"
                    >
                      <EditIcon />
                    </button>
                    <button
                      onClick={() => handleDeleteBusinessType(bt._id || bt.id)}
                      className="text-red-600 hover:text-red-900"
                      disabled={loading}
                      title="Delete business type"
                    >
                      <TrashIcon />
                    </button>
                  </td>
                </tr>
              ))}
              {businessTypesList.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                    No business types found. Click "Add Business Type" to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <BusinessTypeForm
          businessType={editingBusinessType}
          onSave={handleSaveBusinessType}
          onClose={() => {
            setIsModalOpen(false);
            setEditingBusinessType(null);
            setError('');
          }}
          loading={loading}
        />
      )}
    </div>
  );
}

/**
 * Business Type Form Component
 */
function BusinessTypeForm({ businessType, onSave, onClose, loading }) {
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (businessType) {
      setFormData({
        name: businessType.name || '',
        slug: businessType.slug || '',
        description: businessType.description || '',
      });
    } else {
      setFormData({
        name: '',
        slug: '',
        description: '',
      });
    }
  }, [businessType]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name) {
      setError('Please provide a business type name.');
      return;
    }

    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <form onSubmit={handleSubmit}>
          <div className="p-6 border-b">
            <h2 className="text-2xl font-bold">
              {businessType ? 'Edit Business Type' : 'Create New Business Type'}
            </h2>
          </div>
          <div className="p-6 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Name *</label>
              <input
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Slug</label>
              <input
                name="slug"
                value={formData.slug}
                onChange={handleChange}
                placeholder="auto-generated-if-left-blank"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <div className="flex justify-end gap-4 p-4 border-t bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md font-semibold hover:bg-gray-300 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-primary text-white rounded-md font-semibold hover:bg-primary-700 transition-colors"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Business Type'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

