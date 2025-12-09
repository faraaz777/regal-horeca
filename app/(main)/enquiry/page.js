/**
 * Enquiry Form Page
 * 
 * Displays an enquiry form for users to submit inquiries about products/services.
 */

'use client';

import { useState, Suspense, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { WhatsAppIcon, ChevronDownIcon } from '@/components/Icons';
import { useAppContext } from '@/context/AppContext';
import toast from 'react-hot-toast';

function EnquiryForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const categoryParam = searchParams.get('category') || '';
  const { cart, products, businessTypes } = useAppContext();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    message: '',
    categories: categoryParam ? [categoryParam] : [],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingEnquiryOnly, setIsSubmittingEnquiryOnly] = useState(false);
  const [includeCart, setIncludeCart] = useState(true); // Default to including cart
  const [isCartDropdownOpen, setIsCartDropdownOpen] = useState(false); // Dropdown state
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false); // Category dropdown state
  const categoryDropdownRef = useRef(null);

  // Close category dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target)) {
        setIsCategoryDropdownOpen(false);
      }
    };

    if (isCategoryDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCategoryDropdownOpen]);

  // Get cart items with product details
  const cartItems = useMemo(() => {
    return cart.map(cartItem => {
      const product = products.find(p => {
        const pid = p._id || p.id;
        return pid?.toString() === cartItem.productId?.toString();
      });
      return product ? {
        productId: cartItem.productId,
        productName: product.title || product.name || 'Product',
        quantity: cartItem.quantity,
      } : null;
    }).filter(Boolean);
  }, [cart, products]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCategoryToggle = (categoryName) => {
    setFormData(prev => {
      const currentCategories = prev.categories || [];
      if (currentCategories.includes(categoryName)) {
        return {
          ...prev,
          categories: currentCategories.filter(cat => cat !== categoryName)
        };
      } else {
        return {
          ...prev,
          categories: [...currentCategories, categoryName]
        };
      }
    });
  };

  const submitEnquiry = async (includeCartItems = true) => {
    if (!formData.name || !formData.email || !formData.phone) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (includeCartItems) {
      setIsSubmitting(true);
    } else {
      setIsSubmittingEnquiryOnly(true);
    }

    try {
      // Prepare enquiry data
      const enquiryData = {
        ...formData,
        cartItems: includeCartItems && includeCart && cartItems.length > 0 ? cartItems : [],
      };

      // Save enquiry to MongoDB
      const response = await fetch('/api/enquiries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(enquiryData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit enquiry');
      }

      // WhatsApp phone number
      const phoneNumber = '911234567890';
      
      // Format message for WhatsApp
      let whatsappMessage = 'Hello! I would like to make an enquiry:\n\n';
      whatsappMessage += `Name: ${formData.name}\n`;
      whatsappMessage += `Email: ${formData.email}\n`;
      whatsappMessage += `Phone: ${formData.phone}\n`;
      if (formData.company) {
        whatsappMessage += `Company: ${formData.company}\n`;
      }
      if (formData.categories && formData.categories.length > 0) {
        whatsappMessage += `Categories: ${formData.categories.join(', ')}\n`;
      }
      
      // Add cart items to WhatsApp message (only if includeCartItems is true and includeCart is true)
      if (includeCartItems && includeCart && cartItems.length > 0) {
        whatsappMessage += `\n📦 Cart Items:\n`;
        cartItems.forEach((item, index) => {
          whatsappMessage += `${index + 1}. ${item.productName} (Qty: ${item.quantity})\n`;
        });
        whatsappMessage += `Total Items: ${cartItems.reduce((sum, item) => sum + item.quantity, 0)}\n`;
      }
      
      if (formData.message) {
        whatsappMessage += `\nMessage: ${formData.message}\n`;
      }
      
      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(whatsappMessage)}`;
      window.open(whatsappUrl, '_blank');
      
      // Reset form
      setFormData({
        name: '',
        email: '',
        phone: '',
        company: '',
        message: '',
        categories: categoryParam ? [categoryParam] : [],
      });
      
      toast.success('Enquiry submitted successfully! Redirecting to WhatsApp...');
    } catch (error) {
      console.error('Error submitting enquiry:', error);
      toast.error(error.message || 'Failed to submit enquiry. Please try again.');
    } finally {
      if (includeCartItems) {
        setIsSubmitting(false);
      } else {
        setIsSubmittingEnquiryOnly(false);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await submitEnquiry(true); // Submit with cart items
  };

  const handleSubmitEnquiryOnly = async (e) => {
    e.preventDefault();
    await submitEnquiry(false); // Submit without cart items
  };

  return (
    <div className="bg-white min-h-screen py-8 md:py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
        <div className="mb-6 md:mb-8 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Enquiry Form</h1>
          <p className="text-sm sm:text-base text-gray-600">
            Fill out the form below and we'll get back to you via WhatsApp
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-50 rounded-lg p-4 sm:p-6 md:p-8 shadow-sm">
          <div className="space-y-6">
            {/* Two Column Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {/* Column 1 - First 3 Fields */}
              <div className="space-y-4 md:space-y-6">
                {/* Name */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition hover:border-gray-400"
                    placeholder="Enter your full name"
                  />
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition hover:border-gray-400"
                    placeholder="Enter your email address"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition hover:border-gray-400"
                    placeholder="Enter your phone number"
                  />
                </div>
              </div>

              {/* Column 2 - Next 3 Fields */}
              <div className="space-y-4 md:space-y-6">
                {/* Company */}
                <div>
                  <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name (Optional)
                  </label>
                  <input
                    type="text"
                    id="company"
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition hover:border-gray-400"
                    placeholder="Enter your company name"
                  />
                </div>

                {/* Categories Multi-Select */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Categories (Optional)
                  </label>
                  <div className="relative" ref={categoryDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-left flex items-center justify-between hover:border-gray-400 transition-colors focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    >
                      <span className="text-sm text-gray-700">
                        {formData.categories.length > 0 
                          ? `${formData.categories.length} categor${formData.categories.length === 1 ? 'y' : 'ies'} selected`
                          : 'Select categories'
                        }
                      </span>
                      <ChevronDownIcon 
                        className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${
                          isCategoryDropdownOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    
                    {/* Dropdown */}
                    {isCategoryDropdownOpen && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        <div className="p-2 space-y-1">
                          {businessTypes && businessTypes.length > 0 ? (
                            businessTypes.map((businessType) => {
                              const businessTypeName = businessType.name;
                              const isSelected = formData.categories.includes(businessTypeName);
                              return (
                                <label
                                  key={businessType._id || businessType.id || businessTypeName}
                                  className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer transition-colors"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleCategoryToggle(businessTypeName)}
                                    className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary focus:ring-2 transition-all hover:scale-110"
                                  />
                                  <span className="text-sm text-gray-700">{businessTypeName}</span>
                                </label>
                              );
                            })
                          ) : (
                            <p className="text-sm text-gray-500 p-2">No business types available</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Selected Categories Display */}
                  {formData.categories.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {formData.categories.map((catName, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-full"
                        >
                          {catName}
                          <button
                            type="button"
                            onClick={() => handleCategoryToggle(catName)}
                            className="hover:text-primary/80 transition-colors"
                            aria-label={`Remove ${catName}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Message */}
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                    Message (Optional)
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    rows={formData.categories.length > 0 ? 3 : 5}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition resize-none hover:border-gray-400"
                    placeholder="Tell us about your requirements..."
                  />
                </div>
              </div>
            </div>

            {/* Cart Items Dropdown - Full Width */}
            {cartItems.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg overflow-hidden transition-all duration-300 hover:shadow-md">
                {/* Dropdown Header */}
                <button
                  type="button"
                  onClick={() => setIsCartDropdownOpen(!isCartDropdownOpen)}
                  className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-blue-100 transition-colors duration-200 group"
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base sm:text-lg">📦</span>
                      <h3 className="text-xs sm:text-sm font-semibold text-gray-900">
                        Cart Items ({cartItems.reduce((sum, item) => sum + item.quantity, 0)} items)
                      </h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <label 
                      className="flex items-center gap-1.5 sm:gap-2 cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={includeCart}
                        onChange={(e) => {
                          e.stopPropagation();
                          setIncludeCart(e.target.checked);
                        }}
                        className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary focus:ring-2 transition-all duration-200 hover:scale-110"
                      />
                      <span className="text-xs text-gray-700 font-medium">Include</span>
                    </label>
                    <ChevronDownIcon 
                      className={`w-4 h-4 sm:w-5 sm:h-5 text-gray-600 transition-transform duration-300 ease-in-out ${
                        isCartDropdownOpen ? 'rotate-180' : ''
                      } group-hover:text-gray-900`}
                    />
                  </div>
                </button>

                {/* Dropdown Content */}
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    isCartDropdownOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-2 border-t border-blue-200">
                    {includeCart ? (
                      <>
                        <div className="space-y-2 sm:space-y-2.5 mt-2">
                          {cartItems.map((item, index) => (
                            <button
                              type="button"
                              key={index} 
                              onClick={() => {
                                // Dispatch custom event to open cart drawer
                                window.dispatchEvent(new CustomEvent('openCartDrawer'));
                              }}
                              className="w-full text-left text-xs sm:text-sm text-gray-700 flex justify-between items-center p-2 rounded-md bg-white/60 hover:bg-white transition-all duration-200 hover:shadow-sm hover:translate-x-1 active:scale-[0.98] cursor-pointer group"
                              style={{
                                animationDelay: `${index * 50}ms`,
                              }}
                            >
                              <span className="font-medium group-hover:text-primary transition-colors truncate pr-2">{item.productName}</span>
                              <span className="font-semibold text-primary px-2 py-0.5 bg-primary/10 rounded-full group-hover:bg-primary/20 transition-colors flex-shrink-0">
                                Qty: {item.quantity}
                              </span>
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-green-700 mt-3 flex items-center gap-1 font-medium">
                          <span>✓</span>
                          These items will be included in your enquiry
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-gray-600 mt-2 flex items-center gap-1">
                        <span>ℹ</span>
                        Cart items will not be included in your enquiry
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Submit Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 max-w-2xl mx-auto">
              {/* Submit with Cart Button */}
              <button
                type="submit"
                disabled={isSubmitting || isSubmittingEnquiryOnly}
                className="flex-1 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg active:scale-[0.98]"
              >
                <WhatsAppIcon className="w-5 h-5" />
                <span className="text-sm sm:text-base">{isSubmitting ? 'Processing...' : 'Submit with Cart'}</span>
              </button>

              {/* Submit Enquiry Only Button */}
              <button
                type="button"
                onClick={handleSubmitEnquiryOnly}
                disabled={isSubmitting || isSubmittingEnquiryOnly}
                className="flex-1 bg-black hover:bg-slate-800 active:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg active:scale-[0.98]"
              >
                <span className="text-sm sm:text-base">{isSubmittingEnquiryOnly ? 'Processing...' : 'Submit Enquiry Only'}</span>
              </button>
            </div>
          </div>
        </form>

        <div className="mt-4 sm:mt-6 text-center">
          <button
            onClick={() => router.back()}
            className="text-sm sm:text-base text-gray-600 hover:text-gray-900 transition-colors py-2 px-4 hover:underline"
          >
            ← Go Back
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EnquiryPage() {
  return (
    <Suspense fallback={
      <div className="bg-white min-h-screen py-12 flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    }>
      <EnquiryForm />
    </Suspense>
  );
}

