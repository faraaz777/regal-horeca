/**
 * Admin Dashboard Page
 * 
 * Enhanced dashboard with optimized data fetching, recent products, quick actions, and charts
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import useSWR from 'swr';
import { useAppContext } from '@/context/AppContext';
import { PlusIcon } from '@/components/Icons';

// Optimized stats fetcher - only gets counts, not full data
const fetcher = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch');
  }
  return response.json();
};

export default function AdminDashboardPage() {
  // Single unified API call instead of 5-6 separate calls
  const { data: statsResponse, error: statsError, isLoading: statsLoading } = useSWR(
    '/api/admin/stats',
    fetcher,
    { revalidateOnFocus: false }
  );

  const stats = statsResponse?.stats || {};
  const recentProducts = statsResponse?.recentProducts || [];
  const statusDistribution = stats.statusDistribution || {};

  // Fix hydration error by only setting time on client side
  const [currentTime, setCurrentTime] = useState('');
  
  useEffect(() => {
    setCurrentTime(new Date().toLocaleTimeString());
  }, []);

  const statCards = [
    { name: 'Total Products', value: stats.totalProducts || 0, link: '/admin/products', color: 'blue' },
    { name: 'Total Categories', value: stats.totalCategories || 0, link: '/admin/categories', color: 'green' },
    { name: 'Business Types', value: stats.totalBusinessTypes || 0, link: '/admin/business-types', color: 'purple' },
    { name: 'Featured Products', value: stats.featuredProducts || 0, link: '/admin/products', color: 'yellow' },
  ];

  const quickActions = [
    { name: 'Add Product', link: '/admin/products/add', icon: PlusIcon },
    { name: 'Add Category', link: '/admin/categories', icon: PlusIcon },
    { name: 'Add Business Type', link: '/admin/business-types', icon: PlusIcon },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Dashboard</h1>
        {currentTime && (
          <div className="text-xs sm:text-sm text-gray-500">
            Last updated: {currentTime}
          </div>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <Link 
            href={stat.link} 
            key={stat.name} 
            className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
          >
            <h3 className="text-lg font-medium text-gray-500">{stat.name}</h3>
            <p className="mt-2 text-4xl font-bold text-primary">
              {statsLoading ? '...' : stat.value}
            </p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Products */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">Recent Products</h2>
            <Link href="/admin/products" className="text-sm text-primary hover:underline">
              View All
            </Link>
          </div>
          {statsLoading ? (
            <div className="text-center py-8 text-gray-500">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              <p className="mt-2">Loading...</p>
            </div>
          ) : recentProducts && recentProducts.length > 0 ? (
            <div className="space-y-3">
              {recentProducts.map((product) => (
                <Link
                  key={product._id || product.id}
                  href={`/admin/products`}
                  className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className="relative h-12 w-12 flex-shrink-0">
                    <Image
                      src={product.heroImage}
                      alt={product.title}
                      fill
                      className="rounded-md object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {product.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      {product.createdAt ? new Date(product.createdAt).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full whitespace-nowrap ${
                    product.status === 'In Stock' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {product.status}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">No products yet</div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Quick Actions</h2>
          <div className="space-y-2">
            {quickActions.map((action) => (
              <Link
                key={action.name}
                href={action.link}
                className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <action.icon className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium text-gray-700">{action.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Status Distribution Chart (Simple) */}
      {(stats.totalProducts || 0) > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Product Status Distribution</h2>
          <div className="space-y-3">
            {Object.entries(statusDistribution).map(([status, count]) => {
              const total = stats.totalProducts || 0;
              const percentage = total > 0 ? (count / total) * 100 : 0;
              return (
                <div key={status} className="flex items-center gap-4">
                  <div className="w-24 text-sm text-gray-600">{status}</div>
                  <div className="flex-1 bg-gray-200 rounded-full h-6 relative overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        status === 'In Stock' ? 'bg-green-500' :
                        status === 'Out of Stock' ? 'bg-red-500' :
                        'bg-yellow-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="w-12 text-sm font-medium text-gray-700 text-right">
                    {count}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
