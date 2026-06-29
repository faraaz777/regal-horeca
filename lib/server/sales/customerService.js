import 'server-only';

import Customer from '@/lib/models/Customer';
import { normalizePhone } from '@/lib/utils/phone';

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Fast customer lookup for sales floor autocomplete.
 * Phone is normalized before matching to enforce deduplication at search time.
 */
export async function searchCustomers({ q = '', limit = 10 }) {
  const term = String(q || '').trim();
  if (term.length < 2) {
    return { customers: [] };
  }

  const normalizedPhone = normalizePhone(term);
  const or = [{ name: new RegExp(escapeRegex(term), 'i') }];

  if (normalizedPhone) {
    or.push({ phone: new RegExp(escapeRegex(normalizedPhone), 'i') });
  }
  if (term.includes('@')) {
    or.push({ email: new RegExp(escapeRegex(term), 'i') });
  }

  const customers = await Customer.find({ $or: or })
    .select('name phone email companyName')
    .sort({ updatedAt: -1 })
    .limit(Math.min(limit, 20))
    .lean();

  return {
    customers: customers.map((c) => ({
      id: String(c._id),
      name: c.name,
      phone: c.phone,
      email: c.email,
      companyName: c.companyName || '',
    })),
  };
}
