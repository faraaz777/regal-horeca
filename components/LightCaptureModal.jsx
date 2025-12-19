/**
 * Light Capture Modal Component
 * 
 * A lightweight modal that captures minimal information (phone + business checkbox)
 * before redirecting to WhatsApp. Only shows once per user (stored in localStorage).
 */

'use client';

import { useState, useEffect } from 'react';
import { XIcon, WhatsAppIcon } from './Icons';
import toast from 'react-hot-toast';

const STORAGE_KEY = 'regal_lead_profile';

export default function LightCaptureModal({ isOpen, onClose, onSubmit, defaultUserType = 'unknown' }) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [isBusiness, setIsBusiness] = useState(defaultUserType === 'business');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasExistingProfile, setHasExistingProfile] = useState(false);

  // Load saved profile if exists - always pre-fill but allow editing
  useEffect(() => {
    if (typeof window !== 'undefined' && isOpen) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const profile = JSON.parse(saved);
          setPhone(profile.phone || '');
          setName(profile.name || '');
          // If defaultUserType is business, prioritize it over saved profile
          setIsBusiness(defaultUserType === 'business' ? true : profile.userType === 'business');
          setHasExistingProfile(true);
        } catch (e) {
          // Ignore parse errors - reset to defaults
          setPhone('');
          setName('');
          setIsBusiness(defaultUserType === 'business');
          setHasExistingProfile(false);
        }
      } else {
        // Reset to defaults if no saved profile
        setPhone('');
        setName('');
        setIsBusiness(defaultUserType === 'business');
        setHasExistingProfile(false);
      }
    } else if (!isOpen) {
      // Reset state when modal closes (handles reload gracefully)
      setIsSubmitting(false);
    }
  }, [isOpen, defaultUserType]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate phone: must be exactly 10 digits
    const phoneDigits = phone.replace(/\D/g, '');
    if (!phoneDigits || phoneDigits.length !== 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }

    setIsSubmitting(true);

    try {
      const userType = isBusiness ? 'business' : 'customer';
      
      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          phone: phone.trim(),
          name: name.trim() || undefined, // Only save if provided
          userType,
          savedAt: Date.now(),
        }));
      }

      // Call onSubmit callback
      await onSubmit({
        phone: phone.trim(),
        name: name.trim() || undefined, // Only pass if provided
        userType,
      });

      onClose();
    } catch (error) {
      toast.error('Something went wrong. Please try again.');
      console.error('Error in light capture:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Modal */}
        <div
          className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-black/60 hover:text-black transition-colors"
            aria-label="Close"
          >
            <XIcon className="w-5 h-5" />
          </button>

          {/* Content */}
          <div className="pr-8">
            <h2 className="text-xl font-semibold text-black mb-2">
              Before we continue 👋
            </h2>
            <p className="text-sm text-black/60 mb-6">
              {hasExistingProfile 
                ? 'You can update your details below if needed' 
                : 'We just need a quick moment to get your details'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Phone Input */}
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-black mb-2">
                  Phone Number <span className="text-red-500">*</span>
                  {hasExistingProfile && (
                    <span className="ml-2 text-xs text-gray-500 font-normal">(You can edit)</span>
                  )}
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '');
                    if (digits.length <= 10) {
                      setPhone(digits);
                    }
                  }}
                  placeholder="Enter 10-digit phone number"
                  className="w-full px-4 py-2.5 border-2 border-black/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent text-black font-medium"
                  required
                  maxLength={10}
                />
                {phone && phone.length !== 10 && (
                  <p className="text-xs text-red-500 mt-1">
                    Phone number must be exactly 10 digits
                  </p>
                )}
              </div>

              {/* Name Input - Optional */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-black/70 mb-2">
                  {isBusiness ? 'Name / Business name' : 'Name'} <span className="text-gray-400 text-xs font-normal">(optional)</span>
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={isBusiness ? 'Enter your name or business name' : 'Enter your name'}
                  className="w-full px-4 py-2.5 border border-black/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-transparent text-black"
                />
              </div>

              {/* Business Checkbox */}
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border-2 border-black/20">
                <input
                  id="isBusiness"
                  type="checkbox"
                  checked={isBusiness}
                  onChange={(e) => setIsBusiness(e.target.checked)}
                  className="mt-1 w-4 h-4 text-accent border-black/30 rounded focus:ring-accent focus:ring-2"
                />
                <label htmlFor="isBusiness" className="text-sm font-medium text-black cursor-pointer">
                  This enquiry is for a business / bulk order
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !phone || phone.replace(/\D/g, '').length !== 10}
                className="w-full bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <WhatsAppIcon className="w-5 h-5" />
                <span>{isSubmitting ? 'Processing...' : 'Continue on WhatsApp'}</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Utility function to get saved lead profile
 */
export function getSavedLeadProfile() {
  if (typeof window === 'undefined') return null;
  
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    // Ignore parse errors
  }
  return null;
}

/**
 * Utility function to check if user has saved profile
 */
export function hasSavedLeadProfile() {
  return getSavedLeadProfile() !== null;
}

/**
 * Update saved lead profile
 */
export function updateSavedLeadProfile({ phone, name, userType }) {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      phone: phone.trim(),
      name: name?.trim() || undefined,
      userType: userType || 'unknown',
      savedAt: Date.now(),
    }));
    return true;
  } catch (e) {
    console.error('Error updating lead profile:', e);
    return false;
  }
}

/**
 * Clear saved lead profile
 */
export function clearSavedLeadProfile() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

