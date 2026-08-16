import 'server-only';

import Customer from '@/lib/models/Customer';
import { isRealPhone, normalizePhone } from '@/lib/shared/customerIdentity';

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function rankCustomer(row, term, exactPhone) {
  const phone = String(row.phone || '');
  const company = String(row.companyName || '').toLowerCase();
  const name = String(row.name || '').toLowerCase();
  const q = term.toLowerCase();

  if (exactPhone && phone === exactPhone) return 0;
  if (company.includes(q)) return 1;
  if (name.includes(q)) return 2;
  return 3;
}

/**
 * Sales-floor autocomplete. Searches customers only (not enquiries).
 * Rank: exact phone, then company, then name.
 */
export async function searchCustomers({ q = '', limit = 10 }) {
  const term = String(q || '').trim();
  if (term.length < 2) {
    return { customers: [] };
  }

  const exactPhone = isRealPhone(term) ? normalizePhone(term) : '';
  const digitQuery = term.replace(/\D/g, '');
  const escaped = escapeRegex(term);
  const or = [
    { name: new RegExp(escaped, 'i') },
    { companyName: new RegExp(escaped, 'i') },
  ];

  if (digitQuery.length >= 2) {
    const phoneNeedle = exactPhone || digitQuery;
    or.push({ phone: new RegExp(escapeRegex(phoneNeedle), 'i') });
  }
  if (term.includes('@')) {
    or.push({ email: new RegExp(escaped, 'i') });
  }

  const cap = Math.min(Number(limit) || 10, 20);
  const rows = await Customer.find({ $or: or })
    .select('name phone email companyName updatedAt')
    .limit(50)
    .lean();

  const customers = rows
    .sort((a, b) => {
      const delta = rankCustomer(a, term, exactPhone) - rankCustomer(b, term, exactPhone);
      if (delta !== 0) return delta;
      return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
    })
    .slice(0, cap)
    .map((c) => ({
      id: String(c._id),
      name: c.name || '',
      phone: c.phone || '',
      email: c.email || '',
      companyName: c.companyName || '',
    }));

  return { customers };
}
