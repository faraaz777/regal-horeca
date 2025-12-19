/**
 * Admin Enquiries List Page
 * 
 * Displays all customer enquiries with filters, status badges, and quick actions.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { SearchIcon, FilterIcon, EyeIcon, PhoneIcon, MailIcon, WhatsAppIcon, ClockIcon } from '@/components/Icons';
import { getWhatsAppCustomerLink } from '@/lib/utils/whatsapp';

const ITEMS_PER_PAGE = 20;

// SWR fetcher
const fetcher = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch');
  }
  return response.json();
};

// Status badge component
const StatusBadge = ({ status }) => {
  const statusConfig = {
    'new': { label: 'New', color: 'bg-blue-100 text-blue-800' },
    'in-progress': { label: 'In Progress', color: 'bg-yellow-100 text-yellow-800' },
    'awaiting-customer': { label: 'Awaiting Customer', color: 'bg-purple-100 text-purple-800' },
    'closed': { label: 'Closed', color: 'bg-green-100 text-green-800' },
    'spam': { label: 'Spam', color: 'bg-red-100 text-red-800' },
  };

  const config = statusConfig[status] || statusConfig['new'];

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
};

// Priority badge component
const PriorityBadge = ({ priority }) => {
  const priorityConfig = {
    'low': { label: 'Low', color: 'bg-gray-100 text-gray-800' },
    'normal': { label: 'Normal', color: 'bg-blue-100 text-blue-800' },
    'high': { label: 'High', color: 'bg-red-100 text-red-800' },
  };

  const config = priorityConfig[priority] || priorityConfig['normal'];

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
};

export default function AdminEnquiriesPage() {
  const router = useRouter();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Build URL with filters and pagination
  const getEnquiriesUrl = (page, search, status, priority) => {
    const skip = (page - 1) * ITEMS_PER_PAGE;
    let url = `/api/enquiries?limit=${ITEMS_PER_PAGE}&skip=${skip}`;
    if (search) {
      url += `&search=${encodeURIComponent(search)}`;
    }
    if (status && status !== 'all') {
      url += `&status=${status}`;
    }
    if (priority && priority !== 'all') {
      url += `&priority=${priority}`;
    }
    return url;
  };

  // Use SWR for data fetching
  const { data, error, isLoading, mutate } = useSWR(
    getEnquiriesUrl(currentPage, searchTerm, statusFilter, priorityFilter),
    fetcher,
    {
      revalidateOnFocus: false, // Disable auto-refresh on focus
      refreshInterval: 120000, // Refresh every 2 minutes (was 30s)
    }
  );

  const enquiries = data?.enquiries || [];
  const total = data?.total || 0;
  const statusCounts = data?.statusCounts || {};

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentPage === 1) {
        mutate();
      } else {
        setCurrentPage(1);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm, statusFilter, priorityFilter]);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
  const startItem = total > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, total);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getWhatsAppLink = (phone, name, categories, message) => {
    const text = `Hello ${name},\n\nThank you for your enquiry${categories && categories.length > 0 ? ` about ${categories.join(', ')}` : ''}.\n\n${message || 'We will get back to you shortly.'}`;
    // Generate WhatsApp link to customer number (admin replying from business number)
    return getWhatsAppCustomerLink(phone, text);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Customer Enquiries</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Manage and respond to customer enquiries</p>
        </div>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <button
          onClick={() => setStatusFilter('all')}
          className={`p-4 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow text-left ${
            statusFilter === 'all' ? 'ring-2 ring-primary' : ''
          }`}
        >
          <div className="text-sm text-gray-600">All</div>
          <div className="text-2xl font-bold text-gray-800 mt-1">{total}</div>
        </button>
        <button
          onClick={() => setStatusFilter('new')}
          className={`p-4 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow text-left ${
            statusFilter === 'new' ? 'ring-2 ring-blue-500' : ''
          }`}
        >
          <div className="text-sm text-gray-600">New</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">{statusCounts['new'] || 0}</div>
        </button>
        <button
          onClick={() => setStatusFilter('in-progress')}
          className={`p-4 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow text-left ${
            statusFilter === 'in-progress' ? 'ring-2 ring-yellow-500' : ''
          }`}
        >
          <div className="text-sm text-gray-600">In Progress</div>
          <div className="text-2xl font-bold text-yellow-600 mt-1">{statusCounts['in-progress'] || 0}</div>
        </button>
        <button
          onClick={() => setStatusFilter('awaiting-customer')}
          className={`p-4 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow text-left ${
            statusFilter === 'awaiting-customer' ? 'ring-2 ring-purple-500' : ''
          }`}
        >
          <div className="text-sm text-gray-600">Awaiting</div>
          <div className="text-2xl font-bold text-purple-600 mt-1">{statusCounts['awaiting-customer'] || 0}</div>
        </button>
        <button
          onClick={() => setStatusFilter('closed')}
          className={`p-4 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow text-left ${
            statusFilter === 'closed' ? 'ring-2 ring-green-500' : ''
          }`}
        >
          <div className="text-sm text-gray-600">Closed</div>
          <div className="text-2xl font-bold text-green-600 mt-1">{statusCounts['closed'] || 0}</div>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-md">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-grow">
            <input
              type="text"
              placeholder="Search by name, email, phone, or message..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <SearchIcon className="w-4 h-4" />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Status</option>
            <option value="new">New</option>
            <option value="in-progress">In Progress</option>
            <option value="awaiting-customer">Awaiting Customer</option>
            <option value="closed">Closed</option>
            <option value="spam">Spam</option>
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Priority</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Enquiries Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-600">Loading enquiries...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-600">Error loading enquiries. Please try again.</div>
        ) : enquiries.length === 0 ? (
          <div className="p-8 text-center text-gray-600">No enquiries found.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Enquiry ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User Type
                    </th>
                    {/* Source column removed - not used in business logic */}
                    {/* Categories column hidden from display */}
                    {/* Type column hidden from display */}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Priority
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {enquiries.map((enquiry) => {
                    const customer = enquiry.customerId || {};
                    const customerName = customer.name || enquiry.name || 'N/A';
                    const customerEmail = customer.email || enquiry.email || '';
                    const customerPhone = customer.phone || enquiry.phone || '';
                    
                    const userTypeBadge = enquiry.userType === 'business' 
                      ? 'bg-green-100 text-green-800' 
                      : enquiry.userType === 'customer'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800';

                    return (
                      <tr key={enquiry._id} className="hover:bg-gray-50">
                        {/* Enquiry ID */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-mono font-medium text-gray-900">
                            {enquiry.enquiryId || enquiry._id.toString().slice(-8)}
                          </div>
                        </td>
                        {/* Customer */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <div className="text-sm font-medium text-gray-900">{customerName}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                              {customerPhone && (
                                <a href={`tel:${customerPhone}`} className="flex items-center gap-1 hover:text-primary">
                                  <PhoneIcon className="w-3 h-3" />
                                  {customerPhone}
                                </a>
                              )}
                              {customerEmail && (
                                <a href={`mailto:${customerEmail}`} className="flex items-center gap-1 hover:text-primary">
                                  <MailIcon className="w-3 h-3" />
                                  {customerEmail}
                                </a>
                              )}
                            </div>
                          </div>
                        </td>
                        {/* User Type */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded ${userTypeBadge}`}>
                            {enquiry.userType === 'business' ? 'Business' : enquiry.userType === 'customer' ? 'Customer' : 'Unknown'}
                          </span>
                        </td>
                        {/* Source column removed - not used in business logic */}
                        {/* Categories column hidden from display */}
                        {/* Type column hidden from display */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge status={enquiry.status} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <PriorityBadge priority={enquiry.priority} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 flex items-center gap-1">
                            <ClockIcon className="w-4 h-4 text-gray-400" />
                            {formatDate(enquiry.createdAt)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/admin/enquiries/${enquiry._id}`}
                              className="text-primary hover:text-primary-700 flex items-center gap-1"
                            >
                              <EyeIcon className="w-4 h-4" />
                              View
                            </Link>
                            {customerPhone && (
                              <a
                                href={getWhatsAppLink(customerPhone, customerName, enquiry.categories, enquiry.message)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-600 hover:text-green-700 flex items-center gap-1"
                              >
                                <WhatsAppIcon className="w-4 h-4" />
                                WhatsApp
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing {startItem} to {endItem} of {total} enquiries
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

