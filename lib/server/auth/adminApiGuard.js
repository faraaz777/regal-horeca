import 'server-only';

import { NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/utils/auth';

/**
 * When `SKIP_ADMIN_AUTH=true`, admin API routes accept requests without a Bearer token
 * (local dev only). Production should omit this and require JWT from POST /api/admin/login.
 */
export function assertAdmin(request) {
  if (process.env.SKIP_ADMIN_AUTH === 'true') {
    return null;
  }
  const user = verifyAdminAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
