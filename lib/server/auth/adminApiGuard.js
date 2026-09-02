import 'server-only';

export { requireAuth, assertAdmin, getAccessTokenFromRequest } from '@/lib/server/auth/requireAuth';
import { requireAuth as _requireAuth } from '@/lib/server/auth/requireAuth';

/** Product create/edit/soft-delete — data_entry + super_admin. */
export async function assertProductWrite(request) {
  const result = await _requireAuth(request, { permission: 'products:write' });
  return result.error || null;
}

/** Permanent product removal — super_admin only. */
export async function assertProductHardDelete(request) {
  const result = await _requireAuth(request, { roles: ['super_admin'] });
  return result.error || null;
}
