/**
 * Phone Number Normalization Utility
 * 
 * Normalizes phone numbers to a consistent format for matching.
 * Handles various formats like +91, 091-, etc.
 */

/**
 * Normalizes a phone number to a consistent 10-digit format
 * @param {string} phone - The phone number to normalize
 * @returns {string} - Normalized 10-digit phone number (digits only)
 */
export function normalizePhone(phone) {
  if (!phone) return '';
  
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // If empty after removing non-digits, return empty
  if (!digits) return '';
  
  // Remove country code if present (91 for India)
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.substring(2);
  }
  
  // Remove leading 0 if present (e.g., 091-9876543210)
  const withoutLeadingZero = digits.startsWith('0') ? digits.substring(1) : digits;
  
  // Return last 10 digits (handles cases with extra digits)
  return withoutLeadingZero.slice(-10);
}

/**
 * Formats a normalized phone number for display
 * @param {string} phone - Normalized phone number
 * @returns {string} - Formatted phone number (e.g., +91 98765 43210)
 */
export function formatPhone(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized || normalized.length !== 10) return phone;
  
  return `+91 ${normalized.slice(0, 5)} ${normalized.slice(5)}`;
}

