import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import User from '@/lib/server/models/User';
import { signAccessToken, ACCESS_MAX_AGE_SECONDS } from '@/lib/server/auth/jwt';
import {
  rotateRefreshToken,
  revokeRefreshTokenByHash,
  hashToken,
  getCookieOptions,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
} from '@/lib/server/auth/refreshToken';

export async function POST(request) {
  try {
    const oldToken = request.cookies.get(REFRESH_COOKIE)?.value;
    if (!oldToken) {
      return NextResponse.json({ error: 'No session' }, { status: 401 });
    }

    const rotated = await rotateRefreshToken(oldToken, {
      userAgent: request.headers.get('user-agent') || '',
    });

    if (!rotated) {
      const res = NextResponse.json({ error: 'Session expired' }, { status: 401 });
      res.cookies.set(ACCESS_COOKIE, '', { ...getCookieOptions(0, '/'), maxAge: 0 });
      res.cookies.set(REFRESH_COOKIE, '', { ...getCookieOptions(0, '/api/auth'), maxAge: 0 });
      return res;
    }

    await connectToDatabase();
    const user = await User.findById(rotated.userId).lean();
    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'User inactive' }, { status: 401 });
    }

    const accessToken = await signAccessToken({
      userId: user._id,
      role: user.role,
      tokenVersion: user.tokenVersion ?? 0,
      email: user.email,
      name: user.name,
    });

    const res = NextResponse.json({ success: true });
    res.cookies.set(ACCESS_COOKIE, accessToken, getCookieOptions(ACCESS_MAX_AGE_SECONDS, '/'));
    res.cookies.set(REFRESH_COOKIE, rotated.newToken, getCookieOptions(60 * 60 * 24 * 30, '/api/auth'));

    return res;
  } catch (error) {
    console.error('Auth refresh error:', error);
    return NextResponse.json({ error: 'Refresh failed' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const token = request.cookies.get(REFRESH_COOKIE)?.value;
  if (token) {
    try {
      await revokeRefreshTokenByHash(hashToken(token));
    } catch (e) {
      console.error('Revoke refresh token:', e.message);
    }
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(ACCESS_COOKIE, '', { ...getCookieOptions(0, '/'), maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, '', { ...getCookieOptions(0, '/api/auth'), maxAge: 0 });
  return res;
}
