/**
 * Admin Enquiry Detail Page
 * 
 * Displays detailed view of a single enquiry with customer info, cart items,
 * communication log, and WhatsApp integration.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { 
  ChevronLeftIcon, 
  PhoneIcon, 
  MailIcon, 
  WhatsAppIcon, 
  ClockIcon,
  UserIcon,
  ShoppingCartIcon,
  ChevronDownIcon
} from '@/components/Icons';
import { getWhatsAppCustomerLink } from '@/lib/utils/whatsapp';

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

export default function EnquiryDetailPage() {
  const router = useRouter();
  const params = useParams();
  const enquiryId = params.id;

  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [notes, setNotes] = useState('');
  const [phone, setPhone] = useState('');
  const [userType, setUserType] = useState('');
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [isEditingUserType, setIsEditingUserType] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [isRelatedEnquiriesOpen, setIsRelatedEnquiriesOpen] = useState(true); // Default open
  const [showAllRelated, setShowAllRelated] = useState(false); // For "View All" button

  // Fetch enquiry details
  const { data, error, isLoading, mutate } = useSWR(
    enquiryId ? `/api/enquiries/${enquiryId}` : null,
    fetcher,
    {
      revalidateOnFocus: true,
    }
  );

  const enquiry = data?.enquiry;
  const enquiryItems = enquiry?.items || [];
  const messages = enquiry?.messages || [];
  const customer = enquiry?.customerId || {};
  const relatedEnquiries = enquiry?.relatedEnquiries || [];

  // Initialize form fields when data loads
  useEffect(() => {
    if (enquiry) {
      setStatus(enquiry.status || 'new');
      setPriority(enquiry.priority || 'normal');
      setAssignedTo(enquiry.assignedTo || '');
      setNotes(enquiry.notes || '');
      setPhone(enquiry.phone || '');
      setUserType(enquiry.userType || 'unknown');
    }
  }, [enquiry]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/enquiries/${enquiryId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          priority,
          assignedTo,
          notes,
          phone,
          userType,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update enquiry');
      }

      toast.success('Enquiry updated successfully');
      setIsEditingPhone(false);
      setIsEditingUserType(false);
      mutate();
    } catch (error) {
      toast.error('Failed to update enquiry');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) {
      toast.error('Please enter a note');
      return;
    }

    setIsAddingNote(true);
    try {
      const response = await fetch(`/api/enquiries/${enquiryId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: 'admin',
          channel: 'internal-note',
          message: newNote,
          createdBy: assignedTo || 'Admin',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add note');
      }

      toast.success('Note added successfully');
      setNewNote('');
      mutate();
    } catch (error) {
      toast.error('Failed to add note');
      console.error(error);
    } finally {
      setIsAddingNote(false);
    }
  };

  const getWhatsAppLink = (phone, name, categories, message) => {
    const text = messageText || `Hello ${name},\n\nThank you for your enquiry${categories && categories.length > 0 ? ` about ${categories.join(', ')}` : ''}.\n\nWe will get back to you shortly.`;
    // Generate WhatsApp link to customer number (admin replying from business number)
    return getWhatsAppCustomerLink(phone, text);
  };

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

  const customerName = customer.name || enquiry?.name || 'N/A';
  const customerEmail = customer.email || enquiry?.email || '';
  const customerPhone = customer.phone || enquiry?.phone || '';
  const customerCompany = customer.companyName || enquiry?.company || '';
  const customerState = enquiry?.state || '';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading enquiry details...</div>
      </div>
    );
  }

  if (error || !enquiry) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-red-600 mb-4">Error loading enquiry details</div>
        <Link
          href="/admin/enquiries"
          className="text-primary hover:text-primary-700 underline"
        >
          Back to Enquiries
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/enquiries"
            className="text-gray-600 hover:text-gray-900"
          >
            <ChevronLeftIcon className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Enquiry Details</h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">ID: {enquiryId}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Information */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <UserIcon className="w-5 h-5" />
              Customer Information
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-600">Name</label>
                <div className="text-lg font-medium text-gray-900">{customerName}</div>
              </div>
              {customerCompany && (
                <div>
                  <label className="text-sm text-gray-600">Company</label>
                  <div className="text-lg text-gray-900">{customerCompany}</div>
                </div>
              )}
              {customerState && (
                <div>
                  <label className="text-sm text-gray-600">State</label>
                  <div className="text-lg text-gray-900">{customerState}</div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {customerEmail && (
                  <div>
                    <label className="text-sm text-gray-600">Email</label>
                    <div className="flex items-center gap-2">
                      <MailIcon className="w-4 h-4 text-gray-400" />
                      <a href={`mailto:${customerEmail}`} className="text-primary hover:underline">
                        {customerEmail}
                      </a>
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-sm text-gray-600 flex items-center justify-between">
                    <span>Phone</span>
                    {!isEditingPhone && (
                      <button
                        onClick={() => setIsEditingPhone(true)}
                        className="text-xs text-blue-600 hover:text-blue-700 underline"
                      >
                        Edit
                      </button>
                    )}
                  </label>
                  {isEditingPhone ? (
                    <div className="mt-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, '');
                            if (digits.length <= 10) {
                              setPhone(digits);
                            }
                          }}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Enter 10-digit phone number"
                          maxLength={10}
                        />
                        <button
                          onClick={() => {
                            if (phone.length !== 10) {
                              toast.error('Phone number must be exactly 10 digits');
                              return;
                            }
                            setIsEditingPhone(false);
                            handleSave();
                          }}
                          className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setPhone(enquiry?.phone || customerPhone || '');
                            setIsEditingPhone(false);
                          }}
                          className="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                      {phone && phone.length !== 10 && (
                        <p className="text-xs text-red-500 mt-1">
                          Phone number must be exactly 10 digits
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <PhoneIcon className="w-4 h-4 text-gray-400" />
                      <a href={`tel:${phone || customerPhone}`} className="text-primary hover:underline">
                        {phone || customerPhone}
                      </a>
                    </div>
                  )}
                </div>
              </div>
              {enquiry.customerEnquiriesCount > 1 && (
                <div className="pt-2 border-t border-gray-200">
                  <p className="text-sm text-gray-600">
                    This customer has {enquiry.customerEnquiriesCount} total enquiries
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Related Enquiries Section */}
          {relatedEnquiries.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6" data-related-enquiries>
              <button
                onClick={() => setIsRelatedEnquiriesOpen(!isRelatedEnquiriesOpen)}
                className="w-full flex items-center justify-between text-xl font-bold text-gray-800 mb-4 hover:text-gray-900 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <UserIcon className="w-5 h-5" />
                  <span>Related Enquiries ({relatedEnquiries.length})</span>
                  {enquiry.customerEnquiriesCount > 0 && (
                    <span className="ml-2 text-sm font-normal text-blue-600 bg-blue-50 px-2 py-1 rounded">
                      🔵 Returning Customer
                    </span>
                  )}
                </div>
                <ChevronDownIcon 
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isRelatedEnquiriesOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
              
              {isRelatedEnquiriesOpen && (
                <div className="space-y-2">
                  {/* Show first 4, or all if showAllRelated is true */}
                  {(showAllRelated ? relatedEnquiries : relatedEnquiries.slice(0, 4)).map((related) => (
                    <Link
                      key={related._id}
                      href={`/admin/enquiries/${related._id}`}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{related.enquiryId}</div>
                        <div className="text-sm text-gray-600 mt-1">
                          {related.type === 'cart + enquiry' ? 'Cart + Enquiry' : 'Enquiry Only'} • {formatDate(related.createdAt)}
                        </div>
                        {related.name && related.name !== 'Guest User' && (
                          <div className="text-xs text-gray-500 mt-1">
                            {related.name}
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <StatusBadge status={related.status} />
                      </div>
                    </Link>
                  ))}
                  
                  {/* "View All" button - only show if more than 4 and not already showing all */}
                  {relatedEnquiries.length > 4 && !showAllRelated && (
                    <button
                      onClick={() => setShowAllRelated(true)}
                      className="w-full mt-3 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 hover:border-blue-300 transition-colors"
                    >
                      View All ({relatedEnquiries.length - 4} more)
                    </button>
                  )}
                  
                  {/* "Show Less" button - only show when showing all and more than 4 */}
                  {relatedEnquiries.length > 4 && showAllRelated && (
                    <button
                      onClick={() => {
                        setShowAllRelated(false);
                        // Scroll to top of section
                        const section = document.querySelector('[data-related-enquiries]');
                        if (section) {
                          section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                      }}
                      className="w-full mt-3 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      Show Less
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Enquiry Details */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Enquiry Details</h2>
            <div className="space-y-4">
              {/* Top row: Type and User Type side by side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-600">Type</label>
                  <div className="mt-1">
                    {enquiry.type === 'cart + enquiry' ? (
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                        Cart + Enquiry
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm">
                        Enquiry Only
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-600 flex items-center justify-between">
                    <span>User Type</span>
                    {!isEditingUserType && (
                      <button
                        onClick={() => setIsEditingUserType(true)}
                        className="text-xs text-blue-600 hover:text-blue-700 underline"
                      >
                        Edit
                      </button>
                    )}
                  </label>
                {isEditingUserType ? (
                  <div className="flex items-center gap-2 mt-1">
                    <select
                      value={userType}
                      onChange={(e) => setUserType(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="unknown">Unknown</option>
                      <option value="customer">Customer</option>
                      <option value="business">Business</option>
                    </select>
                    <button
                      onClick={() => {
                        setIsEditingUserType(false);
                        handleSave();
                      }}
                      className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setUserType(enquiry?.userType || 'unknown');
                        setIsEditingUserType(false);
                      }}
                      className="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="mt-1">
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      userType === 'business' 
                        ? 'bg-green-100 text-green-800' 
                        : userType === 'customer'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {userType === 'business' ? '🏢 Business' : userType === 'customer' ? '👤 Customer' : '❓ Unknown'}
                    </span>
                  </div>
                )}
                </div>
              </div>
              
              {/* Categories */}
              <div>
                <label className="text-sm text-gray-600">Categories</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {enquiry.categories && enquiry.categories.length > 0 ? (
                    enquiry.categories.map((cat, idx) => (
                      <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                        {cat}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-400">No categories specified</span>
                  )}
                </div>
              </div>
              
              {/* Message */}
              {enquiry.message && (
                <div>
                  <label className="text-sm text-gray-600">Message</label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-md text-gray-900 whitespace-pre-wrap">
                    {enquiry.message}
                  </div>
                </div>
              )}
              
              {/* Submitted Date */}
              <div className="pt-2 border-t border-gray-200">
                <label className="text-sm text-gray-600">Submitted</label>
                <div className="mt-1 flex items-center gap-2 text-gray-900">
                  <ClockIcon className="w-4 h-4 text-gray-400" />
                  {formatDate(enquiry.createdAt)}
                </div>
              </div>
            </div>
          </div>

          {/* Cart Items */}
          {enquiryItems.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <ShoppingCartIcon className="w-5 h-5" />
                Cart Items ({enquiryItems.length})
              </h2>
              <div className="space-y-4">
                {enquiryItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-3 bg-gray-50 rounded-md">
                    {item.productId?.heroImage && (
                      <img
                        src={item.productId.heroImage}
                        alt={item.productName}
                        className="w-16 h-16 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{item.productName}</div>
                      {item.productId?.price && (
                        <div className="text-sm text-gray-600">Price: ₹{item.productId.price}</div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-gray-900">Qty: {item.quantity}</div>
                      {item.notes && (
                        <div className="text-xs text-gray-600 mt-1">{item.notes}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Communication Log */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Communication Log</h2>
            <div className="space-y-4">
              {/* System message */}
              <div className="flex gap-3 pb-3 border-b border-gray-200">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                    <ClockIcon className="w-4 h-4 text-gray-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900">System</span>
                    <span className="text-xs text-gray-500">{formatDate(enquiry.createdAt)}</span>
                  </div>
                  <p className="text-sm text-gray-700">Enquiry created</p>
                </div>
              </div>

              {/* Messages */}
              {messages.map((msg, idx) => (
                <div key={idx} className="flex gap-3 pb-3 border-b border-gray-200">
                  <div className="flex-shrink-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      msg.sender === 'admin' ? 'bg-blue-100' : 'bg-green-100'
                    }`}>
                      <UserIcon className={`w-4 h-4 ${
                        msg.sender === 'admin' ? 'text-blue-600' : 'text-green-600'
                      }`} />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">
                        {msg.sender === 'admin' ? (msg.createdBy || 'Admin') : 'Customer'}
                      </span>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs capitalize">
                        {msg.channel}
                      </span>
                      <span className="text-xs text-gray-500">{formatDate(msg.createdAt)}</span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{msg.message}</p>
                  </div>
                </div>
              ))}

              {/* Add Note */}
              <div className="pt-4">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note or communication log entry..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  rows={3}
                />
                <button
                  onClick={handleAddNote}
                  disabled={isAddingNote || !newNote.trim()}
                  className="mt-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAddingNote ? 'Adding...' : 'Add Note'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status & Priority */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Manage Enquiry</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="new">New</option>
                  <option value="in-progress">In Progress</option>
                  <option value="awaiting-customer">Awaiting Customer</option>
                  <option value="closed">Closed</option>
                  <option value="spam">Spam</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assigned To</label>
                <input
                  type="text"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  placeholder="Admin name/email"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Internal notes..."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

          {/* WhatsApp Reply */}
          {customerPhone && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <WhatsAppIcon className="w-5 h-5 text-green-600" />
                Reply via WhatsApp
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder={`Hello ${customerName},\n\nThank you for your enquiry...`}
                    rows={6}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <a
                  href={getWhatsAppLink(customerPhone, customerName, enquiry.categories, messageText)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center justify-center gap-2"
                >
                  <WhatsAppIcon className="w-5 h-5" />
                  Open WhatsApp
                </a>
                <p className="text-xs text-gray-500">
                  Clicking this button will open WhatsApp with a pre-filled message. After sending, you can update the status to "In Progress" or "Awaiting Customer".
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

