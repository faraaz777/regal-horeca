import 'server-only';

import { NextResponse } from 'next/server';
import { verifyAccessToken, sessionFromPayload } from '@/lib/server/auth/jwt';
import { ACCESS_COOKIE } from '@/lib/shared/authCookies';
import { hasPermission, hasAnyPermission } from '@/lib/server/auth/permissions';

/**
 * Authenticate API request from access_token cookie (no DB — fast path).
 */
export async function requireAuth(request, options = {}) {
  const { roles, permission, permissions } = options;

  if (process.env.SKIP_ADMIN_AUTH === 'true') {
    return {
      session: {
        userId: 'dev',
        role: 'super_admin',
        tokenVersion: 0,
        email: 'dev@local',
        name: 'Dev',
      },
    };
  }

  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  const payload = token ? await verifyAccessToken(token) : null;
  const session = sessionFromPayload(payload);

  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  if (roles?.length && !roles.includes(session.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  if (permission && !hasPermission(session.role, permission)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  if (permissions?.length && !hasAnyPermission(session.role, permissions)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { session };
}

export async function assertAdmin(request) {
  const result = await requireAuth(request);
  return result.error || null;
}

export function getAccessTokenFromRequest(request) {
  return request.cookies.get(ACCESS_COOKIE)?.value || null;
}
