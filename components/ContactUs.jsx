'use client';

/**
 * Contact Us Component
 * 
 * Uses the same enquiry form structure as whom-we-serve pages
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { MailIcon, PhoneIcon, MapPinIcon, WhatsAppIcon, ChevronDownIcon } from '@/components/Icons';
import { useAppContext } from '@/context/AppContext';
import { getWhatsAppBusinessLink } from '@/lib/utils/whatsapp';
import toast from 'react-hot-toast';

export default function ContactUs() {
  const { cart, products, businessTypes } = useAppContext();
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    companyName: '',
    state: '',
    query: '',
    categories: [],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCartDropdownOpen, setIsCartDropdownOpen] = useState(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [includeCart, setIncludeCart] = useState(true);
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

  const submitEnquiry = async (e) => {
    e.preventDefault();
    
    if (!formData.fullName || !formData.email || !formData.phone || !formData.state) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const enquiryData = {
        name: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        company: formData.companyName,
        state: formData.state,
        message: formData.query,
        categories: formData.categories,
        cartItems: includeCart && cartItems.length > 0 ? cartItems : [],
      };

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

      let whatsappMessage = 'Hello! I would like to make an enquiry:\n\n';
      whatsappMessage += `Name: ${formData.fullName}\n`;
      whatsappMessage += `Email: ${formData.email}\n`;
      whatsappMessage += `Phone: ${formData.phone}\n`;
      if (formData.companyName) {
        whatsappMessage += `Company: ${formData.companyName}\n`;
      }
      whatsappMessage += `State: ${formData.state}\n`;
      if (formData.categories.length > 0) {
        whatsappMessage += `Categories: ${formData.categories.join(', ')}\n`;
      }
      
      if (includeCart && cartItems.length > 0) {
        whatsappMessage += `\n📦 Products I'm interested in:\n`;
        cartItems.forEach((item, index) => {
          whatsappMessage += `${index + 1}. ${item.productName} (Quantity: ${item.quantity})\n`;
        });
        whatsappMessage += `\nTotal Items: ${cartItems.reduce((sum, item) => sum + item.quantity, 0)}\n`;
      }
      
      if (formData.query) {
        whatsappMessage += `\nMessage: ${formData.query}\n`;
      }
      
      // Generate WhatsApp link to business number
      const whatsappUrl = getWhatsAppBusinessLink(whatsappMessage);
      window.open(whatsappUrl, '_blank');
      
      // Reset form
      setFormData({
        fullName: '',
        email: '',
        phone: '',
        companyName: '',
        state: '',
        query: '',
        categories: [],
      });
      
      toast.success('Enquiry submitted successfully! Opening WhatsApp...');
    } catch (error) {
      console.error('Error submitting enquiry:', error);
      toast.error(error.message || 'Failed to submit enquiry. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Left Side - Get in Touch */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-semibold mb-6">Get in Touch</h1>
              <div className="flex flex-wrap gap-6 md:gap-8 lg:gap-12 mx-4 md:mx-6 lg:mx-8">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                    <MapPinIcon className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-black mb-1">Address</h4>
                    <p className="text-black/70 text-sm">
                      Begum Bazar, Hyderabad<br />
                      Telangana, India
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                    <PhoneIcon className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-black mb-1">Phone</h4>
                    <p className="text-black/70 text-sm">
                      <a href="tel:+911234567890" className="hover:text-accent transition-colors">
                        +91 12345 67890
                      </a>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                    <MailIcon className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-black mb-1">Email</h4>
                    <p className="text-black/70 text-sm">
                      <a href="mailto:sales@regal.com" className="hover:text-accent transition-colors">
                        sales@regal.com
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Map */}
            <div className="h-[400px] bg-white border border-black/10 shadow-xl rounded-sm overflow-hidden relative">
              <iframe 
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3806.5!2d78.47!3d17.38!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bcb977e201015f3%3A0x0!2sAshok%20Bazar%2C%20Afzal%20Gunj%2C%20Hyderabad%2C%20Telangana%20500012!5e0!3m2!1sen!2sin!4v1709400000000!5m2!1sen!2sin&q=Ashok+Bazar+Afzal+Gunj+Hyderabad+Telangana+500012" 
                width="100%" 
                height="100%" 
                style={{ border: 0, filter: 'grayscale(100%) contrast(1.2)' }} 
                allowFullScreen={true} 
                loading="lazy" 
                referrerPolicy="no-referrer-when-downgrade"
                title="Regal Horeca Location"
              ></iframe>
              
              {/* Pinned Location Marker */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                <div className="relative">
                  <div className="w-6 h-6 bg-accent rounded-full border-2 border-white shadow-lg animate-pulse"></div>
                  <div className="absolute top-6 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-8 border-transparent border-t-accent"></div>
                </div>
              </div>
              
              <div className="absolute top-4 right-4 bg-white px-4 py-2 shadow-md rounded-sm">
                <span className="text-xs font-bold tracking-widest uppercase text-accent">Afzal Gunj</span>
              </div>
            </div>
          </div>

          {/* Right Side - Contact Us Form */}
          <div>
            <div className="mb-6">
              <h2 className="text-3xl font-bold tracking-tight mb-4">Contact Us</h2>
              <p className="text-black/70">
                Have questions? We'd love to hear from you. Fill out the form below and we'll send your enquiry details to WhatsApp.
              </p>
            </div>
            <form onSubmit={submitEnquiry} className="bg-white rounded-lg p-6 md:p-8 shadow-sm">
            <div className="space-y-6">
              {/* Two Column Grid Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Column 1 - Contact Details */}
                <div className="space-y-6">
                  {/* Name */}
                  <div>
                    <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="fullName"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition hover:border-gray-400"
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
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition hover:border-gray-400"
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
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition hover:border-gray-400"
                      placeholder="Enter your phone number"
                    />
                  </div>
                </div>

                {/* Column 2 - Additional Details */}
                <div className="space-y-6">
                  {/* Company & State - Side by Side */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Company */}
                    <div>
                      <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-2">
                        Company (Optional)
                      </label>
                      <input
                        type="text"
                        id="companyName"
                        name="companyName"
                        value={formData.companyName}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition hover:border-gray-400"
                        placeholder="Company name"
                      />
                    </div>

                    {/* State */}
                    <div>
                      <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-2">
                        State <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="state"
                        name="state"
                        value={formData.state}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition hover:border-gray-400"
                        placeholder="Your state"
                      />
                    </div>
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
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-left flex items-center justify-between hover:border-gray-400 transition-colors focus:ring-2 focus:ring-accent focus:border-transparent outline-none"
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
                                      className="w-4 h-4 text-accent border-gray-300 rounded focus:ring-accent focus:ring-2 transition-all hover:scale-110"
                                    />
                                    <span className="text-sm text-gray-700">{businessTypeName}</span>
                                  </label>
                                );
                              })
                            ) : (
                              <p className="text-sm text-gray-500 p-2">No categories available</p>
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
                            className="inline-flex items-center gap-1 px-2 py-1 bg-accent/10 text-accent text-xs rounded-full"
                          >
                            {catName}
                            <button
                              type="button"
                              onClick={() => handleCategoryToggle(catName)}
                              className="hover:text-accent/80 transition-colors"
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
                    <label htmlFor="query" className="block text-sm font-medium text-gray-700 mb-2">
                      Message (Optional)
                    </label>
                    <textarea
                      id="query"
                      name="query"
                      value={formData.query}
                      onChange={handleChange}
                      rows={formData.categories.length > 0 ? 3 : 4}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition resize-none hover:border-gray-400"
                      placeholder="Tell us about your requirements..."
                    />
                  </div>
                </div>
              </div>

              {/* Cart Items Dropdown - Full Width */}
              {cartItems.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg overflow-hidden transition-all duration-300 hover:shadow-md">
                  <button
                    type="button"
                    onClick={() => setIsCartDropdownOpen(!isCartDropdownOpen)}
                    className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-blue-100 transition-colors duration-200 group"
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className="text-base sm:text-lg">📦</span>
                      <h3 className="text-xs sm:text-sm font-semibold text-gray-900">
                        Cart Items ({cartItems.reduce((sum, item) => sum + item.quantity, 0)} items)
                      </h3>
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
                          className="w-4 h-4 text-accent border-gray-300 rounded focus:ring-accent focus:ring-2 transition-all duration-200 hover:scale-110"
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
                                  window.dispatchEvent(new CustomEvent('openCartDrawer'));
                                }}
                                className="w-full text-left text-xs sm:text-sm text-gray-700 flex justify-between items-center p-2 rounded-md bg-white/60 hover:bg-white transition-all duration-200 hover:shadow-sm hover:translate-x-1 active:scale-[0.98] cursor-pointer group"
                              >
                                <span className="font-medium group-hover:text-accent transition-colors truncate pr-2">{item.productName}</span>
                                <span className="font-semibold text-accent px-2 py-0.5 bg-accent/10 rounded-full group-hover:bg-accent/20 transition-colors flex-shrink-0">
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

              {/* Submit Button */}
              <div className="flex justify-center">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto min-w-[200px] bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-semibold py-3 px-8 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg active:scale-[0.98]"
                >
                  <WhatsAppIcon className="w-5 h-5" />
                  <span>{isSubmitting ? 'Submitting...' : 'Submit Enquiry'}</span>
                </button>
              </div>
            </div>
          </form>
          </div>
        </div>
      </div>
    </section>
  );
}
