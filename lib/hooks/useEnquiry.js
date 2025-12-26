/**
 * Enquiry Hook
 * 
 * Handles enquiry creation and WhatsApp redirection with enquiry tracking
 */

import { useState } from 'react';
import { getSavedLeadProfile, hasSavedLeadProfile } from '@/components/LightCaptureModal';
import { getWhatsAppBusinessLink, openWhatsAppLink } from '@/lib/utils/whatsapp';
import toast from 'react-hot-toast';

/**
 * Create an enquiry and redirect to WhatsApp
 * @param {Object} params
 * @param {string} params.source - Source of enquiry ('product-card', 'product-detail', 'cart', etc.)
 * @param {string} params.userType - User type ('business', 'customer', 'unknown')
 * @param {string} params.phone - Phone number (required)
 * @param {string} params.name - Name or business name (optional)
 * @param {Array} params.products - Array of product objects with {productId, productName, quantity}
 * @param {string} params.message - Optional message
 * @param {Array} params.cartItems - Optional cart items array
 */
export async function createEnquiryAndRedirect({
  source,
  userType = 'unknown',
  phone,
  name,
  products = [],
  message = '',
  cartItems = [],
}) {
  try {
    // Prepare enquiry data
    const enquiryData = {
      source,
      userType,
      phone,
      name: name || undefined, // Only include if provided
      cartItems: cartItems.length > 0 ? cartItems : products.map(p => ({
        productId: p.productId || p._id || p.id,
        productName: p.productName || p.title || p.name || 'Product',
        quantity: p.quantity || 1,
      })),
      message,
    };

    // Create enquiry via API
    const response = await fetch('/api/enquiries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(enquiryData),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to create enquiry');
    }

    const enquiry = data.enquiry;
    const enquiryId = enquiry.enquiryId || enquiry._id;

    // Format WhatsApp message
    let whatsappMessage = 'Hi, I\'m interested in the following products.\n\n';
    whatsappMessage += `Enquiry ID: ${enquiryId}\n`;
    if (name) {
      whatsappMessage += `Name: ${name}\n`;
    }
    whatsappMessage += `Type: ${userType === 'business' ? 'Business' : 'Customer'}\n\n`;

    if (enquiryData.cartItems.length > 0) {
      whatsappMessage += 'Products:\n';
      enquiryData.cartItems.forEach((item, index) => {
        whatsappMessage += `${index + 1}. ${item.productName}${item.quantity > 1 ? ` (Qty: ${item.quantity})` : ''}\n`;
      });
    }

    if (message) {
      whatsappMessage += `\nMessage: ${message}`;
    }

    whatsappMessage += '\n\nPlease assist.';

    // Redirect to WhatsApp
    const whatsappUrl = getWhatsAppBusinessLink(whatsappMessage);
    openWhatsAppLink(whatsappUrl);

    return enquiry;
  } catch (error) {
    console.error('Error creating enquiry:', error);
    toast.error('Failed to create enquiry. Please try again.');
    throw error;
  }
}

/**
 * Hook to handle enquiry flow with light capture
 */
export function useEnquiry() {
  const [isLoading, setIsLoading] = useState(false);

  const handleEnquiry = async ({
    source,
    defaultUserType = 'unknown',
    products = [],
    message = '',
    cartItems = [],
    onShowCapture,
  }) => {
    setIsLoading(true);

    try {
      // ALWAYS show modal (even if profile exists) so user can edit
      // Modal will be pre-filled if profile exists
      if (onShowCapture) {
        onShowCapture({
          source,
          defaultUserType,
          products,
          message,
          cartItems,
        });
      }
    } catch (error) {
      console.error('Error in enquiry flow:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    handleEnquiry,
    isLoading,
    hasSavedProfile: hasSavedLeadProfile(),
  };
}

