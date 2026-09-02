import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import User from '@/lib/server/models/User';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { verifyPassword, hashPassword, assertPasswordStrength } from '@/lib/server/auth/password';
import { changePasswordSchema, formatZodError } from '@/lib/server/users/schemas';
import { invalidateSessions } from '@/lib/server/users/userService';
import { signAccessToken, ACCESS_MAX_AGE_SECONDS } from '@/lib/server/auth/jwt';
import {
  generateRefreshToken,
  storeRefreshToken,
  getCookieOptions,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
} from '@/lib/server/auth/refreshToken';
import { writeAuditLog } from '@/lib/server/audit/writeAuditLog';

/**
 * POST /api/auth/change-password
 *
 * Staff replace their current (or temp) password. Issues a fresh session
 * because tokenVersion is bumped.
 *
 * Permissions: any authenticated user (including mustChangePassword)
 */
export async function POST(request) {
  const auth = await requireAuth(request, { allowMustChangePassword: true });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const body = await request.json();
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    const { currentPassword, newPassword } = parsed.data;
    try {
      assertPasswordStrength(newPassword);
    } catch (e) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }

    const user = await User.findById(auth.session.userId);
    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    }

    if (await verifyPassword(newPassword, user.passwordHash)) {
      return NextResponse.json({ error: 'New password must be different' }, { status: 400 });
    }

    user.passwordHash = await hashPassword(newPassword);
    user.mustChangePassword = false;
    await invalidateSessions(user);
    await user.save();

    const accessToken = await signAccessToken({
      userId: user._id,
      role: user.role,
      tokenVersion: user.tokenVersion ?? 0,
      email: user.email,
      name: user.name,
    });
    const refreshToken = generateRefreshToken();
    await storeRefreshToken({
      userId: user._id,
      token: refreshToken,
      userAgent: request.headers.get('user-agent') || '',
    });

    await writeAuditLog({
      userId: user._id,
      actorRole: user.role,
      action: 'auth.password_changed',
      entityType: 'User',
      entityId: user._id,
      request,
    });

    const res = NextResponse.json({ success: true });
    res.cookies.set(ACCESS_COOKIE, accessToken, getCookieOptions(ACCESS_MAX_AGE_SECONDS, '/'));
    res.cookies.set(REFRESH_COOKIE, refreshToken, getCookieOptions(60 * 60 * 24 * 30, '/api/auth'));
    return res;
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 });
  }
}
