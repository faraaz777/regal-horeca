/**
 * WhatsApp Utility Functions
 * 
 * Handles WhatsApp business number and link generation
 */

/**
 * Get WhatsApp Business Number from environment variable
 * Format: Country code + number (e.g., 917093913311 for India)
 * Defaults to 917093913311 if not set
 */
export function getWhatsAppBusinessNumber() {
  const number = process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER || '917093913311';
  // Remove any spaces, dashes, or plus signs, keep only digits
  return number.replace(/\D/g, '');
}

/**
 * Generate WhatsApp link to business number (for customer enquiries)
 * @param {string} message - Pre-filled message for WhatsApp
 * @returns {string} WhatsApp URL
 */
export function getWhatsAppBusinessLink(message = '') {
  const phoneNumber = getWhatsAppBusinessNumber();
  if (message) {
    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
  }
  return `https://wa.me/${phoneNumber}`;
}

/**
 * Generate WhatsApp link to customer number (for admin replies)
 * @param {string} customerPhone - Customer's phone number
 * @param {string} message - Pre-filled message for WhatsApp
 * @returns {string} WhatsApp URL
 */
export function getWhatsAppCustomerLink(customerPhone, message = '') {
  if (!customerPhone) {
    return '#';
  }
  // Remove any spaces, dashes, or plus signs, keep only digits
  const cleanPhone = customerPhone.replace(/\D/g, '');
  if (message) {
    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
  }
  return `https://wa.me/${cleanPhone}`;
}

/**
 * Open WhatsApp link in a way that works reliably on iOS/Safari
 * Uses a temporary anchor element click for iOS, window.open for others
 * @param {string} url - WhatsApp URL to open
 */
export function openWhatsAppLink(url) {
  // Detect iOS/Safari
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  
  if (isIOS || isSafari) {
    // For iOS/Safari, create a temporary anchor and click it
    // This method works more reliably than window.open()
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } else {
    // For other browsers, use window.open
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

