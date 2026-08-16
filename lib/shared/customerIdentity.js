/**
 * Shared customer identity rules for sales, website enquiries, and future channels.
 *
 * A Customer is created only when a real phone or a real email exists.
 * Never invent temp emails or placeholder phones.
 */

import { normalizePhone as normalizePhoneDigits } from '@/lib/utils/phone';

const TEMP_EMAIL_DOMAIN = '@temp.regal-horeca.com';
const FAKE_PHONE = '0000000000';
const EMAIL_RE = /^\S+@\S+\.\S+$/;
const PLACEHOLDER_NAME_RE = /^(guest user|walk-in customer|customer\s*\d+)$/i;

export function normalizePhone(phone) {
  return normalizePhoneDigits(phone) || '';
}

export function normalizeEmail(email) {
  const value = String(email || '').trim().toLowerCase();
  if (!value || value.includes(TEMP_EMAIL_DOMAIN)) return '';
  return EMAIL_RE.test(value) ? value : '';
}

export function isRealPhone(phone) {
  const normalized = normalizePhone(phone);
  return Boolean(normalized) && normalized.length === 10 && normalized !== FAKE_PHONE;
}

export function isRealEmail(email) {
  return Boolean(normalizeEmail(email));
}

export function isPlaceholderName(name) {
  const value = String(name || '').trim();
  if (!value) return true;
  return PLACEHOLDER_NAME_RE.test(value);
}

/**
 * Strip placeholders and fake contact fields. hasIdentity means a Customer may be created.
 */
export function normalizeCustomerIdentity({ name, phone, email, companyName } = {}) {
  const normalizedPhone = isRealPhone(phone) ? normalizePhone(phone) : '';
  const normalizedEmail = normalizeEmail(email);
  const realName = isPlaceholderName(name) ? '' : String(name || '').trim();

  return {
    phone: normalizedPhone,
    email: normalizedEmail,
    name: realName,
    companyName: String(companyName || '').trim(),
    hasIdentity: Boolean(normalizedPhone || normalizedEmail),
  };
}
