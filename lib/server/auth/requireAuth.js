import 'server-only';

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import User from '@/lib/server/models/User';
import { verifyAccessToken, sessionFromPayload } from '@/lib/server/auth/jwt';
import { ACCESS_COOKIE } from '@/lib/shared/authCookies';
import { hasPermission, hasAnyPermission } from '@/lib/server/auth/permissions';

/**
 * Authenticate API request from access_token cookie.
 *
 * JWT is the fast parse; User.isActive and tokenVersion are the source of
 * truth so deactivate / role / password changes apply on the next request.
 */
export async function requireAuth(request, options = {}) {
  const { roles, permission, permissions, allowMustChangePassword = false } = options;

  if (process.env.SKIP_ADMIN_AUTH === 'true') {
    return {
      session: {
        userId: 'dev',
        role: 'super_admin',
        tokenVersion: 0,
        email: 'dev@local',
        name: 'Dev',
        mustChangePassword: false,
      },
    };
  }

  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  const payload = token ? await verifyAccessToken(token) : null;
  const parsed = sessionFromPayload(payload);

  if (!parsed) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  await connectToDatabase();
  const user = await User.findById(parsed.userId)
    .select('role isActive tokenVersion email name mustChangePassword')
    .lean();

  if (!user || !user.isActive) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  if ((user.tokenVersion || 0) !== (parsed.tokenVersion ?? 0)) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const session = {
    userId: String(user._id),
    role: user.role,
    tokenVersion: user.tokenVersion || 0,
    email: user.email || '',
    name: user.name || '',
    mustChangePassword: Boolean(user.mustChangePassword),
  };

  if (session.mustChangePassword && !allowMustChangePassword) {
    return {
      error: NextResponse.json(
        { error: 'Password change required', code: 'MUST_CHANGE_PASSWORD' },
        { status: 403 }
      ),
    };
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
