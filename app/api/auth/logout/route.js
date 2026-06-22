import { NextResponse } from 'next/server';
import { revokeRefreshTokenByHash, hashToken, getCookieOptions, ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/server/auth/refreshToken';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { writeAuditLog } from '@/lib/server/audit/writeAuditLog';

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    try {
      await revokeRefreshTokenByHash(hashToken(refreshToken));
    } catch (e) {
      console.error('Logout revoke:', e.message);
    }
  }

  await writeAuditLog({
    userId: auth.session.userId,
    action: 'auth.logout',
    entityType: 'User',
    entityId: auth.session.userId,
    request,
  });

  const res = NextResponse.json({ success: true });
  res.cookies.set(ACCESS_COOKIE, '', { ...getCookieOptions(0, '/'), maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, '', { ...getCookieOptions(0, '/api/auth'), maxAge: 0 });
  return res;
}
